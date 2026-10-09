import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Vérifie X-Hub-Signature-256 sur le corps BRUT de la requête.
 *
 * Le corps doit être le buffer exact reçu, pas un objet re-sérialisé :
 * `JSON.stringify(req.body)` ne redonne pas les mêmes octets et la
 * signature échouera. Un webhook non vérifié est une porte ouverte —
 * n'importe qui pourrait se faire passer pour Meta.
 */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  const received = Buffer.from(header.slice('sha256='.length), 'hex')
  if (received.length !== expected.length) return false
  return timingSafeEqual(expected, received)
}
