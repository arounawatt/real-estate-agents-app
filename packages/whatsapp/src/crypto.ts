/**
 * Chiffrement au repos des tokens d'accès Meta stockés dans
 * `whatsapp_accounts.access_token_encrypted` (packages/db/src/schema.ts).
 * AES-256-GCM : l'IV et le tag d'authentification voyagent préfixés au
 * chiffré, `TOKEN_ENCRYPTION_KEY` ne sert qu'à dériver la clé elle-même.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function loadKey(): Buffer {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY
  if (!b64) throw new Error('TOKEN_ENCRYPTION_KEY manquant — voir .env.example (openssl rand -base64 32)')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY doit faire 32 octets une fois décodé (openssl rand -base64 32)')
  }
  return key
}

export function encryptToken(plainToken: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

export function decryptToken(encrypted: string): string {
  const raw = Buffer.from(encrypted, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const ciphertext = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
