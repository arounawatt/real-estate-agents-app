/**
 * Socle des scripts d'exploitation — création d'agences, de comptes et
 * raccordement WhatsApp, en attendant l'Embedded Signup
 * (docs/architecture-technique-saas.md).
 *
 * Chaque insertion vérifie d'abord ce qui la ferait échouer et le dit en
 * français : un script d'onboarding qui plante sur une contrainte SQL
 * illisible pendant un rendez-vous client, c'est l'installation ratée.
 */
import { randomInt } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { agencyUsers, db, hashPassword, MIN_PASSWORD_LENGTH, tenants, whatsappAccounts } from '@codaya/db'
import { encryptToken, getPhoneNumberInfo, subscribeAppToWaba } from '@codaya/whatsapp'
import { eq } from 'drizzle-orm'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

export class OpsError extends Error {}

/** Lance un script : affiche une erreur attendue sans pile, ferme la connexion. */
export function run(main: () => Promise<void>) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err instanceof OpsError ? `\n✗ ${err.message}` : err)
      process.exit(1)
    })
}

/** Numéro international complet → wa_id. L'indicatif est obligatoire ici :
 *  un script n'a pas de menu de pays, et on ne suppose jamais +221. */
export function parsePhone(input: string | undefined, what = 'Le numéro'): string {
  const m = input?.replace(/[\s.\-()]/g, '').match(/^(?:\+|00)(\d{8,15})$/)
  if (!m) throw new OpsError(`${what} doit être au format international, par exemple "+221 77 123 45 67" (reçu : ${input ?? 'rien'}).`)
  return m[1]!
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function assertUuid(value: string | undefined, what: string): string {
  if (!value || !UUID.test(value)) throw new OpsError(`${what} doit être un identifiant UUID (reçu : ${value ?? 'rien'}).`)
  return value
}

/** Mot de passe provisoire lisible à l'oral : sans 0/O ni 1/l/I. */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const group = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')
  return `${group()}-${group()}-${group()}`
}

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim()
}

export async function requireTenant(tenantId: string) {
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!tenant) throw new OpsError(`Aucune agence avec l'identifiant ${tenantId}.`)
  return tenant
}

export const PLANS = ['essential', 'complete'] as const
export const DISCLOSURE_LEVELS = ['neighbourhood', 'listing_only'] as const

export type TenantInput = {
  name: string | null
  plan: (typeof PLANS)[number]
  listingDomains: string[]
  bookingUrlRental: string | null
  bookingUrlSale: string | null
  splitBookingLinks: boolean
  address: string | null
  phone: string | null
  contactEmail: string | null
  openingHours: string | null
  disclosureLevel: (typeof DISCLOSURE_LEVELS)[number]
  emergencyNumbers: { label: string; number: string }[] | null
}

/** `untilAt` vient du défaut de la base : 31 jours d'accès à la création. */
export async function insertTenant(ex: Executor, input: TenantInput): Promise<{ id: string; untilAt: Date }> {
  const [row] = await ex.insert(tenants).values(input).returning({ id: tenants.id, untilAt: tenants.untilAt })
  return row!
}

/** Heure de Dakar (GMT toute l'année), quel que soit le fuseau de la machine. */
export function formatDate(d: Date) {
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar',
  })
}

/**
 * Ajoute un compte, ou met à jour son mot de passe s'il existe déjà dans
 * CETTE agence. `password: null` → numéro admin sans accès au tableau de bord.
 * Rappel : ce numéro ne parle plus à Coumba (routage `assistant`).
 */
export async function upsertAgencyUser(
  ex: Executor,
  tenantId: string,
  input: { waId: string; fullName: string | null; password: string | null },
): Promise<'created' | 'updated'> {
  if (input.password != null && input.password.length < MIN_PASSWORD_LENGTH) {
    throw new OpsError(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`)
  }
  const passwordHash = input.password == null ? null : await hashPassword(input.password)
  const [existing] = await ex.select().from(agencyUsers).where(eq(agencyUsers.whatsappNumber, input.waId)).limit(1)

  if (existing && existing.tenantId !== tenantId) {
    throw new OpsError(`Le numéro +${input.waId} appartient déjà à une autre agence.`)
  }
  if (existing) {
    await ex.update(agencyUsers).set({
      ...(passwordHash ? { passwordHash, failedLoginCount: 0, lockedUntil: null } : {}),
      ...(input.fullName ? { fullName: input.fullName } : {}),
    }).where(eq(agencyUsers.id, existing.id))
    return 'updated'
  }
  await ex.insert(agencyUsers).values({ tenantId, whatsappNumber: input.waId, fullName: input.fullName, role: 'owner', passwordHash })
  return 'created'
}

export type WhatsappInput = { wabaId: string; phoneNumberId: string; accessToken: string }

/** Interroge Meta AVANT toute écriture : la paire jeton / phone_number_id
 *  doit être valide, sinon on lierait un numéro qui ne recevra jamais rien. */
export async function verifyWhatsapp(input: WhatsappInput) {
  return asOpsError(() => getPhoneNumberInfo(input.phoneNumberId, input.accessToken))
}

export async function subscribeWaba(input: WhatsappInput) {
  return asOpsError(() => subscribeAppToWaba(input.wabaId, input.accessToken))
}

/** Un refus de Meta est une erreur attendue (jeton expiré, mauvais id) :
 *  on l'affiche comme telle, sans pile technique. */
async function asOpsError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw new OpsError(err instanceof Error ? err.message : String(err))
  }
}

export async function insertWhatsappAccount(
  ex: Executor,
  tenantId: string,
  input: WhatsappInput & { displayPhoneNumber: string },
) {
  const [taken] = await ex.select({ tenantId: whatsappAccounts.tenantId }).from(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, input.phoneNumberId)).limit(1)
  if (taken) throw new OpsError(`Ce phone_number_id est déjà raccordé${taken.tenantId === tenantId ? ' à cette agence' : ' à une autre agence'}.`)

  // Le worker et le tableau de bord lisent UN compte par agence
  // (getWhatsappAccountByTenant) : un second serait ignoré sans bruit.
  const [existing] = await ex.select({ id: whatsappAccounts.id }).from(whatsappAccounts)
    .where(eq(whatsappAccounts.tenantId, tenantId)).limit(1)
  if (existing) throw new OpsError('Cette agence a déjà un compte WhatsApp raccordé. Un seul numéro par agence pour l\'instant.')

  await ex.insert(whatsappAccounts).values({
    tenantId,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    displayPhoneNumber: input.displayPhoneNumber,
    accessTokenEncrypted: encryptToken(input.accessToken),
  })
}
