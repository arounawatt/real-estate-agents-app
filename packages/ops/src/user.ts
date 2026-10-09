/**
 * Ajoute un numéro à une agence, ou change son mot de passe.
 *
 *   pnpm ops:user --tenant <uuid> --phone "+221 77 123 45 67" [--name "Awa Diop"] [--no-access]
 *
 * Le mot de passe est demandé au clavier (Entrée seule = mot de passe
 * provisoire généré et affiché). --no-access : numéro admin WhatsApp sans
 * accès au tableau de bord. Ce numéro ne parle plus à Coumba.
 */
import { parseArgs } from 'node:util'
import { assertUuid, ask, generatePassword, parsePhone, requireTenant, run, upsertAgencyUser } from './shared.js'
import { db } from '@codaya/db'

run(async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: { tenant: { type: 'string' }, phone: { type: 'string' }, name: { type: 'string' }, 'no-access': { type: 'boolean' } },
  })
  const tenantId = assertUuid(values.tenant, '--tenant')
  const waId = parsePhone(values.phone, '--phone')
  const tenant = await requireTenant(tenantId)

  let password: string | null = null
  let generated = false
  if (!values['no-access']) {
    password = await ask('Mot de passe (Entrée pour en générer un) : ')
    if (!password) { password = generatePassword(); generated = true }
  }

  const result = await upsertAgencyUser(db, tenantId, { waId, fullName: values.name ?? null, password })
  console.log(`\n✓ ${result === 'created' ? 'Compte créé' : 'Compte mis à jour'} : +${waId} — agence « ${tenant.name ?? 'sans nom'} »`)
  if (generated) console.log(`  Mot de passe provisoire : ${password}   (à changer dans « Mes paramètres »)`)
  if (!password) console.log('  Sans accès au tableau de bord.')
})
