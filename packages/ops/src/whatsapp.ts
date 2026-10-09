/**
 * Raccorde le numéro WhatsApp Business d'une agence.
 *
 *   pnpm ops:whatsapp --tenant <uuid> --waba-id <id> --phone-number-id <id>
 *
 * Le jeton d'accès est demandé au clavier — jamais en argument, il finirait
 * dans l'historique du shell. Étapes : vérification de la paire auprès de
 * Meta, abonnement de l'application aux webhooks du WABA, puis
 * enregistrement (jeton chiffré).
 */
import { parseArgs } from 'node:util'
import { db } from '@codaya/db'
import { ask, assertUuid, insertWhatsappAccount, OpsError, requireTenant, run, subscribeWaba, verifyWhatsapp } from './shared.js'

run(async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: { tenant: { type: 'string' }, 'waba-id': { type: 'string' }, 'phone-number-id': { type: 'string' } },
  })
  const tenantId = assertUuid(values.tenant, '--tenant')
  const wabaId = values['waba-id']
  const phoneNumberId = values['phone-number-id']
  if (!wabaId || !phoneNumberId) throw new OpsError('--waba-id et --phone-number-id sont requis.')
  const tenant = await requireTenant(tenantId)

  const accessToken = await ask("Jeton d'accès Meta : ")
  if (!accessToken) throw new OpsError('Jeton vide.')

  const info = await verifyWhatsapp({ wabaId, phoneNumberId, accessToken })
  console.log(`  Meta confirme : ${info.displayPhoneNumber}${info.verifiedName ? ` (${info.verifiedName})` : ''}`)
  await subscribeWaba({ wabaId, phoneNumberId, accessToken })
  console.log('  Application abonnée aux webhooks du WABA.')
  await insertWhatsappAccount(db, tenantId, { wabaId, phoneNumberId, accessToken, displayPhoneNumber: info.displayPhoneNumber })

  console.log(`\n✓ WhatsApp raccordé : ${info.displayPhoneNumber} → agence « ${tenant.name ?? 'sans nom'} »`)
  console.log('  Pas encore fait : la bibliothèque de templates sur ce WABA (aucun script pour l\'instant).')
})
