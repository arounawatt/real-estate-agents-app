'use server'

import { agencyReference, isOwnListingDomain } from '@codaya/agent'
import {
  createListingImportJob, createProperty, forceTicketUrgency, getLeadWithContact, getProperty,
  getTenant, getThreadByContactAndProfile, getWhatsappAccountByTenant, markLeadHandedOver,
  addAgencyUser, recordOutboundMessage, releaseLeadHandover, removeAgencyUser, removeTenantLogo, setPropertyStatus, setTenantLogo, setTicketStatus,
  updateContact, updateProperty, updateTenantSettings, type PropertyInput,
} from '@codaya/db'
import { decryptToken, sendTemplate, sendText } from '@codaya/whatsapp'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { toWaId } from './phone'
import { enqueueListingImport } from './queue'
import { getSession } from './session'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Prévient le client que l'agence reprend la main — sinon le bouton n'a
 * d'effet que côté interne, le client ne sait jamais qu'une personne va le
 * recontacter. Texte libre dans la fenêtre de 24 h ; au-delà, le template
 * `handover` (packages/whatsapp/templates.ts), seul envoi qu'il déclenche
 * vraiment : « Ne part QUE si elle appelle vraiment ».
 *
 * Best-effort : un échec d'envoi ne doit pas empêcher la reprise de main
 * elle-même, qui est déjà actée côté humain au moment du clic.
 */
async function notifyHandover(tenantId: string, leadId: string) {
  const row = await getLeadWithContact(tenantId, leadId)
  if (!row) return
  const { contact } = row

  const [thread, tenant, account] = await Promise.all([
    getThreadByContactAndProfile(tenantId, contact.id, 'sales'),
    getTenant(tenantId),
    getWhatsappAccountByTenant(tenantId),
  ])
  if (!thread || !tenant || !account) return

  const withinWindow = Boolean(
    thread.conversation.lastInboundAt
    && Date.now() - thread.conversation.lastInboundAt.getTime() < TWENTY_FOUR_HOURS_MS,
  )
  const accessToken = decryptToken(account.accessTokenEncrypted)
  const firstName = contact.fullName?.split(' ')[0] ?? ''

  if (withinWindow) {
    // Pas de « Bonjour » : la conversation est déjà en cours, ce message la
    // continue — il ne la rouvre pas (contrairement au template hors 24h).
    const opening = firstName || "J'ai une nouvelle pour vous"
    const body = `${opening}, un conseiller de ${agencyReference(tenant.name)} va vous recontacter personnellement très prochainement.`
    const sent = await sendText({ phoneNumberId: account.phoneNumberId, accessToken, to: contact.waId, body })
    await recordOutboundMessage(tenantId, thread.conversation.id, body, null, sent.metaMessageId)
  } else {
    const sent = await sendTemplate({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: contact.waId,
      templateName: 'handover',
      language: 'fr',
      // Le template commence déjà par « Bonjour {{first_name}} » et Meta
      // refuse une variable vide : sans prénom, « Bonjour à vous ».
      params: { first_name: firstName || 'à vous', agency_name: agencyReference(tenant.name), subject: 'votre recherche' },
    })
    await recordOutboundMessage(tenantId, thread.conversation.id, null, 'handover', sent.metaMessageId)
  }
}

export async function handoverLeadAction(leadId: string) {
  const { tenantId } = await getSession()
  await markLeadHandedOver(tenantId, leadId)
  revalidatePath(`/leads/${leadId}`)

  try {
    await notifyHandover(tenantId, leadId)
  } catch (err) {
    console.error('Échec de la notification WhatsApp de reprise de main', err)
  }
}

export async function releaseHandoverAction(leadId: string) {
  const { tenantId } = await getSession()
  await releaseLeadHandover(tenantId, leadId)
  revalidatePath(`/leads/${leadId}`)
}

export async function toggleTicketStatusAction(ticketId: string, currentStatus: 'open' | 'resolved') {
  const { tenantId } = await getSession()
  await setTicketStatus(tenantId, ticketId, currentStatus === 'open' ? 'resolved' : 'open')
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
}

export async function forceTicketUrgencyAction(ticketId: string, formData: FormData) {
  const { tenantId } = await getSession()
  const level = formData.get('level')
  await forceTicketUrgency(
    tenantId,
    ticketId,
    level === 'auto' || level == null ? null : level as 'safety' | 'urgent' | 'normal' | 'low',
  )
  revalidatePath(`/tickets/${ticketId}`)
  revalidatePath('/tickets')
}

