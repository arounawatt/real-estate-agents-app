/**
 * Remplace le jeton d'accès Meta d'un numéro déjà raccordé — quand il a
 * expiré (les jetons temporaires de Meta durent 24 h) ou a été régénéré.
 *
 *   pnpm ops:whatsapp-token                  liste les numéros et demande lequel
 *   pnpm ops:whatsapp-token --tenant <uuid>  directement le numéro de cette agence
 *
 * Le nouveau jeton est demandé au clavier et vérifié auprès de Meta sur le
 * phone_number_id enregistré AVANT de remplacer l'ancien : un jeton invalide
 * ne doit jamais écraser un jeton qui marche peut-être encore.
 */
import { parseArgs } from 'node:util'
import { db, tenants, whatsappAccounts } from '@codaya/db'
import { encryptToken } from '@codaya/whatsapp'
import { eq } from 'drizzle-orm'
import { ask, assertUuid, OpsError, run, verifyWhatsapp } from './shared.js'

run(async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((a) => a !== '--'),
    options: { tenant: { type: 'string' } },
  })

  const accounts = await db.select({
    id: whatsappAccounts.id,
    tenantId: whatsappAccounts.tenantId,
    agency: tenants.name,
    wabaId: whatsappAccounts.wabaId,
    phoneNumberId: whatsappAccounts.phoneNumberId,
    displayPhoneNumber: whatsappAccounts.displayPhoneNumber,
  })
    .from(whatsappAccounts)
    .innerJoin(tenants, eq(tenants.id, whatsappAccounts.tenantId))
    .orderBy(tenants.name)
  if (accounts.length === 0) throw new OpsError('Aucun numéro WhatsApp raccordé.')

  let account: (typeof accounts)[number] | undefined
  if (values.tenant) {
    const tenantId = assertUuid(values.tenant, '--tenant')
    account = accounts.find((a) => a.tenantId === tenantId)
    if (!account) throw new OpsError(`Aucun numéro WhatsApp raccordé pour l'agence ${tenantId}.`)
  } else {
    console.log('Numéros raccordés :')
    accounts.forEach((a, i) => console.log(`  ${i + 1}. ${a.displayPhoneNumber ?? a.phoneNumberId} — ${a.agency ?? 'agence sans nom'}`))
    const choice = accounts.length === 1 ? '1' : await ask(`Lequel mettre à jour (1-${accounts.length}) : `)
    account = accounts[Number(choice) - 1]
    if (!account) throw new OpsError(`Choix invalide : ${choice}`)
  }
  console.log(`\nNuméro : ${account.displayPhoneNumber ?? account.phoneNumberId} — ${account.agency ?? 'agence sans nom'}`)

  const accessToken = await ask("Nouveau jeton d'accès Meta : ")
  if (!accessToken) throw new OpsError('Jeton vide.')

  const info = await verifyWhatsapp({ wabaId: account.wabaId, phoneNumberId: account.phoneNumberId, accessToken })
  await db.update(whatsappAccounts)
    .set({ accessTokenEncrypted: encryptToken(accessToken), displayPhoneNumber: info.displayPhoneNumber })
    .where(eq(whatsappAccounts.id, account.id))

  console.log(`\n✓ Jeton remplacé pour ${info.displayPhoneNumber}. Le worker l'utilise dès le prochain message, sans redémarrage.`)
})
