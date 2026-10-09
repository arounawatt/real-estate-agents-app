/**
 * Schéma de données — codaya-agents
 *
 * Multi-tenant partagé : `tenantId` sur chaque table, RLS activé.
 * Surtout pas une base par client.
 *
 * Les libellés vus par l'utilisateur sont en français ; les identifiants,
 * les tables et les colonnes sont en anglais. Voir CLAUDE.md.
 */

import { relations } from 'drizzle-orm'
import {
  boolean, customType, date, index, integer, jsonb, pgEnum, pgTable,
  text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

/* ───────────────────────── Énumérations ─────────────────────────
 * Chacune contient une porte de sortie (« à qualifier », « unknown »).
 * Sans elle, le modèle invente une valeur plausible pour satisfaire
 * le schéma, et on obtient des budgets crédibles et faux.
 * ─────────────────────────────────────────────────────────────── */

export const planEnum = pgEnum('plan', ['essential', 'complete'])

export const agencyRoleEnum = pgEnum('agency_role', ['owner', 'agent'])

export const contactKindEnum = pgEnum('contact_kind', ['prospect', 'tenant', 'unknown'])

export const intentEnum = pgEnum('intent', [
  'purchase', 'rental', 'investment', 'to_qualify',
])

export const propertyTypeEnum = pgEnum('property_type', [
  'apartment', 'villa', 'land', 'commercial', 'to_qualify',
])

export const timelineEnum = pgEnum('timeline', [
  'immediate', 'three_months', 'six_months', 'later', 'to_qualify',
])

export const transactionEnum = pgEnum('transaction', [
  'sale', 'long_term_rental', 'short_term_rental',
])

export const typologyEnum = pgEnum('typology', [
  'studio', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6_plus', 'none',
])

export const furnishedEnum = pgEnum('furnished', [
  'furnished', 'unfurnished', 'partly', 'to_qualify', 'none',
])

export const chargesEnum = pgEnum('charges', ['excluded', 'included', 'none'])

export const rentPeriodEnum = pgEnum('rent_period', ['month', 'week', 'night', 'none'])

/** Deux valeurs seulement. « Occupé » mélangeait disponibilité et publication. */
export const availabilityEnum = pgEnum('availability', ['available', 'from_date'])

/** Publication et disponibilité sont deux axes indépendants. */
export const listingStatusEnum = pgEnum('listing_status', ['published', 'unpublished'])

export const listingSourceEnum = pgEnum('listing_source', ['url', 'form'])

/* Les quatre faits fermés qui alimentent le calcul d'urgence.
   Le modèle les établit ; il ne juge jamais l'urgence elle-même. */
export const habitableEnum = pgEnum('habitable', ['yes', 'no', 'partly'])
export const utilityCutEnum = pgEnum('utility_cut', ['none', 'water', 'power', 'water_and_power'])

export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'resolved'])
export const ticketNatureEnum = pgEnum('ticket_nature', [
  'plumbing', 'electricity', 'air_conditioning', 'locksmith', 'gas', 'admin', 'other',
])

/** Calculé en code, jamais écrit par le modèle. Stocké pour l'audit. */
export const urgencyEnum = pgEnum('urgency', ['safety', 'urgent', 'normal', 'low'])

export const visitModeEnum = pgEnum('visit_mode', ['link_sent', 'callback_announced'])

export const agentProfileEnum = pgEnum('agent_profile', [
  'sales',            // Coumba
  'property_manager', // Malick  — actif seulement si plan = complete
  'catalogue',        // Amadou
  'assistant',        // Adja    — conçue, pas construite
])

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound'])

/** Pourquoi une conversation est terminée. Une seule raison pour l'instant ;
 *  l'enum garde la porte ouverte sans texte libre. */
export const conversationCloseReasonEnum = pgEnum('conversation_close_reason', ['contact_became_tenant'])

/** Type de média d'un message entrant. Une vidéo n'est PAS conservée (Malick
 *  ne prend que des photos) : la ligne existe pour que le fil dise qu'une
 *  vidéo a été reçue, sans jamais faire passer ça pour un texte du locataire. */
export const messageMediaKindEnum = pgEnum('message_media_kind', ['image', 'video'])

