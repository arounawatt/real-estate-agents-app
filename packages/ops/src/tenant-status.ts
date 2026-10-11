/**
 * Accès d'une agence : désactivation (impayé, fin de contrat) et date de fin
 * d'accès (`until_at`, 31 jours à la création).
 *
 *   pnpm ops:tenant-status                                              liste les agences et leur état
 *   pnpm ops:tenant-status --tenant <id> --disable [--reason "impayé"]  désactive
 *   pnpm ops:tenant-status --tenant <id> --enable                       réactive
 *   pnpm ops:tenant-status --tenant <id> --until 2027-10-11             accès jusqu'à ce jour inclus
 *   pnpm ops:tenant-status --tenant <id> --add-days 30                  prolonge de 30 jours
 *
 * Désactivée ou arrivée en fin d'accès, une agence ne peut plus se connecter
 * (sessions ouvertes comprises) et ses agents ne répondent plus sur WhatsApp.
 * Ses messages entrants restent enregistrés, et rien n'est supprimé : rétablir
 * l'accès la remet exactement dans l'état où elle était.
 */
import { parseArgs } from 'node:util'
import { db, tenantAccess, tenants } from '@codaya/db'
import { asc, eq } from 'drizzle-orm'
import { assertUuid, formatDate, OpsError, requireTenant, run } from './shared.js'

const DAY_MS = 24 * 60 * 60 * 1000

function label(t: { name: string | null }) {
  return t.name ?? '(sans nom)'
}

/** "2027-10-11" → fin de ce jour à Dakar : l'accès court jusqu'au jour inclus. */
function parseUntil(input: string): Date {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 23, 59, 59)) : null
  // Date.UTC accepte 2027-02-30 ou 2027-13-05 en débordant : on vérifie qu'il n'a rien corrigé.
  if (!d || d.getUTCMonth() !== +m![2]! - 1 || d.getUTCDate() !== +m![3]!) throw new OpsError(`--until doit être une date AAAA-MM-JJ, par exemple 2027-10-11 (reçu : ${input}).`)
  return d
}

function parseDays(input: string): number {
  if (!/^\d+$/.test(input) || +input < 1) throw new OpsError(`--add-days doit être un nombre de jours entier positif (reçu : ${input}).`)
  return +input
}

run(async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: {
      tenant: { type: 'string' },
      disable: { type: 'boolean' },
      enable: { type: 'boolean' },
      reason: { type: 'string' },
      until: { type: 'string' },
      'add-days': { type: 'string' },
    },
  })

  const actions = [values.disable, values.enable, values.until, values['add-days']].filter((v) => v !== undefined)

  if (!values.tenant && actions.length === 0) {
    const rows = await db.select({
      id: tenants.id, name: tenants.name, plan: tenants.plan,
      disabledAt: tenants.disabledAt, disabledReason: tenants.disabledReason, untilAt: tenants.untilAt,
    }).from(tenants).orderBy(asc(tenants.createdAt))
    if (rows.length === 0) return console.log('\nAucune agence.')
    console.log('')
    for (const t of rows) {
      const access = tenantAccess(t)
      const state = access === 'disabled'
        ? `✗ DÉSACTIVÉE le ${formatDate(t.disabledAt!)}${t.disabledReason ? ` — ${t.disabledReason}` : ''}`
        : access === 'expired'
          ? `✗ FIN D'ACCÈS le ${formatDate(t.untilAt)}`
          : `✓ active jusqu'au ${formatDate(t.untilAt)}`
      console.log(`${t.id}  ${label(t).padEnd(28)} ${t.plan.padEnd(10)} ${state}`)
    }
    return
  }

  if (actions.length !== 1) {
    throw new OpsError('Indiquer une seule action parmi --disable, --enable, --until, --add-days (et --tenant <id>).')
  }
  const tenantId = assertUuid(values.tenant, '--tenant')
  const tenant = await requireTenant(tenantId)
  const [current] = await db.select({ disabledAt: tenants.disabledAt, untilAt: tenants.untilAt })
    .from(tenants).where(eq(tenants.id, tenantId))
  if (!current) throw new OpsError(`Aucune agence avec l'identifiant ${tenantId}.`)

  if (values.until !== undefined || values['add-days'] !== undefined) {
    const now = new Date()
    // Prolonger part de la fin d'accès actuelle, ou d'aujourd'hui si elle est
    // déjà passée : 30 jours ajoutés donnent toujours 30 jours d'accès.
    const untilAt = values.until !== undefined
      ? parseUntil(values.until)
      : new Date(Math.max(current.untilAt.getTime(), now.getTime()) + parseDays(values['add-days']!) * DAY_MS)
    await db.update(tenants).set({ untilAt }).where(eq(tenants.id, tenantId))
    console.log(`\n✓ ${label(tenant)} : fin d'accès ${formatDate(current.untilAt)} → ${formatDate(untilAt)}.`)
    if (untilAt <= now) console.log('  ⚠ Cette date est passée : l\'agence n\'a plus accès dès maintenant.')
    if (current.disabledAt) console.log(`  ⚠ L'agence reste désactivée. Pour la réactiver : pnpm ops:tenant-status --tenant ${tenantId} --enable`)
    return
  }

  if (values.disable) {
    if (current.disabledAt) {
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

  if (!current.disabledAt) throw new OpsError(`${label(tenant)} est déjà active.`)
  await db.update(tenants).set({ disabledAt: null, disabledReason: null }).where(eq(tenants.id, tenantId))
  console.log(`\n✓ ${label(tenant)} est réactivée : connexion possible, les agents répondent de nouveau.`)
  console.log('  Les messages reçus pendant la désactivation n\'ont pas eu de réponse : à reprendre par l\'agence.')
  if (current.untilAt <= new Date()) {
    console.log(`  ⚠ Mais sa fin d'accès est passée (${formatDate(current.untilAt)}) : elle n'a toujours pas accès.`)
    console.log(`  Prolonger : pnpm ops:tenant-status --tenant ${tenantId} --add-days 31`)
  }
})
