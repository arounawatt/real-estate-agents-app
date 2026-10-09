/**
 * File d'attente sur Postgres (pg-boss) : zéro infrastructure
 * supplémentaire à exploiter, ce qui compte quand on est seul.
 *
 * Deux consommateurs : `listing_import` (import de bien depuis une URL) et
 * `inbound` (webhooks Meta — routage puis boucle de Coumba, voir
 * inbound-consumer.ts). Seul le profil `sales` répond pour l'instant.
 */
import PgBoss from 'pg-boss'
import { processInboundWebhook } from './inbound-consumer.js'
import { processListingImportJob, type ListingImportJobData } from './listing-import-worker.js'

let boss: PgBoss | undefined

export async function startQueue() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL manquant — voir .env.example')

  boss = new PgBoss(url)
  boss.on('error', (err) => console.error(err))
  await boss.start()

  await boss.createQueue('listing_import')
  await boss.work<ListingImportJobData>('listing_import', async (jobs) => {
    for (const job of jobs) await processListingImportJob(job.data)
  })

  await boss.createQueue('inbound')
  await boss.work('inbound', async (jobs) => {
    for (const job of jobs) {
      try {
        await processInboundWebhook(job.data as Parameters<typeof processInboundWebhook>[0])
      } catch (err) {
        console.error('Échec de traitement du message entrant', err)
      }
    }
  })
}

export async function enqueue(queue: string, payload: unknown) {
  if (!boss) throw new Error('File non démarrée — startQueue() doit être appelé avant enqueue()')
  await boss.send(queue, payload as object)
}