/* ───────────────────────── Tenants ───────────────────────── */

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Facultatif : sans nom, les messages disent « l'agence » (agencyReference(),
   *  packages/agent) et l'en-tête affiche « Codaya ». */
  name: text('name'),
  plan: planEnum('plan').notNull().default('essential'),

  /** Agence désactivée (impayé, fin de contrat…) quand renseigné — posé et
   *  levé par `pnpm ops:tenant-status`, jamais depuis le tableau de bord.
   *  Effets : plus de connexion ni de session valide, et les agents ne
   *  répondent plus sur WhatsApp. Les messages entrants restent enregistrés,
   *  pour que rien ne soit perdu si l'agence est réactivée. */
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  /** Motif interne, pour savoir pourquoi le jour où l'agence appelle. */
  disabledReason: text('disabled_reason'),

  /** Domaines publics de l'agence, au pluriel : site et sous-domaine d'annonces.
   *  Ne conditionnent rien de technique ; servent à distinguer « chez soi »
   *  d'une place de marché dans le catalogue. */
  listingDomains: text('listing_domains').array().notNull().default([]),

  /** Prise de rendez-vous — aucun agenda n'est intégré (§10).
   *  `bookingUrlRental` sert à tout quand `splitBookingLinks` est faux. */
  bookingUrlRental: text('booking_url_rental'),
  bookingUrlSale: text('booking_url_sale'),
  splitBookingLinks: boolean('split_booking_links').notNull().default(false),

  /** Numéros d'urgence de la ville, affichés par le chemin de sécurité.
   *  Configuration par tenant, jamais des valeurs codées en dur. */
  emergencyNumbers: jsonb('emergency_numbers').$type<{ label: string; number: string }[]>(),

  /** Réglage de la zone orange du §9 : 'listing_only' | 'neighbourhood'.
   *  La zone rouge, elle, n'est configurable par personne. */
  disclosureLevel: text('disclosure_level').notNull().default('neighbourhood'),

  /** Null = pas de logo : l'en-tête affiche l'initiale sur fond de marque.
   *  Sert aussi de paramètre de cache dans l'URL du logo. */
  logoUpdatedAt: timestamp('logo_updated_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Le logo vit hors de `tenants` : getTenant() est appelé à chaque page,
 *  il ne doit pas traîner le binaire avec lui. En base plutôt que dans un
 *  stockage objet, qui n'existe pas encore dans ce projet — taille bornée
 *  par l'action d'envoi. */
export const tenantLogos = pgTable('tenant_logos', {
  tenantId: uuid('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
  data: bytea('data').notNull(),
  mimeType: text('mime_type').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Qui, dans l'agence, peut utiliser le produit.
 *  `whatsappNumber` fait exister la troisième branche du routage dès
 *  maintenant, même si le profil `assistant` ne fait encore rien. */
export const agencyUsers = pgTable('agency_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  /** Facultatif : la connexion se fera par numéro de téléphone. */
  email: text('email'),
  fullName: text('full_name'),
  role: agencyRoleEnum('role').notNull().default('agent'),
  /** Sert aussi d'identifiant de connexion au tableau de bord (format wa_id). */
  whatsappNumber: text('whatsapp_number'),

  /** scrypt, jamais en clair — voir src/auth.ts. Null = ne peut pas se connecter. */
  passwordHash: text('password_hash'),
  /** Verrou anti force brute : 5 échecs → 15 minutes. */
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenant: index('agency_users_tenant_idx').on(t.tenantId),
  uniqueWhatsapp: uniqueIndex('agency_users_whatsapp_idx').on(t.whatsappNumber),
}))

/** Sessions du tableau de bord. Le cookie porte un jeton aléatoire ; la base
 *  n'en garde que l'empreinte SHA-256 — une fuite de la table ne donne
 *  aucune session utilisable. `tenantId` est recopié ici pour que
 *  getSession() n'ait qu'une ligne à lire. */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull(),
  agencyUserId: uuid('agency_user_id').notNull().references(() => agencyUsers.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byToken: uniqueIndex('sessions_token_hash_idx').on(t.tokenHash),
}))

export const whatsappAccounts = pgTable('whatsapp_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  wabaId: text('waba_id').notNull(),
  /** Clé de tenant du webhook : c'est là, et nulle part ailleurs, que se fait la liaison. */
  phoneNumberId: text('phone_number_id').notNull(),
  displayPhoneNumber: text('display_phone_number'),
  /** Chiffré au repos avec TOKEN_ENCRYPTION_KEY. */
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byPhoneNumberId: uniqueIndex('whatsapp_accounts_phone_number_idx').on(t.phoneNumberId),
}))

/** Les templates appartiennent au WABA de chaque client : chaque agence a sa
 *  propre bibliothèque approuvée. Le contenu, lui, est strictement identique
 *  pour tous — une seule définition poussée N fois. */
