/**
 * Authentification du tableau de bord : numéro de téléphone + mot de passe.
 *
 * Aucune dépendance : scrypt et les jetons viennent de node:crypto. Le
 * numéro de connexion est le `whatsappNumber` de agency_users (format
 * wa_id) — l'index unique global garantit qu'il désigne un seul tenant.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq, gt, isNull, lt, ne } from 'drizzle-orm'
import { db } from './client.js'
import { agencyUsers, sessions, tenants } from './schema.js'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>
const KEY_LEN = 64
const MAX_FAILED_LOGINS = 5
const LOCK_MS = 15 * 60 * 1000
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const MIN_PASSWORD_LENGTH = 8

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LEN)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split('$')
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

/** Empreinte calculée une fois : sert à faire le même travail quand le
 *  numéro est inconnu, pour que le temps de réponse ne révèle pas quels
 *  numéros ont un compte. */
const DUMMY_HASH = hashPassword('codaya-dummy-password')

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'locked' | 'suspended' }

export async function login(whatsappNumber: string, password: string): Promise<LoginResult> {
  const [user] = await db.select().from(agencyUsers).where(eq(agencyUsers.whatsappNumber, whatsappNumber)).limit(1)

  if (!user?.passwordHash) {
    await verifyPassword(password, await DUMMY_HASH)
    return { ok: false, reason: 'invalid' }
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, reason: 'locked' }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1
    const locks = failed >= MAX_FAILED_LOGINS
    await db.update(agencyUsers)
      .set({ failedLoginCount: locks ? 0 : failed, lockedUntil: locks ? new Date(Date.now() + LOCK_MS) : null })
      .where(eq(agencyUsers.id, user.id))
    return { ok: false, reason: locks ? 'locked' : 'invalid' }
  }

  // Vérifié APRÈS le mot de passe : sinon la page de connexion révélerait à
  // n'importe qui qu'un numéro appartient à une agence suspendue.
  const [tenant] = await db.select({ disabledAt: tenants.disabledAt }).from(tenants)
    .where(eq(tenants.id, user.tenantId)).limit(1)
  if (!tenant || tenant.disabledAt) return { ok: false, reason: 'suspended' }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({ tokenHash: tokenHash(token), agencyUserId: user.id, tenantId: user.tenantId, expiresAt })
  await db.update(agencyUsers)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(agencyUsers.id, user.id))
  // Ménage opportuniste : pas de tâche planifiée pour ça.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  return { ok: true, token, expiresAt }
}

export async function getSessionByToken(token: string) {
  const [row] = await db.select({
    tenantId: sessions.tenantId,
    agencyUserId: sessions.agencyUserId,
    fullName: agencyUsers.fullName,
    whatsappNumber: agencyUsers.whatsappNumber,
  })
    .from(sessions)
    .innerJoin(agencyUsers, eq(agencyUsers.id, sessions.agencyUserId))
    // Une agence désactivée perd l'accès immédiatement, sessions ouvertes comprises.
    .innerJoin(tenants, and(eq(tenants.id, sessions.tenantId), isNull(tenants.disabledAt)))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return row ?? null
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)))
}

/** Change le mot de passe et ferme toutes les AUTRES sessions de la personne
 *  — un mot de passe changé parce qu'il a fuité ne doit laisser personne
 *  connecté ailleurs. */
export async function changePassword(agencyUserId: string, currentToken: string, newPassword: string) {
  await db.update(agencyUsers).set({ passwordHash: await hashPassword(newPassword) }).where(eq(agencyUsers.id, agencyUserId))
  await db.delete(sessions)
    .where(and(eq(sessions.agencyUserId, agencyUserId), ne(sessions.tokenHash, tokenHash(currentToken))))
}

export async function checkPassword(agencyUserId: string, password: string): Promise<boolean> {
  const [user] = await db.select({ passwordHash: agencyUsers.passwordHash }).from(agencyUsers).where(eq(agencyUsers.id, agencyUserId)).limit(1)
  return Boolean(user?.passwordHash && await verifyPassword(password, user.passwordHash))
}
