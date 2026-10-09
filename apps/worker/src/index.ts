/**
 * Service worker — webhooks Meta + files d'attente.
 *
 * SÉPARÉ de Next.js, et ce n'est pas un détail d'organisation : une boucle
 * d'agent ne doit pas dépendre d'un timeout serverless.
 */
import Fastify from 'fastify'
import { registerWebhook } from './webhook.js'
import { startQueue } from './queue.js'

const app = Fastify({ logger: true })

await registerWebhook(app)
await startQueue()

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