export const messageTemplates = pgTable('message_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'utility' | 'marketing' — déclarée honnêtement
  language: text('language').notNull().default('fr'),
  status: text('status').notNull().default('PENDING'),
  metaTemplateId: text('meta_template_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenantName: uniqueIndex('message_templates_tenant_name_idx').on(t.tenantId, t.name),
}))

/* ───────────────────────── Conversations ───────────────────────── */

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  waId: text('wa_id').notNull(),
  /** Affiché en clair partout dans le tableau de bord : l'agence est
   *  responsable de traitement et tout l'intérêt est qu'elle puisse appeler. */
  phone: text('phone').notNull(),
  fullName: text('full_name'),
  /** Déclarée par la personne uniquement. L'indicatif donne le pays du
   *  NUMÉRO, pas celui de la personne : ne jamais en déduire une ville. */
  declaredCity: text('declared_city'),
  kind: contactKindEnum('kind').notNull().default('unknown'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenantWa: uniqueIndex('contacts_tenant_wa_idx').on(t.tenantId, t.waId),
}))

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  profile: agentProfileEnum('profile').notNull(),
  /** Pilote la règle des 24 h : texte libre en dedans, template en dehors. */
  lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
  handedOverAt: timestamp('handed_over_at', { withTimezone: true }),
  /**
   * Conversation terminée : elle sort de « En ce moment » et des compteurs.
   * Posé quand le contact passe en locataire (sa conversation avec Coumba
   * s'arrête, Malick prend le relais). Un nouveau message entrant sur CETTE
   * conversation la rouvre — en plan essential, un locataire reste routé
   * vers Coumba, et elle échange alors réellement avec lui.
   */
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedReason: conversationCloseReasonEnum('closed_reason'),
  /**
   * Trace brute des tours Claude (blocs tool_use/tool_result inclus), pas
   * seulement le texte final. Sans ça, chaque webhook reconstruit
   * l'historique depuis `messages` (texte seul) et Coumba perd le
   * property_id qu'elle venait de trouver — elle re-cherche à chaque
   * message et peut perdre un bien qu'elle a montré une minute avant. Voir
   * packages/agent/src/sales-agent.ts.
   */
  agentState: jsonb('agent_state'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenant: index('conversations_tenant_idx').on(t.tenantId),
  /** « En ce moment » : dernières conversations actives d'une agence. */
  byTenantLastInbound: index('conversations_tenant_last_inbound_idx').on(t.tenantId, t.lastInboundAt),
  /** Une conversation par (contact, profil) — c'est ce qui rend le
   *  find-or-create du worker idempotent face aux retentatives de Meta. */
  byContactProfile: uniqueIndex('conversations_contact_profile_idx').on(t.tenantId, t.contactId, t.profile),
}))

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  direction: messageDirectionEnum('direction').notNull(),
  body: text('body'),
  templateName: text('template_name'),
  /** Payload du bouton de réponse rapide, quand le message entrant en est un. */
  buttonPayload: text('button_payload'),
  /** Null pour un message texte. */
  mediaKind: messageMediaKindEnum('media_kind'),
  metaMessageId: text('meta_message_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byConversation: index('messages_conversation_idx').on(t.conversationId, t.sentAt),
  /** Compteurs d'activité par agence sur une période. */
  byTenantSentAt: index('messages_tenant_sent_at_idx').on(t.tenantId, t.sentAt),
}))

/** Les media_id de Meta expirent : le binaire est téléchargé immédiatement
 *  et stocké. Un worker qui rate ce téléchargement perd la photo.
 *
 *  Le binaire vit en base (`data`), comme le logo : aucun stockage objet
 *  n'est encore configuré (S3_* vides dans .env). `storageKey` reste pour le
 *  jour où il le sera — null tant que le binaire est dans `data`. */
export const messageMedia = pgTable('message_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  /** Dossier auquel la photo est jointe. Null tant qu'aucun dossier n'est
   *  ouvert : elle y est rattachée à l'ouverture (attachPendingMediaToTicket). */
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  storageKey: text('storage_key'),
  data: bytea('data'),
  mimeType: text('mime_type'),
  bytes: integer('bytes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byMessage: index('message_media_message_idx').on(t.messageId),
  byTicket: index('message_media_ticket_idx').on(t.ticketId),
}))

