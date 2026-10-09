import type { FastifyInstance } from 'fastify'
import { verifySignature } from '@codaya/whatsapp'
import { enqueue } from './queue.js'

/**
 * Webhook UNIQUE, commun à tous les tenants.
 *
 * Quatre règles, chacune apprise à ses dépens quelque part :
 *
 *  1. Vérifier X-Hub-Signature-256 sur le corps BRUT. Un webhook non
 *     vérifié accepte n'importe qui se faisant passer pour Meta.
 *  2. Mettre en file et répondre 200 IMMÉDIATEMENT.
 *  3. JAMAIS d'appel LLM ici. Meta retente, puis DÉSACTIVE le webhook si
 *     la réponse est lente ou en erreur — et le produit tombe en silence
 *     chez tous les clients à la fois.
 *  4. `phone_number_id` est la clé de tenant. C'est là, et nulle part
 *     ailleurs, que se fait la liaison.
 */
export async function registerWebhook(app: FastifyInstance) {
  // Corps brut : JSON.stringify(req.body) ne redonne pas les mêmes octets.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  // Poignée de main initiale de Meta.
  app.get('/webhook', async (req, reply) => {
    const q = req.query as Record<string, string>
    if (
      q['hub.mode'] === 'subscribe' &&
      q['hub.verify_token'] === process.env.META_WEBHOOK_VERIFY_TOKEN
    ) {
      return reply.code(200).send(q['hub.challenge'])
    }
    return reply.code(403).send()
  })

  app.post('/webhook', async (req, reply) => {
    const raw = req.body as Buffer
    const signature = req.headers['x-hub-signature-256'] as string | undefined

    if (!verifySignature(raw, signature, process.env.META_APP_SECRET!)) {
      return reply.code(401).send()
    }

    // On accuse réception d'abord. Tout le reste est asynchrone.
    reply.code(200).send()

    try {
      await enqueue('inbound', JSON.parse(raw.toString('utf8')))
    } catch (err) {
      req.log.error({ err }, 'mise en file impossible')
    }
  })
}
