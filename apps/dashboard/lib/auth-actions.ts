'use server'

import { changePassword, checkPassword, deleteSession, login, MIN_PASSWORD_LENGTH } from '@codaya/db'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { toWaId } from './phone'
import { getSession, SESSION_COOKIE } from './session'

/** Même message que le numéro existe ou non : la page de connexion ne doit
 *  pas permettre de deviner quels numéros ont un compte. */
export async function loginAction(formData: FormData) {
  const phone = String(formData.get('phone') ?? '')
  const password = String(formData.get('password') ?? '')
  const waId = toWaId(String(formData.get('phoneCountry') ?? ''), phone)
  if (!waId) redirect('/login?error=phone_format')

  const result = await login(waId, password)
  if (!result.ok) redirect(`/login?error=${result.reason}`)

  ;(await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: result.expiresAt,
  })
  redirect('/')
}

export async function logoutAction() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await deleteSession(token)
  jar.delete(SESSION_COOKIE)
  redirect('/login')
}

export async function changePasswordAction(formData: FormData) {
  const session = await getSession()
  const current = String(formData.get('currentPassword') ?? '')
  const next = String(formData.get('newPassword') ?? '')
  const confirm = String(formData.get('confirmPassword') ?? '')

  if (!(await checkPassword(session.agencyUserId, current))) redirect('/settings?error=password_current#password')
  if (next.length < MIN_PASSWORD_LENGTH) redirect('/settings?error=password_short#password')
  if (next !== confirm) redirect('/settings?error=password_mismatch#password')

  await changePassword(session.agencyUserId, session.token, next)
  redirect('/settings?saved=password#password')
}