/* ───────────────────────── Leads ───────────────────────── */

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),

  /* Couche contrainte — elle seule alimente puces, filtres et statistiques. */
  intent: intentEnum('intent').notNull().default('to_qualify'),
  propertyType: propertyTypeEnum('property_type').notNull().default('to_qualify'),
  zone: text('zone'),
  budgetAmount: integer('budget_amount'),
  budgetCurrency: text('budget_currency').default('XOF'),
  timeline: timelineEnum('timeline').notNull().default('to_qualify'),

  /* Couche libre — jamais en puce, jamais dans un filtre. */
  notes: text('notes'),

  /** TODO — l'heuristique n'est pas définie. Laissé volontairement vide :
   *  elle sera calibrée sur de vraies conversations. Ne pas inventer une
   *  formule pour remplir la colonne ; un score inventé pilote le tri par
   *  défaut et le badge « lead chaud », et ne survivrait pas à la question
   *  « d'où il sort ? ». */
  score: integer('score'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  /** Listes paginées triées par date : le tri se fait dans l'index, sans
   *  lire tous les leads de l'agence. */
  byTenant: index('leads_tenant_created_idx').on(t.tenantId, t.createdAt),
  byTenantContact: index('leads_tenant_contact_idx').on(t.tenantId, t.contactId),
}))

/* ───────────────────────── Catalogue ───────────────────────── */

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  reference: text('reference').notNull(),
  title: text('title').notNull(),

  transaction: transactionEnum('transaction').notNull(),
  type: propertyTypeEnum('type').notNull(),
  typology: typologyEnum('typology').notNull().default('none'),
  city: text('city'),
  district: text('district'),
  floor: text('floor'),
  areaSqm: integer('area_sqm'),
  rooms: integer('rooms'),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  guestToilet: boolean('guest_toilet'),
  price: integer('price'),
  rentPeriod: rentPeriodEnum('rent_period').notNull().default('none'),
  charges: chargesEnum('charges').notNull().default('none'),
  furnished: furnishedEnum('furnished').notNull().default('none'),

  /** Deux axes indépendants — ne jamais déduire l'un de l'autre. */
  availability: availabilityEnum('availability').notNull().default('available'),
  availableFrom: date('available_from'),
  status: listingStatusEnum('status').notNull().default('unpublished'),

  amenities: text('amenities').array().notNull().default([]),
  services: text('services').array().notNull().default([]),
  notes: text('notes'),

  /** Ce que Coumba envoie. Jamais reconstruit à partir de la référence :
   *  deviner une adresse produit des liens morts envoyés à de vrais acheteurs. */
  listingUrl: text('listing_url'),
  /** Ce qu'Amadou a lu. Sert de preuve. */
  sourceUrl: text('source_url'),
  rawListing: text('raw_listing'),
  source: listingSourceEnum('source').notNull().default('form'),

  /** Champs qu'Amadou n'a pas trouvés dans l'annonce. Il les laisse vides
   *  plutôt que de les deviner. */
  fieldsToConfirm: text('fields_to_confirm').array().notNull().default([]),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenantRef: uniqueIndex('properties_tenant_ref_idx').on(t.tenantId, t.reference),
  byStatus: index('properties_status_idx').on(t.tenantId, t.status),
  byTenantCreated: index('properties_tenant_created_idx').on(t.tenantId, t.createdAt),
}))

/** Statut d'une lecture d'annonce en file — voir listingImportJobs. */
export const listingImportStatusEnum = pgEnum('listing_import_status', ['pending', 'done', 'failed'])

/**
 * Une ligne par clic sur « Analyser l'annonce ». Le fetch peut passer par
 * un navigateur headless (apps/worker/src/listing-import-worker.ts) quand
 * un simple fetch est bloqué — potentiellement plusieurs secondes, donc
 * hors de la requête HTTP du tableau de bord, qui se contente de créer la
 * ligne et de la relire. `extraction`/`rawText` une fois `status: 'done'`,
 * `failureReason` (même valeurs que ListingImportResult) une fois `'failed'`.
 */
export const listingImportJobs = pgTable('listing_import_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  status: listingImportStatusEnum('status').notNull().default('pending'),
  extraction: jsonb('extraction'),
  rawText: text('raw_text'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => ({
  byTenant: index('listing_import_jobs_tenant_idx').on(t.tenantId),
}))

/* ───────────────────────── Demandes de visite ─────────────────────────
 * Ce ne sont PAS des rendez-vous : la réservation se passe sur l'outil de
 * l'agence, qui ne nous en informe pas. Le nom de la table doit dire la
 * vérité, sinon elle finira par être lue comme si elle contenait des
 * rendez-vous.
 * ─────────────────────────────────────────────────────────────────── */

export const visitRequests = pgTable('visit_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  intent: intentEnum('intent').notNull(),
  mode: visitModeEnum('mode').notNull(),
  /** L'adresse effectivement envoyée, pour pouvoir dire ce qui est parti. */
  bookingUrlSent: text('booking_url_sent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenant: index('visit_requests_tenant_idx').on(t.tenantId, t.createdAt),
}))

