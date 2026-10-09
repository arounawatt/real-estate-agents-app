/**
 * Producteur pg-boss côté tableau de bord — le worker (apps/worker) est le
 * seul consommateur. Un seul client, réutilisé entre les Server Actions
 * du même processus, même principe que le singleton de packages/db/src/client.ts.
 */
import PgBoss from 'pg-boss'

let bossPromise: Promise<PgBoss> | undefined

async function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const url = process.env.DATABASE_URL
      if (!url) throw new Error('DATABASE_URL manquant — voir .env.example')
      const boss = new PgBoss(url)
      boss.on('error', (err) => console.error(err))
      await boss.start()
      await boss.createQueue('listing_import')
      return boss
    })()
  }
  return bossPromise
}

export async function enqueueListingImport(payload: { jobId: string; tenantId: string; url: string }) {
  const boss = await getBoss()
  await boss.send('listing_import', payload)
}
