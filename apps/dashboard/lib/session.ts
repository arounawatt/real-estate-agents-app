/**
 * Session du tableau de bord — numéro de téléphone + mot de passe
 * (packages/db/src/auth.ts).
 *
 * Toute page qui affiche des données d'un contact (nom, téléphone) DOIT
 * passer par getSession() pour obtenir tenantId — jamais le lire depuis
 * l'URL ou une autre source : un lien profond sans session légitime serait
 * une fuite de données personnelles dont l'agence serait responsable.
 */
import { getSessionByToken } from '@codaya/db'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const SESSION_COOKIE = 'codaya_session'

/** Null si personne n'est connecté — pour une route qui répond 401 au lieu de rediriger. */
export async function getOptionalSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await getSessionByToken(token)
  return session ? { ...session, token } : null
}

/** Redirige vers /login s'il n'y a pas de session valide. */
export async function getSession() {
  const session = await getOptionalSession()
  if (!session) redirect('/login')
  return session
}
