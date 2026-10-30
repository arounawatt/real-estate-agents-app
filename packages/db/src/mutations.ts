/**
 * Écritures partagées — séparées de queries.ts, qui ne contient que des
 * lectures (voir son en-tête). Même règle de sécurité : `tenantId` est un
 * paramètre, injecté par le code appelant, jamais déduit.
 *
 * `urgencyForcedBy` reste vide pour l'instant : il n'y a pas encore de
 * vraie session par utilisateur (voir apps/dashboard/lib/session.ts), donc
 * on ne peut pas honnêtement attribuer un forçage à une personne précise.
 */
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from './client.js'
import {
  agencyUsers, contacts, conversations, escalations, leads, listingImportJobs, messageMedia, messages, properties,
  tenantLogos, tenants, tickets, visitRequests,
} from './schema.js'

type TenantId = string

/** Marque la conversation d'un lead comme reprise par un conseiller. */
export async function markLeadHandedOver(tenantId: TenantId, leadId: string) {
  const [lead] = await db.select({ contactId: leads.contactId })
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
    .limit(1)
  if (!lead) throw new Error('Lead introuvable')

  await db.update(conversations)
    .set({ handedOverAt: new Date() })
    .where(and(
      eq(conversations.tenantId, tenantId),
      eq(conversations.contactId, lead.contactId),
      eq(conversations.profile, 'sales'),
    ))
}

/**
 * Rend la conversation d'un lead à Coumba : elle répondra de nouveau
 * automatiquement au prochain message entrant. Aucun message n'est envoyé
 * au client — c'est son prochain message qui la fait reprendre.
 */
export async function releaseLeadHandover(tenantId: TenantId, leadId: string) {
  const [lead] = await db.select({ contactId: leads.contactId })
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
    .limit(1)
  if (!lead) throw new Error('Lead introuvable')

  await db.update(conversations)
    .set({ handedOverAt: null })
    .where(and(
      eq(conversations.tenantId, tenantId),
      eq(conversations.contactId, lead.contactId),
      eq(conversations.profile, 'sales'),
    ))
}

export async function setTicketStatus(
  tenantId: TenantId,
  ticketId: string,
  status: 'open' | 'resolved',
) {
  await db.update(tickets)
    .set({ status, resolvedAt: status === 'resolved' ? new Date() : null })
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
}

/** `level: null` retire le forçage — le niveau redevient celui calculé. */
export async function forceTicketUrgency(
  tenantId: TenantId,
  ticketId: string,
  level: 'safety' | 'urgent' | 'normal' | 'low' | null,
) {
  await db.update(tickets)
    .set({ urgencyForced: level, urgencyForcedAt: level ? new Date() : null })
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
}

export async function setPropertyStatus(
  tenantId: TenantId,
  propertyId: string,
  status: 'published' | 'unpublished',
) {
  await db.update(properties)
    .set({ status })
    .where(and(eq(properties.tenantId, tenantId), eq(properties.id, propertyId)))
}

export interface PropertyInput {
  title: string
  transaction: 'sale' | 'long_term_rental' | 'short_term_rental'
  type: 'apartment' | 'villa' | 'land' | 'commercial'
  typology: 'studio' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6_plus' | 'none'
  city: string | null
  district: string | null
  floor: string | null
  areaSqm: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  guestToilet: boolean | null
  price: number | null
  rentPeriod: 'month' | 'week' | 'night' | 'none'
  charges: 'excluded' | 'included' | 'none'
  furnished: 'furnished' | 'unfurnished' | 'partly' | 'to_qualify' | 'none'
  availability: 'available' | 'from_date'
  availableFrom: string | null
  amenities: string[]
  services: string[]
  notes: string | null
  listingUrl: string | null
}

