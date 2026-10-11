/**
 * Crée une agence et son premier compte, pour pouvoir se connecter et
 * remplir le reste depuis « Mes paramètres ».
 *
 *   pnpm ops:tenant --phone "+221 77 123 45 67" [--name "Keur Immo"] [--admin-name "Awa Diop"] [--plan essential|complete]
 *
 * Le premier compte reçoit un mot de passe provisoire, affiché une fois.
 */
import { parseArgs } from 'node:util'
import { db } from '@codaya/db'
import { formatDate, generatePassword, insertTenant, OpsError, parsePhone, PLANS, run, upsertAgencyUser } from './shared.js'

run(async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: { name: { type: 'string' }, phone: { type: 'string' }, 'admin-name': { type: 'string' }, plan: { type: 'string' } },
  })
  const waId = parsePhone(values.phone, '--phone')
  const plan = (values.plan ?? 'essential') as (typeof PLANS)[number]
  if (!PLANS.includes(plan)) throw new OpsError(`--plan doit valoir ${PLANS.join(' ou ')}.`)
  const password = generatePassword()

  const { id: tenantId, untilAt } = await db.transaction(async (tx) => {
    const created = await insertTenant(tx, {
      name: values.name?.trim() || null, plan, listingDomains: [], bookingUrlRental: null, bookingUrlSale: null,
      splitBookingLinks: false, disclosureLevel: 'neighbourhood', emergencyNumbers: null,
    })
    await upsertAgencyUser(tx, created.id, { waId, fullName: values['admin-name'] ?? null, password })
    return created
  })

  console.log(`\n✓ Agence créée : ${values.name ?? '(sans nom)'} — plan ${plan}`)
  console.log(`  tenant_id : ${tenantId}`)
  console.log(`  Accès jusqu'au ${formatDate(untilAt)} (prolonger : pnpm ops:tenant-status --tenant ${tenantId} --add-days 30)`)
  console.log(`  Connexion : +${waId} / ${password}   (mot de passe provisoire, à changer dans « Mes paramètres »)`)
  console.log(`  Ensuite : pnpm ops:whatsapp --tenant ${tenantId} --waba-id … --phone-number-id …`)
})
