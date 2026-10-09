/**
 * Active ou désactive une agence — impayé, fin de contrat.
 *
 *   pnpm ops:tenant-status                                              liste les agences et leur état
 *   pnpm ops:tenant-status --tenant <id> --disable [--reason "impayé"]  désactive
 *   pnpm ops:tenant-status --tenant <id> --enable                       réactive
 *
 * Désactivée, une agence ne peut plus se connecter (sessions ouvertes
 * comprises) et ses agents ne répondent plus sur WhatsApp. Ses messages
 * entrants restent enregistrés, et rien n'est supprimé : réactiver la remet
 * exactement dans l'état où elle était.
 */
import { parseArgs } from 'node:util'
import { db, tenants } from '@codaya/db'
import { asc, eq } from 'drizzle-orm'
import { assertUuid, OpsError, requireTenant, run } from './shared.js'

function label(t: { name: string | null }) {
  return t.name ?? '(sans nom)'
}

function formatDate(d: Date) {
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

run(async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: {
      tenant: { type: 'string' },
      disable: { type: 'boolean' },
      enable: { type: 'boolean' },
      reason: { type: 'string' },
    },
  })

  if (!values.tenant && !values.disable && !values.enable) {
    const rows = await db.select({
      id: tenants.id, name: tenants.name, plan: tenants.plan,
      disabledAt: tenants.disabledAt, disabledReason: tenants.disabledReason,
    }).from(tenants).orderBy(asc(tenants.createdAt))
    if (rows.length === 0) return console.log('\nAucune agence.')
    console.log('')
    for (const t of rows) {
      const state = t.disabledAt
        ? `✗ DÉSACTIVÉE le ${formatDate(t.disabledAt)}${t.disabledReason ? ` — ${t.disabledReason}` : ''}`
        : '✓ active'
      console.log(`${t.id}  ${label(t).padEnd(28)} ${t.plan.padEnd(10)} ${state}`)
    }
    return
  }

  if (values.disable === values.enable) {
    throw new OpsError('Indiquer soit --disable, soit --enable (et --tenant <id>).')
  }
  const tenantId = assertUuid(values.tenant, '--tenant')
  const tenant = await requireTenant(tenantId)
  const [current] = await db.select({ disabledAt: tenants.disabledAt }).from(tenants).where(eq(tenants.id, tenantId))

  if (values.disable) {
    if (current?.disabledAt) {
      throw new OpsError(`${label(tenant)} est déjà désactivée depuis le ${formatDate(current.disabledAt)}.`)
    }
    await db.update(tenants)
      .set({ disabledAt: new Date(), disabledReason: values.reason?.trim() || null })
      .where(eq(tenants.id, tenantId))
    console.log(`\n✗ ${label(tenant)} est désactivée${values.reason ? ` (${values.reason.trim()})` : ''}.`)
    console.log('  · tableau de bord : plus de connexion, sessions ouvertes coupées immédiatement')
    console.log('  · WhatsApp : les agents ne répondent plus — les messages entrants restent enregistrés')
    console.log(`  Pour réactiver : pnpm ops:tenant-status --tenant ${tenantId} --enable`)
    return
  }

  if (!current?.disabledAt) throw new OpsError(`${label(tenant)} est déjà active.`)
  await db.update(tenants).set({ disabledAt: null, disabledReason: null }).where(eq(tenants.id, tenantId))
  console.log(`\n✓ ${label(tenant)} est réactivée : connexion possible, les agents répondent de nouveau.`)
  console.log('  Les messages reçus pendant la désactivation n\'ont pas eu de réponse : à reprendre par l\'agence.')
})