function generateReference(input: Pick<PropertyInput, 'district' | 'city' | 'type'>) {
  const place = (input.district || input.city || 'bien').slice(0, 3).toUpperCase()
  const type = input.type.slice(0, 2).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${place}-${type}-${suffix}`
}

export interface PropertyImportMeta {
  source?: 'url' | 'form'
  sourceUrl?: string | null
  rawListing?: string | null
  fieldsToConfirm?: string[]
}

/** Par défaut créé via le formulaire : `source` 'form', `fieldsToConfirm`
 *  vide — c'est la personne qui remplit qui décide de ce qu'elle laisse
 *  vide. `meta` porte la trace quand le brouillon vient d'Amadou (import
 *  URL) : `source: 'url'`, l'URL lue et ce qu'il n'a pas trouvé — jamais
 *  deviné à sa place. */
export async function createProperty(tenantId: TenantId, input: PropertyInput, meta: PropertyImportMeta = {}) {
  const [row] = await db.insert(properties).values({
    tenantId,
    reference: generateReference(input),
    source: meta.source ?? 'form',
    sourceUrl: meta.sourceUrl ?? null,
    rawListing: meta.rawListing ?? null,
    fieldsToConfirm: meta.fieldsToConfirm ?? [],
    status: 'unpublished',
    ...input,
  }).returning({ id: properties.id })
  if (!row) throw new Error('Échec de création du bien')
  return row.id
}

/**
 * `fieldsToConfirm` est optionnel : la Server Action le recalcule à partir de
 * ce qui reste vide dans `input` (voir computeFieldsToConfirm dans
 * apps/dashboard/lib/actions.ts) — remplir un champ marqué « à confirmer »
 * doit faire disparaître le badge, pas le garder indéfiniment.
 */
export async function updateProperty(
  tenantId: TenantId,
  propertyId: string,
  input: PropertyInput,
  fieldsToConfirm?: string[],
) {
  await db.update(properties)
    .set(fieldsToConfirm ? { ...input, fieldsToConfirm } : input)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.id, propertyId)))
}

/**
 * Écrite par la Server Action au clic sur « Analyser l'annonce », lue par
 * apps/worker qui la traite en tâche de fond (fetch — potentiellement via
 * navigateur headless — puis extraction). Voir packages/db/src/schema.ts.
 */
export async function createListingImportJob(tenantId: TenantId, url: string) {
  const [row] = await db.insert(listingImportJobs)
    .values({ tenantId, url, status: 'pending' })
    .returning({ id: listingImportJobs.id })
  if (!row) throw new Error('Échec de création du job d’import')
  return row.id
}

export async function completeListingImportJob(jobId: string, extraction: unknown, rawText: string) {
  await db.update(listingImportJobs)
    .set({ status: 'done', extraction, rawText, completedAt: new Date() })
    .where(eq(listingImportJobs.id, jobId))
}

export async function failListingImportJob(jobId: string, failureReason: string) {
  await db.update(listingImportJobs)
    .set({ status: 'failed', failureReason, completedAt: new Date() })
    .where(eq(listingImportJobs.id, jobId))
}

/* ───────────────────────── Boucle agent (worker) ─────────────────────────
 * Écritures déclenchées par un message WhatsApp entrant : contact,
 * conversation, lead, messages, escalade, demande de visite. `tenantId`
 * ici vient de getWhatsappAccountByPhoneNumberId (queries.ts), jamais du
 * contenu du message.
 * ─────────────────────────────────────────────────────────────────────── */

export async function findOrCreateContact(
  tenantId: TenantId,
  waId: string,
  phone: string,
  fullName: string | null,
) {
  const [existing] = await db.select().from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.waId, waId)))
    .limit(1)
  if (existing) {
    // Complète le nom si on ne l'avait pas encore — jamais n'écrase un nom déjà connu.
    if (!existing.fullName && fullName) {
      await db.update(contacts).set({ fullName }).where(eq(contacts.id, existing.id))
      return { ...existing, fullName }
    }
    return existing
  }
  const [created] = await db.insert(contacts)
    .values({ tenantId, waId, phone, fullName })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  // Course perdue contre une requête concurrente : la ligne existe déjà, on la relit.
  const [row] = await db.select().from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.waId, waId)))
    .limit(1)
  if (!row) throw new Error('Échec de création du contact')
  return row
}

/**
 * Correction manuelle depuis le tableau de bord — le prénom par défaut de
 * WhatsApp n'est pas toujours propre, et `kind` (prospect/locataire/à
 * qualifier) peut changer dans le temps : un acheteur devient locataire
 * d'un bien livré, par exemple. `kind` conditionne le routage de
 * routeProfile() dès le message suivant.
 */
export async function updateContact(
  tenantId: TenantId,
  contactId: string,
  input: { fullName: string | null; kind: 'prospect' | 'tenant' | 'unknown' },
) {
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ kind: contacts.kind }).from(contacts)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
      .limit(1)
    if (!before) return

    await tx.update(contacts)
      .set(input)
      .where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))

    // Devenu locataire : la conversation commerciale avec Coumba est terminée.
    // Sans ça, « En ce moment » affiche encore « Coumba échange avec… » pour
    // quelqu'un qu'elle ne suit plus.
    if (input.kind === 'tenant' && before.kind !== 'tenant') {
      await tx.update(conversations)
        .set({ closedAt: new Date(), closedReason: 'contact_became_tenant' })
        .where(and(
          eq(conversations.tenantId, tenantId),
          eq(conversations.contactId, contactId),
          eq(conversations.profile, 'sales'),
          isNull(conversations.closedAt),
        ))
    }
  })
}

export async function findOrCreateConversation(
  tenantId: TenantId,
  contactId: string,
  profile: 'sales' | 'property_manager' | 'catalogue' | 'assistant',
) {
  const match = and(
    eq(conversations.tenantId, tenantId),
    eq(conversations.contactId, contactId),
    eq(conversations.profile, profile),
  )
  const [existing] = await db.select().from(conversations).where(match).limit(1)
  if (existing) return existing
  const [created] = await db.insert(conversations)
    .values({ tenantId, contactId, profile })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const [row] = await db.select().from(conversations).where(match).limit(1)
  if (!row) throw new Error('Échec de création de la conversation')
  return row
}

/** Voir le commentaire sur `conversations.agentState` dans schema.ts. */
export async function updateConversationAgentState(conversationId: string, agentState: unknown) {
  await db.update(conversations).set({ agentState }).where(eq(conversations.id, conversationId))
}

/**
 * Un lead par contact suffit pour l'instant — pas de second parcours
 * d'achat avant que le premier soit refroidi. Le modèle ne crée jamais un
 * lead lui-même : il reçoit l'id déjà résolu et appelle save_qualification
 * dessus (voir packages/agent/src/sales-agent.ts).
 */
export async function findOrCreateLead(tenantId: TenantId, contactId: string) {
  const [existing] = await db.select().from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.contactId, contactId)))
    .orderBy(desc(leads.createdAt))
    .limit(1)
  if (existing) return existing
  const [created] = await db.insert(leads).values({ tenantId, contactId }).returning()
  if (!created) throw new Error('Échec de création du lead')
  return created
}

export async function recordInboundMessage(
  tenantId: TenantId,
  conversationId: string,
  body: string,
  metaMessageId: string | null,
  buttonPayload: string | null = null,
  mediaKind: 'image' | 'video' | null = null,
) {
  const [row] = await db.insert(messages).values({
    tenantId, conversationId, direction: 'inbound', body, metaMessageId, buttonPayload, mediaKind,
  }).returning({ id: messages.id })
  // Un message entrant rouvre une conversation terminée : si quelqu'un y
  // écrit, c'est qu'elle a de nouveau lieu.
  await db.update(conversations)
    .set({ lastInboundAt: new Date(), closedAt: null, closedReason: null })
    .where(eq(conversations.id, conversationId))
  return row!.id
}

/** Binaire d'une photo reçue sur WhatsApp, déjà rapatrié depuis Meta. */
export async function recordInboundMedia(
  tenantId: TenantId,
  messageId: string,
  media: { data: Buffer; mimeType: string; ticketId: string | null },
) {
  const [row] = await db.insert(messageMedia).values({
    tenantId, messageId, data: media.data, mimeType: media.mimeType,
    bytes: media.data.length, ticketId: media.ticketId,
  }).returning({ id: messageMedia.id })
  return row!.id
}

/* ───────────────────────── Dossiers (Malick) ───────────────────────── */

export interface TicketFactsInput {
  habitable?: 'yes' | 'no' | 'partly'
  utilityCut?: 'none' | 'water' | 'power' | 'water_and_power'
  safetyRisk?: boolean
  worsening?: boolean
  safetyReason?: string
}

export interface TicketUrgencyInput {
  urgency: 'safety' | 'urgent' | 'normal' | 'low'
  urgencyReason: string
}

/**
 * Le niveau d'urgence arrive DÉJÀ calculé (computeUrgency, packages/agent) :
 * cette couche n'en juge rien, elle stocke. La référence est le numéro
 * suivant du tenant — courte, pour qu'un locataire puisse la dicter.
 */
export async function createTicket(
  tenantId: TenantId,
  contactId: string,
  input: {
    subjectAsDeclared: string
    nature: 'plumbing' | 'electricity' | 'air_conditioning' | 'locksmith' | 'gas' | 'admin' | 'other'
    description: string | null
  } & TicketFactsInput & TicketUrgencyInput,
) {
  // Deux dossiers créés au même instant peuvent viser le même numéro : l'index
  // unique (tenant, reference) tranche, on retente avec le suivant.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db.select({
      next: sql<number>`coalesce(max(case when ${tickets.reference} ~ '^[0-9]+$' then ${tickets.reference}::int end), 0) + 1`,
    }).from(tickets).where(eq(tickets.tenantId, tenantId))
    const [created] = await db.insert(tickets)
      .values({ tenantId, contactId, reference: String(row?.next ?? 1), ...input })
      .onConflictDoNothing()
      .returning()
    if (created) return created
  }
  throw new Error('Impossible d\'attribuer une référence au dossier')
}

/** Ne touche que les faits réellement fournis — jamais n'efface un fait déjà établi. */
export async function updateTicketFacts(
  tenantId: TenantId,
  ticketId: string,
  input: TicketFactsInput & { description?: string } & TicketUrgencyInput,
) {
  const set: Record<string, unknown> = { urgency: input.urgency, urgencyReason: input.urgencyReason }
  for (const key of ['habitable', 'utilityCut', 'safetyRisk', 'worsening', 'safetyReason', 'description'] as const) {
    if (input[key] !== undefined) set[key] = input[key]
  }
  await db.update(tickets).set(set).where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
}

/** Les photos envoyées AVANT l'ouverture du dossier y sont rattachées à
 *  l'ouverture — un locataire envoie souvent la photo avant d'expliquer. */
export async function attachPendingMediaToTicket(tenantId: TenantId, conversationId: string, ticketId: string) {
  const pending = db.select({ id: messages.id }).from(messages)
    .where(and(eq(messages.tenantId, tenantId), eq(messages.conversationId, conversationId)))
  await db.update(messageMedia)
    .set({ ticketId })
    .where(and(
      eq(messageMedia.tenantId, tenantId),
      isNull(messageMedia.ticketId),
      inArray(messageMedia.messageId, pending),
    ))
}

export async function recordOutboundMessage(
  tenantId: TenantId,
  conversationId: string,
  body: string | null,
  templateName: string | null = null,
  metaMessageId: string | null = null,
) {
  await db.insert(messages).values({
    tenantId, conversationId, direction: 'outbound', body, templateName, metaMessageId,
  })
}

export interface LeadQualificationInput {
  intent?: 'purchase' | 'rental' | 'investment' | 'to_qualify'
  propertyType?: 'apartment' | 'villa' | 'land' | 'commercial' | 'to_qualify'
  zone?: string
  budgetAmount?: number
  timeline?: 'immediate' | 'three_months' | 'six_months' | 'later' | 'to_qualify'
  notes?: string
}

/** Lieu de vie déclaré par le contact (save_qualification). Même règle que
 *  pour le lead : seuls les champs fournis sont écrits. */
export async function updateContactResidence(
  tenantId: TenantId,
  contactId: string,
  input: { residence?: 'senegal' | 'abroad' | 'to_qualify'; declaredCity?: string },
) {
  const set: Record<string, unknown> = {}
  if (input.residence !== undefined) set.residence = input.residence
  if (input.declaredCity !== undefined) set.declaredCity = input.declaredCity
  if (Object.keys(set).length === 0) return
  await db.update(contacts).set(set).where(and(eq(contacts.tenantId, tenantId), eq(contacts.id, contactId)))
}

/** Ne touche que les champs réellement fournis par ce tool call — jamais
 *  n'écrase par défaut un fait déjà révélé lors d'un tour précédent. */
export async function updateLeadQualification(
  tenantId: TenantId,
  leadId: string,
  input: LeadQualificationInput,
) {
  const set: Record<string, unknown> = {}
  if (input.intent !== undefined) set.intent = input.intent
  if (input.propertyType !== undefined) set.propertyType = input.propertyType
  if (input.zone !== undefined) set.zone = input.zone
  if (input.budgetAmount !== undefined) set.budgetAmount = input.budgetAmount
  if (input.timeline !== undefined) set.timeline = input.timeline
  if (input.notes !== undefined) set.notes = input.notes
  if (Object.keys(set).length === 0) return
  await db.update(leads).set(set).where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
}

export async function createEscalation(
  tenantId: TenantId,
  conversationId: string,
  reason: string,
  trigger: string,
) {
  await db.insert(escalations).values({ tenantId, conversationId, reason, trigger })
}

export async function createVisitRequestRow(
  tenantId: TenantId,
  leadId: string,
  propertyId: string | null,
  intent: 'purchase' | 'rental' | 'investment' | 'to_qualify',
  mode: 'link_sent' | 'callback_announced',
  bookingUrlSent: string | null,
) {
  await db.insert(visitRequests).values({ tenantId, leadId, propertyId, intent, mode, bookingUrlSent })
}

/* ───────────────────────── Tenant ───────────────────────── */

/** Réglages « Mes paramètres ». `name` peut être vide : les messages se
 *  rabattent alors sur « l'agence » (agencyReference(), packages/agent). */
export async function updateTenantSettings(tenantId: TenantId, input: {
  name: string | null
  bookingUrlRental: string | null
  bookingUrlSale: string | null
  splitBookingLinks: boolean
  address: string | null
  phone: string | null
  contactEmail: string | null
  openingHours: string | null
}) {
  await db.update(tenants).set(input).where(eq(tenants.id, tenantId))
}

export async function setTenantLogo(tenantId: TenantId, data: Buffer, mimeType: string) {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.insert(tenantLogos)
      .values({ tenantId, data, mimeType, updatedAt: now })
      .onConflictDoUpdate({ target: tenantLogos.tenantId, set: { data, mimeType, updatedAt: now } })
    await tx.update(tenants).set({ logoUpdatedAt: now }).where(eq(tenants.id, tenantId))
  })
}

export async function removeTenantLogo(tenantId: TenantId) {
  await db.transaction(async (tx) => {
    await tx.delete(tenantLogos).where(eq(tenantLogos.tenantId, tenantId))
    await tx.update(tenants).set({ logoUpdatedAt: null }).where(eq(tenants.id, tenantId))
  })
}

/** `whatsappNumber` au format wa_id (chiffres, indicatif compris, sans « + »).
 *  L'index unique est global : un numéro ne peut appartenir qu'à une agence,
 *  sinon le routage ne saurait pas de quel tenant il relève. */
export async function addAgencyUser(tenantId: TenantId, input: { fullName: string | null; whatsappNumber: string }) {
  const [row] = await db.insert(agencyUsers)
    .values({ tenantId, role: 'owner', ...input })
    .onConflictDoNothing({ target: agencyUsers.whatsappNumber })
    .returning({ id: agencyUsers.id })
  return row ? 'added' as const : 'number_taken' as const
}

export async function removeAgencyUser(tenantId: TenantId, agencyUserId: string) {
  await db.delete(agencyUsers)
    .where(and(eq(agencyUsers.tenantId, tenantId), eq(agencyUsers.id, agencyUserId)))
}
