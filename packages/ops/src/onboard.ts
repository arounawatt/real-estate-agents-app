/**
 * Installation complète d'une agence depuis un fichier JSON :
 * l'agence et ses réglages, ses numéros admin, son WhatsApp.
 *
 *   pnpm ops:onboard keur-immo.json
 *
 * Le fichier est cherché dans onboarding/ à la racine du projet (ou au
 * chemin donné). Modèle : onboarding/exemple.json ; mode d'emploi :
 * onboarding/LISEZMOI.md.
 *
 * Ordre : tout est vérifié avant d'écrire quoi que ce soit (fichier, numéros
 * déjà pris, jeton auprès de Meta), puis l'écriture en base se fait en une
 * transaction — tout ou rien, jamais une agence à moitié créée.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '@codaya/db'
import {
  DISCLOSURE_LEVELS, generatePassword, insertTenant, insertWhatsappAccount, OpsError, parsePhone, PLANS, run,
  subscribeWaba, upsertAgencyUser, verifyWhatsapp, type TenantInput, type WhatsappInput,
} from './shared.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

type Admin = { fullName: string | null; waId: string; dashboardAccess: boolean }

function str(v: unknown, what: string, required = false): string | null {
  if (v == null || v === '') {
    if (required) throw new OpsError(`${what} est obligatoire.`)
    return null
  }
  if (typeof v !== 'string') throw new OpsError(`${what} doit être un texte.`)
  return v.trim() || null
}

function url(v: unknown, what: string): string | null {
  const s = str(v, what)
  if (s == null) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
    return u.toString()
  } catch {
    throw new OpsError(`${what} n'est pas une adresse web valide : ${s}`)
  }
}

function parseFile(raw: unknown): { tenant: TenantInput; admins: Admin[]; whatsapp: WhatsappInput | null } {
  if (typeof raw !== 'object' || raw == null) throw new OpsError('Le fichier doit contenir un objet JSON.')
  const { agency = {}, admins, whatsapp } = raw as Record<string, any>

  const plan = agency.plan ?? 'essential'
  if (!PLANS.includes(plan)) throw new OpsError(`agency.plan doit valoir ${PLANS.join(' ou ')}.`)
  const disclosureLevel = agency.disclosureLevel ?? 'neighbourhood'
  if (!DISCLOSURE_LEVELS.includes(disclosureLevel)) throw new OpsError(`agency.disclosureLevel doit valoir ${DISCLOSURE_LEVELS.join(' ou ')}.`)
  const emergency = agency.emergencyNumbers ?? []
  if (!Array.isArray(emergency) || emergency.some((e: any) => !str(e?.label, 'label') || !str(e?.number, 'number'))) {
    throw new OpsError('agency.emergencyNumbers doit être une liste de { "label": …, "number": … }.')
  }

  const tenant: TenantInput = {
    name: str(agency.name, 'agency.name'),
    plan,
    listingDomains: Array.isArray(agency.listingDomains) ? agency.listingDomains.map((d: unknown) => str(d, 'agency.listingDomains')!).filter(Boolean) : [],
    bookingUrlRental: url(agency.bookingUrlRental, 'agency.bookingUrlRental'),
    bookingUrlSale: url(agency.bookingUrlSale, 'agency.bookingUrlSale'),
    splitBookingLinks: agency.splitBookingLinks === true,
    disclosureLevel,
    emergencyNumbers: emergency.length ? emergency : null,
  }

  if (!Array.isArray(admins) || admins.length === 0) throw new OpsError('admins doit contenir au moins un numéro.')
  const parsedAdmins: Admin[] = admins.map((a: any, i: number) => ({
    fullName: str(a?.fullName, `admins[${i}].fullName`),
    waId: parsePhone(a?.phone, `admins[${i}].phone`),
    dashboardAccess: a?.dashboardAccess !== false,
  }))
  if (!parsedAdmins.some((a) => a.dashboardAccess)) throw new OpsError('Au moins un admin doit avoir accès au tableau de bord, sinon personne ne peut se connecter.')
  if (new Set(parsedAdmins.map((a) => a.waId)).size !== parsedAdmins.length) throw new OpsError('Le même numéro apparaît deux fois dans admins.')

  let wa: WhatsappInput | null = null
  if (whatsapp != null) {
    wa = {
      wabaId: str(whatsapp.wabaId, 'whatsapp.wabaId', true)!,
      phoneNumberId: str(whatsapp.phoneNumberId, 'whatsapp.phoneNumberId', true)!,
      accessToken: str(whatsapp.accessToken, 'whatsapp.accessToken', true)!,
    }
  }
  return { tenant, admins: parsedAdmins, whatsapp: wa }
}

run(async () => {
  const arg = process.argv.slice(2).find((a) => a !== '--')
  if (!arg) throw new OpsError('Indiquez le fichier : pnpm ops:onboard keur-immo.json')
  const file = [arg, path.join(ROOT, 'onboarding', arg), path.resolve(process.env.INIT_CWD ?? process.cwd(), arg)].find((p) => existsSync(p))
  if (!file) throw new OpsError(`Fichier introuvable : ${arg} (cherché dans onboarding/ et dans le dossier courant).`)

  let raw: unknown
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { throw new OpsError(`JSON invalide dans ${path.basename(file)} : ${(e as Error).message}`) }
  const { tenant, admins, whatsapp } = parseFile(raw)
  console.log(`Fichier : ${path.relative(ROOT, file)} — vérifié.`)

  let displayPhoneNumber: string | null = null
  if (whatsapp) {
    const info = await verifyWhatsapp(whatsapp)
    displayPhoneNumber = info.displayPhoneNumber
    console.log(`  Meta confirme le numéro WhatsApp : ${info.displayPhoneNumber}${info.verifiedName ? ` (${info.verifiedName})` : ''}`)
    // Avant la transaction : idempotent, donc sans conséquence si l'écriture échoue ensuite.
    await subscribeWaba(whatsapp)
    console.log('  Application abonnée aux webhooks du WABA.')
  }

  const passwords = new Map<string, string>()
  const tenantId = await db.transaction(async (tx) => {
    const id = await insertTenant(tx, tenant)
    for (const admin of admins) {
      const password = admin.dashboardAccess ? generatePassword() : null
      if (password) passwords.set(admin.waId, password)
      await upsertAgencyUser(tx, id, { waId: admin.waId, fullName: admin.fullName, password })
    }
    if (whatsapp) await insertWhatsappAccount(tx, id, { ...whatsapp, displayPhoneNumber: displayPhoneNumber! })
    return id
  })

  console.log(`\n✓ Agence installée : ${tenant.name ?? '(sans nom)'} — plan ${tenant.plan}`)
  console.log(`  tenant_id : ${tenantId}`)
  for (const admin of admins) {
    const pw = passwords.get(admin.waId)
    console.log(`  ${admin.fullName ?? 'Sans nom'} +${admin.waId} — ${pw ? `mot de passe provisoire : ${pw}` : 'sans accès au tableau de bord'}`)
  }
  console.log(whatsapp ? `  WhatsApp : ${displayPhoneNumber}` : '  WhatsApp : non raccordé (pnpm ops:whatsapp plus tard).')
  if (whatsapp) console.log(`\n  ⚠ Le fichier contient le jeton Meta en clair : retirez-le de ${path.basename(file)} maintenant qu'il est enregistré (chiffré) en base.`)
  console.log('  Pas encore fait : la bibliothèque de templates sur le WABA (aucun script pour l\'instant).')
})