/* ───────────────────────── Dossiers (régisseur) ───────────────────────── */

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  reference: text('reference').notNull(),

  /** La réponse BRUTE du locataire à « vous êtes locataire de quel bien ? ».
   *  Pas de rattachement au catalogue en phase 1 — le libellé de l'interface
   *  dit lui-même que c'est du déclaratif non vérifié. */
  subjectAsDeclared: text('subject_as_declared').notNull(),

  nature: ticketNatureEnum('nature').notNull(),
  /** Couche libre : le problème dans les mots du locataire (« le chauffe-eau
   *  fuit sous l'évier »). S'affiche dans la fiche, jamais en puce ni en filtre
   *  — c'est `nature` qui sert aux filtres et aux statistiques. */
  description: text('description'),
  status: ticketStatusEnum('status').notNull().default('open'),

  /* Les quatre faits fermés. Le modèle les établit, il ne juge pas. */
  habitable: habitableEnum('habitable'),
  utilityCut: utilityCutEnum('utility_cut'),
  safetyRisk: boolean('safety_risk'),
  worsening: boolean('worsening'),
  /** Chemin de sécurité : gaz, feu, inondation, installation dangereuse.
   *  Ce n'est pas un niveau de plus dans l'échelle. */
  safetyReason: text('safety_reason'),

  /** Recalculé à chaque nouveau fait, par le code. */
  urgency: urgencyEnum('urgency').notNull().default('normal'),
  /** Ce qui justifie le niveau : « eau coupée ». Le badge ne s'affiche
   *  jamais sans sa raison. */
  urgencyReason: text('urgency_reason'),

  /** Forçage manuel par l'agence — tracé, c'est ce qui protège tout le
   *  monde le jour d'un litige. */
  urgencyForced: urgencyEnum('urgency_forced'),
  urgencyForcedBy: uuid('urgency_forced_by').references(() => agencyUsers.id),
  urgencyForcedAt: timestamp('urgency_forced_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => ({
  byTenantRef: uniqueIndex('tickets_tenant_ref_idx').on(t.tenantId, t.reference),
  /** Listes « ouverts » / « résolus » paginées par date. */
  byStatus: index('tickets_status_created_idx').on(t.tenantId, t.status, t.createdAt),
  byTenantCreated: index('tickets_tenant_created_idx').on(t.tenantId, t.createdAt),
  byTenantContact: index('tickets_tenant_contact_idx').on(t.tenantId, t.contactId),
}))

/* ───────────────────────── Escalades ─────────────────────────
 * Tracées avec leur motif, comme le forçage d'urgence : le jour d'un
 * litige, on doit pouvoir montrer ce que l'agent a dit et pourquoi il a
 * passé la main.
 * ─────────────────────────────────────────────────────────── */

export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  /** 'red_zone' | 'user_asked' | 'no_progress' | 'safety' | 'distress' */
  trigger: text('trigger').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/* ───────────────────────── Prospection (Sokhna) ─────────────────────────
 * Pool global, SANS tenantId : il appartient à Codaya. C'est cette paire de
 * tables qui rendra l'ajout de Sokhna trivial — l'onglet est un feature flag
 * qui lit prospectMatches.
 * ─────────────────────────────────────────────────────────────────────── */

export const sourcedProspects = pgTable('sourced_prospects', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone'),
  fullName: text('full_name'),
  sourceUrl: text('source_url'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const prospectMatches = pgTable('prospect_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  prospectId: uuid('prospect_id').notNull()
    .references(() => sourcedProspects.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('offered'),
}, (t) => ({
  unique: uniqueIndex('prospect_matches_idx').on(t.prospectId, t.tenantId),
}))

/* ───────────────────────── Relations ───────────────────────── */

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(agencyUsers),
  contacts: many(contacts),
  properties: many(properties),
  leads: many(leads),
  tickets: many(tickets),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contacts.tenantId], references: [tenants.id] }),
  conversations: many(conversations),
}))

export const leadsRelations = relations(leads, ({ one, many }) => ({
  contact: one(contacts, { fields: [leads.contactId], references: [contacts.id] }),
  visitRequests: many(visitRequests),
}))