export async function togglePropertyStatusAction(propertyId: string, currentStatus: 'published' | 'unpublished') {
  const { tenantId } = await getSession()
  await setPropertyStatus(tenantId, propertyId, currentStatus === 'published' ? 'unpublished' : 'published')
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/properties')
}

function readPropertyForm(formData: FormData): PropertyInput {
  const str = (key: string) => {
    const v = formData.get(key)
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
  }
  const num = (key: string) => {
    const v = str(key)
    return v == null ? null : Number(v)
  }

  return {
    title: String(formData.get('title') ?? '').trim(),
    transaction: formData.get('transaction') as PropertyInput['transaction'],
    type: formData.get('type') as PropertyInput['type'],
    typology: (formData.get('typology') as PropertyInput['typology']) || 'none',
    city: str('city'),
    district: str('district'),
    floor: str('floor'),
    areaSqm: num('areaSqm'),
    rooms: num('rooms'),
    bedrooms: num('bedrooms'),
    bathrooms: num('bathrooms'),
    guestToilet: formData.get('guestToilet') === 'yes' ? true : formData.get('guestToilet') === 'no' ? false : null,
    price: num('price'),
    rentPeriod: (formData.get('rentPeriod') as PropertyInput['rentPeriod']) || 'none',
    charges: (formData.get('charges') as PropertyInput['charges']) || 'none',
    furnished: (formData.get('furnished') as PropertyInput['furnished']) || 'none',
    availability: (formData.get('availability') as PropertyInput['availability']) || 'available',
    availableFrom: str('availableFrom'),
    amenities: String(formData.get('amenities') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    services: String(formData.get('services') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    notes: str('notes'),
    listingUrl: str('listingUrl'),
  }
}

/**
 * Un champ marqué « à confirmer » doit disparaître dès que la personne le
 * remplit — sinon le badge reste affiché indéfiniment même après relecture,
 * ce qui redevient exactement l'indicateur invérifiable que la règle n°1 du
 * projet interdit. `candidates` est soit ce qu'Amadou n'a pas trouvé (à la
 * création), soit `fieldsToConfirm` déjà en base (à la modification) ;
 * dans les deux cas on ne garde que ce qui est encore vide dans `input`.
 */
function computeFieldsToConfirm(candidates: string[], input: PropertyInput): string[] {
  const stillEmpty: Partial<Record<string, boolean>> = {
    title: !input.title,
    typology: input.typology === 'none',
    city: input.city == null,
    district: input.district == null,
    floor: input.floor == null,
    areaSqm: input.areaSqm == null,
    rooms: input.rooms == null,
    bedrooms: input.bedrooms == null,
    bathrooms: input.bathrooms == null,
    price: input.price == null,
    furnished: input.furnished === 'to_qualify',
    amenities: input.amenities.length === 0,
    services: input.services.length === 0,
  }
  return candidates.filter((f) => stillEmpty[f] ?? false)
}

/**
 * Lit une annonce hébergée par l'agence pour pré-remplir le formulaire de
 * création — jamais l'inverse. Le fetch (potentiellement via navigateur
 * headless, voir apps/worker/src/listing-import-worker.ts) tourne en tâche
 * de fond : cette action se contente de créer la ligne `listing_import_jobs`
 * et de la mettre en file, puis redirige vers `/properties/new?job=…`, qui
 * poll le statut. Rien n'est créé tant que l'utilisateur n'a pas relu et
 * soumis le formulaire lui-même.
 */
export async function analyzeListingAction(formData: FormData) {
  const { tenantId } = await getSession()
  const url = String(formData.get('url') ?? '').trim()
  if (!url) redirect('/properties/new')

  const tenant = await getTenant(tenantId)
  if (!isOwnListingDomain(url, tenant?.listingDomains ?? [])) {
    redirect(`/properties/new?importError=domain_not_allowed&sourceUrl=${encodeURIComponent(url)}`)
  }

  const jobId = await createListingImportJob(tenantId, url)
  await enqueueListingImport({ jobId, tenantId, url })
  redirect(`/properties/new?job=${jobId}`)
}

export async function createPropertyAction(formData: FormData) {
  const { tenantId } = await getSession()
  const input = readPropertyForm(formData)
  const source = formData.get('importSource') === 'url' ? 'url' as const : 'form' as const
  const meta = source === 'url' ? {
    source,
    sourceUrl: String(formData.get('importSourceUrl') ?? '').trim() || null,
    rawListing: String(formData.get('importRawListing') ?? '').trim() || null,
    fieldsToConfirm: computeFieldsToConfirm(
      String(formData.get('importFieldsToConfirm') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      input,
    ),
  } : {}

  const id = await createProperty(tenantId, input, meta)
  revalidatePath('/properties')
  redirect(`/properties/${id}`)
}

export async function updatePropertyAction(propertyId: string, formData: FormData) {
  const { tenantId } = await getSession()
  const input = readPropertyForm(formData)
  const current = await getProperty(tenantId, propertyId)
  const fieldsToConfirm = current ? computeFieldsToConfirm(current.fieldsToConfirm, input) : undefined
  await updateProperty(tenantId, propertyId, input, fieldsToConfirm)
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/properties')
  redirect(`/properties/${propertyId}`)
}

/**
 * Corrige le prénom (le profil WhatsApp par défaut n'est pas toujours
 * propre) et le statut du contact. `kind` conditionne le routage dès le
 * prochain message — voir routeProfile() dans packages/agent/src/routing.ts.
 */
export async function updateContactAction(contactId: string, leadId: string, formData: FormData) {
  const { tenantId } = await getSession()
  const fullName = String(formData.get('fullName') ?? '').trim() || null
  const kind = formData.get('kind')
  await updateContact(tenantId, contactId, {
    fullName,
    kind: kind === 'prospect' || kind === 'tenant' ? kind : 'unknown',
  })
  revalidatePath(`/leads/${leadId}`)
  revalidatePath('/leads')
}

/** PNG, JPEG, WebP. Pas de SVG : il peut embarquer du script, et il serait
 *  servi depuis le domaine du tableau de bord. */
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const LOGO_MAX_BYTES = 500 * 1024

function readBookingUrl(formData: FormData, key: string): string | null | 'invalid' {
  const v = String(formData.get(key) ?? '').trim()
  if (!v) return null
  try {
    const url = new URL(v)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : 'invalid'
  } catch {
    return 'invalid'
  }
}

/**
 * Réglages « Mes paramètres ». Les liens de rendez-vous sont envoyés tels quels
 * par Coumba (outil offer_visit) : on vérifie seulement que ce sont
 * des adresses web, pas qu'elles mènent quelque part.
 */
export async function updateTenantSettingsAction(formData: FormData) {
  const { tenantId } = await getSession()

  const name = String(formData.get('name') ?? '').trim() || null

  const bookingUrlRental = readBookingUrl(formData, 'bookingUrlRental')
  const bookingUrlSale = readBookingUrl(formData, 'bookingUrlSale')
  if (bookingUrlRental === 'invalid' || bookingUrlSale === 'invalid') redirect('/settings?error=invalid_url')

  const logo = formData.get('logo')
  if (logo instanceof File && logo.size > 0) {
    if (!LOGO_TYPES.includes(logo.type)) redirect('/settings?error=logo_type')
    if (logo.size > LOGO_MAX_BYTES) redirect('/settings?error=logo_size')
  }

  await updateTenantSettings(tenantId, {
    name,
    bookingUrlRental,
    bookingUrlSale,
    splitBookingLinks: formData.get('splitBookingLinks') === 'on',
  })

  if (logo instanceof File && logo.size > 0) {
    await setTenantLogo(tenantId, Buffer.from(await logo.arrayBuffer()), logo.type)
  } else if (formData.get('removeLogo') === 'on') {
    await removeTenantLogo(tenantId)
  }

  revalidatePath('/', 'layout')
  redirect('/settings?saved=1')
}

/**
 * Numéros administrateurs. Un numéro ajouté ici n'est plus servi par
 * Coumba : le routage l'envoie vers le profil `assistant` (routeProfile(),
 * packages/agent/src/routing.ts).
 */
export async function addAgencyUserAction(formData: FormData) {
  const { tenantId } = await getSession()
  const whatsappNumber = toWaId(
    String(formData.get('whatsappNumberCountry') ?? ''),
    String(formData.get('whatsappNumber') ?? ''),
  )
  if (!whatsappNumber) redirect('/settings?error=admin_number_invalid#admins')
  const fullName = String(formData.get('fullName') ?? '').trim() || null

  const result = await addAgencyUser(tenantId, { fullName, whatsappNumber })
  if (result === 'number_taken') redirect('/settings?error=admin_number_taken#admins')
  revalidatePath('/settings')
  redirect('/settings?saved=admin#admins')
}

export async function removeAgencyUserAction(agencyUserId: string) {
  const { tenantId, agencyUserId: me } = await getSession()
  // Ce numéro est aussi un compte : se retirer soi-même supprimerait son propre accès.
  if (agencyUserId === me) return
  await removeAgencyUser(tenantId, agencyUserId)
  revalidatePath('/settings')
}
