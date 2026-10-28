/**
 * Requêtes de lecture partagées.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  TOUTE requête de lecture vit ici, jamais dans un composant      │
 * │  Next.js. Le tableau de bord et les outils exposés au modèle ont │
 * │  besoin exactement des mêmes. Écrites une fois, bornées par      │
 * │  tenantId, elles servent aux deux — et rendront l'assistante de  │
 * │  direction (Adja) presque gratuite le jour où on la construira.  │
 * │                                                                  │
 * │  Éparpillées dans les pages, tout serait à réécrire.             │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * Règle de sécurité non négociable : `tenantId` est un PARAMÈTRE, injecté
 * par le code appelant depuis la session ou depuis le numéro qui écrit.
 * Il n'est jamais déduit du contenu d'un message. Un dirigeant ne doit
 * pouvoir obtenir aucune information sur une autre agence, ni par une
 * question directe, ni par une formulation détournée, ni par accident.
 *
 * Et le modèle n'écrit jamais de requête : il appelle ces fonctions à
 * travers des outils à paramètres fermés.
 */

import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import { db } from './client.js'
import {
  agencyUsers, contacts, conversations, leads, listingImportJobs, messageMedia, messages, properties, tenantLogos,
  tenants, tickets, visitRequests, whatsappAccounts,
} from './schema.js'

type TenantId = string

/* ───────────────────────── Tenant ───────────────────────── */

/** Sert notamment à savoir si Malick est actif (plan `complete` uniquement). */
export async function getTenant(tenantId: TenantId) {
  const [row] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  return row ?? null
}

/** Une agence n'a accès (connexion, réponses des agents) que si elle n'est
 *  pas désactivée ET que sa date de fin d'accès n'est pas passée. Seule
 *  source de cette règle : la connexion, les sessions et le worker l'appellent. */
export function tenantAccess(
  tenant: { disabledAt: Date | null; untilAt: Date },
  now = new Date(),
): 'active' | 'disabled' | 'expired' {
  if (tenant.disabledAt) return 'disabled'
  if (tenant.untilAt <= now) return 'expired'
  return 'active'
}

export async function getTenantLogo(tenantId: TenantId) {
  const [row] = await db.select().from(tenantLogos).where(eq(tenantLogos.tenantId, tenantId)).limit(1)
  return row ?? null
}

/* ───────────────────────── Leads ───────────────────────── */

export async function listLeads(tenantId: TenantId, opts: {
  limit?: number
  offset?: number
} = {}) {
  return db.select()
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
    .orderBy(desc(leads.createdAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
}

export async function getLead(tenantId: TenantId, leadId: string) {
  const [row] = await db.select()
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
    .limit(1)
  return row ?? null
}

/** Nom et téléphone vivent sur `contacts`, jamais dupliqués sur `leads`. */
export async function getLeadWithContact(tenantId: TenantId, leadId: string) {
  const [row] = await db.select({ lead: leads, contact: contacts })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .where(and(eq(leads.tenantId, tenantId), eq(leads.id, leadId)))
    .limit(1)
  return row ?? null
}

/** Même jointure que getLeadWithContact, pour la page de liste. */
export async function listLeadsWithContact(tenantId: TenantId, opts: {
  sort?: 'recent' | 'old'
  limit?: number
  offset?: number
} = {}) {
  return db.select({ lead: leads, contact: contacts })
    .from(leads)
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .where(eq(leads.tenantId, tenantId))
    .orderBy(opts.sort === 'old' ? leads.createdAt : desc(leads.createdAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
}

export async function countLeads(tenantId: TenantId) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
  return row?.n ?? 0
}

/**
 * TODO — « les meilleurs leads » suppose une heuristique de score qui
 * n'est pas définie. Tant qu'elle ne l'est pas, on trie par date : c'est
 * moins utile, mais c'est vrai. Ne pas inventer une formule pour pouvoir
 * trier ; un score inventé ne survivrait pas à la question « d'où il
 * sort ? », et il piloterait le tri par défaut et le badge « lead chaud ».
 */
export async function listHotLeads(_tenantId: TenantId, _minScore: number) {
  throw new Error(
    'Heuristique de score non définie — voir CLAUDE.md, « Ce qui n\'est pas décidé ».',
  )
}

/** Leads dont le dernier message est entrant : personne n'a repris la main. */
export async function countAwaitingReply(tenantId: TenantId) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(
      eq(conversations.tenantId, tenantId),
      isNull(conversations.handedOverAt),
      isNull(conversations.closedAt),
    ))
  return row?.n ?? 0
}

/* ───────────────────────── Catalogue ───────────────────────── */

/**
 * Ne renvoie que les biens publiés. Un bien dépublié n'existe pas pour
 * Coumba — c'est ce qui rend l'interrupteur de publication réellement
 * efficace, et pas seulement décoratif.
 */
/** Motif ILIKE « contient » ; % et _ saisis par le modèle restent littéraux. */
function containsPattern(value: string): string {
  return `%${value.trim().replace(/[\\%_]/g, '\\$&')}%`
}

export async function searchPublishedProperties(tenantId: TenantId, criteria: {
  transaction?: 'sale' | 'long_term_rental' | 'short_term_rental'
  type?: 'apartment' | 'villa' | 'land' | 'commercial'
  city?: string
  district?: string
  maxPrice?: number
  limit?: number
} = {}) {
  const conds = [
    eq(properties.tenantId, tenantId),
    eq(properties.status, 'published'),
  ]
  if (criteria.transaction) conds.push(eq(properties.transaction, criteria.transaction))
  if (criteria.type) conds.push(eq(properties.type, criteria.type))
  // ilike : un prospect écrit « mermoz » ou « Mermoz », et confond souvent
  // quartier et ville — une correspondance exacte sur la casse a déjà
  // produit un faux « rien de publié » sur un bien qui existait.
  // Et « contient », pas « égal » : le prospect écrit « Keur Gorgui », la
  // fiche dit « Cité Keur Gorgui » — l'égalité stricte a fait répondre à
  // Coumba qu'il n'y avait rien, devant un prospect, sur deux biens publiés.
  if (criteria.city) conds.push(ilike(properties.city, containsPattern(criteria.city)))
  if (criteria.district) conds.push(ilike(properties.district, containsPattern(criteria.district)))
  // Tolérance de 20 % au-dessus du budget annoncé : un bien légèrement plus
  // cher reste une option à proposer honnêtement (avec son vrai prix), plutôt
  // que de renvoyer « rien trouvé » et pousser le modèle à improviser un chiffre.
  // Borne incluse : les loyers sont des chiffres ronds, budget 1 000 000 et
  // loyer 1 200 000 tombent pile dessus — exclus, le bien disparaissait.
  if (criteria.maxPrice) conds.push(lte(properties.price, Math.round(criteria.maxPrice * 1.2)))

  return db.select().from(properties).where(and(...conds)).limit(criteria.limit ?? 5)
}

export async function getProperty(tenantId: TenantId, propertyId: string) {
  const [row] = await db.select()
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.id, propertyId)))
    .limit(1)
  return row ?? null
}

/** Montants qu'un message sortant a le droit de citer — tout le reste est
 *  une négociation ou une invention. Voir screenOutbound() dans
 *  packages/agent/src/zones.ts, quatrième couche du §9. */
export async function listPublishedPrices(tenantId: TenantId): Promise<number[]> {
  const rows = await db.select({ price: properties.price })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), eq(properties.status, 'published')))
  return rows.map((r) => r.price).filter((p): p is number => p != null)
}

/** Biens publiés sans lien d'annonce : Coumba peut les décrire, pas les envoyer. */
export async function listPublishedWithoutLink(tenantId: TenantId) {
  return db.select()
    .from(properties)
    .where(and(
      eq(properties.tenantId, tenantId),
      eq(properties.status, 'published'),
      isNull(properties.listingUrl),
    ))
}

/**
 * Catalogue complet — publiés ET dépubliés. Pour l'équipe de l'agence, pas
 * pour Coumba : elle n'utilise que searchPublishedProperties(), un bien
 * dépublié n'existe pas pour elle.
 */
/** 'rental' regroupe les deux enums de location : le filtre de la liste ne
 *  distingue pas longue/courte durée, seulement vente/location/à confirmer. */
function propertyCategoryCondition(category?: 'sale' | 'rental' | 'todo') {
  if (category === 'sale') return eq(properties.transaction, 'sale')
  if (category === 'rental') {
    return sql`${properties.transaction} in ('long_term_rental', 'short_term_rental')`
  }
  if (category === 'todo') return sql`array_length(${properties.fieldsToConfirm}, 1) > 0`
  return undefined
}

export async function listProperties(tenantId: TenantId, opts: {
  category?: 'sale' | 'rental' | 'todo'
  limit?: number
  offset?: number
} = {}) {
  const conds = [eq(properties.tenantId, tenantId)]
  const categoryCond = propertyCategoryCondition(opts.category)
  if (categoryCond) conds.push(categoryCond)

  return db.select().from(properties)
    .where(and(...conds))
    .orderBy(desc(properties.createdAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
}

export async function countProperties(tenantId: TenantId, opts: {
  category?: 'sale' | 'rental' | 'todo'
} = {}) {
  const conds = [eq(properties.tenantId, tenantId)]
  const categoryCond = propertyCategoryCondition(opts.category)
  if (categoryCond) conds.push(categoryCond)

  const [row] = await db.select({ n: sql<number>`count(*)::int` })
    .from(properties)
    .where(and(...conds))
  return row?.n ?? 0
}

/** Pour la présentation d'Amadou : total, part importée depuis une URL, et
 *  nombre de CHAMPS (pas de biens) qui restent à confirmer. */
export async function getCatalogueSummary(tenantId: TenantId) {
  const [row] = await db.select({
    total: sql<number>`count(*)::int`,
    importedFromUrl: sql<number>`count(*) filter (where ${properties.source} = 'url')::int`,
    fieldsToConfirmCount: sql<number>`coalesce(sum(coalesce(array_length(${properties.fieldsToConfirm}, 1), 0)), 0)::int`,
  })
    .from(properties)
    .where(eq(properties.tenantId, tenantId))
  return row ?? { total: 0, importedFromUrl: 0, fieldsToConfirmCount: 0 }
}

/** Poll côté tableau de bord pendant que le worker lit l'annonce en tâche de fond. */
export async function getListingImportJob(tenantId: TenantId, jobId: string) {
  const [row] = await db.select().from(listingImportJobs)
    .where(and(eq(listingImportJobs.tenantId, tenantId), eq(listingImportJobs.id, jobId)))
    .limit(1)
  return row ?? null
}

/* ───────────────────────── Dossiers ───────────────────────── */

export async function listOpenTickets(tenantId: TenantId) {
  return db.select()
    .from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.status, 'open')))
    .orderBy(desc(tickets.createdAt))
}

/** Les dossiers qui méritent une notification, pas une ligne dans une liste. */
export async function listUrgentTickets(tenantId: TenantId) {
  return db.select()
    .from(tickets)
    .where(and(
      eq(tickets.tenantId, tenantId),
      eq(tickets.status, 'open'),
      // Le niveau affiché : le forçage de l'agence prime sur le calcul.
      sql`coalesce(${tickets.urgencyForced}, ${tickets.urgency}) in ('safety', 'urgent')`,
    ))
    .orderBy(desc(tickets.createdAt))
}

/** Même liste que listUrgentTickets, avec le contact — pour l'affichage. */
export async function listUrgentTicketsWithContact(tenantId: TenantId) {
  return db.select({ ticket: tickets, contact: contacts })
    .from(tickets)
    .innerJoin(contacts, eq(tickets.contactId, contacts.id))
    .where(and(
      eq(tickets.tenantId, tenantId),
      eq(tickets.status, 'open'),
      // Le niveau affiché : le forçage de l'agence prime sur le calcul.
      sql`coalesce(${tickets.urgencyForced}, ${tickets.urgency}) in ('safety', 'urgent')`,
    ))
    .orderBy(desc(tickets.createdAt))
}

export async function getTicket(tenantId: TenantId, ticketId: string) {
  const [row] = await db.select()
    .from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
    .limit(1)
  return row ?? null
}

/** Nom et téléphone du locataire vivent sur `contacts`, jamais dupliqués sur `tickets`. */
export async function getTicketWithContact(tenantId: TenantId, ticketId: string) {
  const [row] = await db.select({ ticket: tickets, contact: contacts })
    .from(tickets)
    .innerJoin(contacts, eq(tickets.contactId, contacts.id))
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.id, ticketId)))
    .limit(1)
  return row ?? null
}

/** Même jointure que getTicketWithContact, pour la page de liste. */
export async function listTicketsWithContact(tenantId: TenantId, opts: {
  status?: 'open' | 'resolved'
  limit?: number
  offset?: number
} = {}) {
  const conds = [eq(tickets.tenantId, tenantId)]
  if (opts.status) conds.push(eq(tickets.status, opts.status))

  return db.select({ ticket: tickets, contact: contacts })
    .from(tickets)
    .innerJoin(contacts, eq(tickets.contactId, contacts.id))
    .where(and(...conds))
    .orderBy(desc(tickets.createdAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
}

export async function countTickets(tenantId: TenantId, opts: { status?: 'open' | 'resolved' } = {}) {
  const conds = [eq(tickets.tenantId, tenantId)]
  if (opts.status) conds.push(eq(tickets.status, opts.status))

  const [row] = await db.select({ n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(...conds))
  return row?.n ?? 0
}

/** Répartition des dossiers par nature sur une période — jamais une
 *  estimation, un pourcentage calculé sur les dossiers réellement ouverts. */
export async function getTicketNatureBreakdown(tenantId: TenantId, since: Date) {
  const rows = await db.select({ nature: tickets.nature, n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), gte(tickets.createdAt, since)))
    .groupBy(tickets.nature)
  const total = rows.reduce((sum, r) => sum + r.n, 0)
  return rows
    .map((r) => ({ nature: r.nature, count: r.n, pct: total ? Math.round((r.n / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
}

/* ───────────────────────── Conversations ───────────────────────── */

/**
 * Fil unifié leads + dossiers, trié par date — vue « Conversations » du
 * menu. Fusionné en JS plutôt qu'en SQL : les deux tables n'ont pas la
 * même forme, et le volume d'une agence reste petit.
 */
export async function listConversationsFeed(tenantId: TenantId, opts: {
  kind?: 'lead' | 'ticket'
  sort?: 'recent' | 'old'
  limit?: number
  offset?: number
} = {}) {
  const limit = opts.limit ?? 12
  const offset = opts.offset ?? 0

  // Tri et pagination EN BASE : une union légère (type, id, date) dont on ne
  // lit que la page demandée. L'ancienne version chargeait tous les leads et
  // tous les dossiers de l'agence en mémoire pour en garder douze.
  const leadPart = db.select({ kind: sql<'lead' | 'ticket'>`'lead'`.as('kind'), id: leads.id, createdAt: leads.createdAt })
    .from(leads).where(eq(leads.tenantId, tenantId))
  const ticketPart = db.select({ kind: sql<'lead' | 'ticket'>`'ticket'`.as('kind'), id: tickets.id, createdAt: tickets.createdAt })
    .from(tickets).where(eq(tickets.tenantId, tenantId))
  const source = opts.kind === 'lead' ? leadPart : opts.kind === 'ticket' ? ticketPart : leadPart.unionAll(ticketPart)

  const direction = opts.sort === 'old' ? sql`asc` : sql`desc`
  const [page, total] = await Promise.all([
    db.select().from(source.as('feed'))
      .orderBy(sql`created_at ${direction}, id ${direction}`)
      .limit(limit)
      .offset(offset),
    Promise.all([
      opts.kind === 'ticket' ? 0 : countLeads(tenantId),
      opts.kind === 'lead' ? 0 : countTickets(tenantId),
    ]).then(([a, b]) => a + b),
  ])

  // Le détail des seules lignes de la page (au plus `limit`).
  const leadIds = page.filter((r) => r.kind === 'lead').map((r) => r.id)
  const ticketIds = page.filter((r) => r.kind === 'ticket').map((r) => r.id)
  const [leadRows, ticketRows] = await Promise.all([
    leadIds.length
      ? db.select({ lead: leads, contact: contacts }).from(leads)
        .innerJoin(contacts, eq(leads.contactId, contacts.id))
        .where(and(eq(leads.tenantId, tenantId), inArray(leads.id, leadIds)))
      : [],
    ticketIds.length
      ? db.select({ ticket: tickets, contact: contacts }).from(tickets)
        .innerJoin(contacts, eq(tickets.contactId, contacts.id))
        .where(and(eq(tickets.tenantId, tenantId), inArray(tickets.id, ticketIds)))
      : [],
  ])
  const leadById = new Map(leadRows.map((r) => [r.lead.id, r]))
  const ticketById = new Map(ticketRows.map((r) => [r.ticket.id, r]))

  type Contact = typeof contacts.$inferSelect
  type FeedItem =
    | { kind: 'lead'; id: string; contact: Contact; createdAt: Date; lead: typeof leads.$inferSelect }
    | { kind: 'ticket'; id: string; contact: Contact; createdAt: Date; ticket: typeof tickets.$inferSelect }
  const items = page.flatMap((r): FeedItem[] => {
    if (r.kind === 'lead') {
      const row = leadById.get(r.id)
      return row ? [{ kind: 'lead' as const, id: r.id, contact: row.contact, createdAt: row.lead.createdAt, lead: row.lead }] : []
    }
    const row = ticketById.get(r.id)
    return row ? [{ kind: 'ticket' as const, id: r.id, contact: row.contact, createdAt: row.ticket.createdAt, ticket: row.ticket }] : []
  })
  return { items, total }
}

/* ───────────────────────── Demandes de visite ───────────────────────── */

export async function listVisitRequests(tenantId: TenantId, opts: {
  limit?: number; offset?: number
} = {}) {
  return db.select()
    .from(visitRequests)
    .where(eq(visitRequests.tenantId, tenantId))
    .orderBy(desc(visitRequests.createdAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
}

/**
 * Pour l'affichage : le contact du lead (jointure obligatoire, un lead a
 * toujours un contact) et le bien visé (jointure optionnelle — `propertyId`
 * peut être vide, ou pointer vers un bien depuis retiré).
 */
export async function listVisitRequestsWithDetails(tenantId: TenantId, opts: {
  limit?: number; offset?: number
} = {}) {
  return db.select({ visitRequest: visitRequests, contact: contacts, property: properties })
    .from(visitRequests)
    .innerJoin(leads, eq(visitRequests.leadId, leads.id))
    .innerJoin(contacts, eq(leads.contactId, contacts.id))
    .leftJoin(properties, eq(visitRequests.propertyId, properties.id))
    .where(eq(visitRequests.tenantId, tenantId))
    .orderBy(desc(visitRequests.createdAt))
    .limit(opts.limit ?? 12)
    .offset(opts.offset ?? 0)
}

export async function countVisitRequests(tenantId: TenantId) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` })
    .from(visitRequests)
    .where(eq(visitRequests.tenantId, tenantId))
  return row?.n ?? 0
}

/* ───────────────────────── Routage ───────────────────────── */

/**
 * SEULE exception à la règle « tenantId est un paramètre, jamais déduit » :
 * c'est justement la fonction qui déduit le tenant, à partir du
 * `phone_number_id` du payload Meta — la clé de tenant du webhook, et
 * nulle part ailleurs (CLAUDE.md). Pas de tenantId à ce stade : c'est ce
 * qu'on cherche.
 */
export async function getWhatsappAccountByPhoneNumberId(phoneNumberId: string) {
  const [row] = await db.select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, phoneNumberId))
    .limit(1)
  return row ?? null
}

/** Ici tenantId est un paramètre normal (déjà connu de la session du tableau
 *  de bord) — contrairement à getWhatsappAccountByPhoneNumberId ci-dessus,
 *  qui sert justement à le déduire depuis un webhook. */
export async function getWhatsappAccountByTenant(tenantId: TenantId) {
  const [row] = await db.select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.tenantId, tenantId))
    .limit(1)
  return row ?? null
}

/** Le numéro figure-t-il dans agency_users de ce tenant ? Première branche du routage. */
/** Numéros administrateurs (page « Mes paramètres ») — ceux que le routage
 *  envoie vers le profil `assistant` au lieu de Coumba. */
export async function listAgencyUsers(tenantId: TenantId) {
  // Colonnes choisies : jamais l'empreinte du mot de passe vers une page.
  return db.select({
    id: agencyUsers.id,
    fullName: agencyUsers.fullName,
    whatsappNumber: agencyUsers.whatsappNumber,
    canLogIn: sql<boolean>`${agencyUsers.passwordHash} is not null`,
  })
    .from(agencyUsers)
    .where(eq(agencyUsers.tenantId, tenantId))
    .orderBy(agencyUsers.createdAt)
}

export async function getAgencyUserByWhatsapp(tenantId: TenantId, whatsappNumber: string) {
  const [row] = await db.select()
    .from(agencyUsers)
    .where(and(eq(agencyUsers.tenantId, tenantId), eq(agencyUsers.whatsappNumber, whatsappNumber)))
    .limit(1)
  return row ?? null
}

export async function findContactByWaId(tenantId: TenantId, waId: string) {
  const [row] = await db.select()
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.waId, waId)))
    .limit(1)
  return row ?? null
}

/* ───────────────────────── Activité ───────────────────────── */

/**
 * Compteurs du tableau de bord. Chaque valeur vient d'un champ qu'on
 * possède réellement — aucune estimation, aucune moyenne reconstituée.
 * Le jour où un patron d'agence demande d'où sort un chiffre, on doit
 * pouvoir montrer la colonne. C'est pour ça qu'il n'y a pas de « temps de
 * réponse moyen » ici : on ne trace pas encore l'horodatage nécessaire
 * pour le calculer honnêtement.
 */
/**
 * Temps de réponse réel, jour par jour : pour chaque message entrant, le
 * délai jusqu'au premier message sortant qui suit dans la même
 * conversation. Calculé depuis `messages.sentAt`, jamais estimé — un jour
 * sans messages renvoie `null`, pas zéro (zéro affirmerait une réponse
 * instantanée qui n'a pas eu lieu).
 */
export async function getResponseTimesByDay(tenantId: TenantId, since: Date) {
  const rows = await db.select({
    conversationId: messages.conversationId,
    direction: messages.direction,
    sentAt: messages.sentAt,
  })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), gte(messages.sentAt, since)))
    .orderBy(messages.conversationId, messages.sentAt)

  const byDay = new Map<string, number[]>()
  let pendingInboundAt: Date | null = null
  let lastConversationId: string | null = null

  for (const m of rows) {
    if (m.conversationId !== lastConversationId) {
      pendingInboundAt = null
      lastConversationId = m.conversationId
    }
    if (m.direction === 'inbound') {
      if (!pendingInboundAt) pendingInboundAt = m.sentAt
    } else if (pendingInboundAt) {
      const seconds = (m.sentAt.getTime() - pendingInboundAt.getTime()) / 1000
      const day = pendingInboundAt.toISOString().slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(seconds)
      pendingInboundAt = null
    }
  }

  /* Les 7 barreaux doivent finir aujourd'hui — les construire depuis `since`
   * (un instant précis, pas un début de journée) les faisait finir la
   * veille, coupant tout message reçu aujourd'hui. */
  const days: { day: string; avgSeconds: number | null }[] = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const vals = byDay.get(key)
    days.push({
      day: key,
      avgSeconds: vals && vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    })
  }
  return days
}

/**
 * « En ce moment » — conversations avec un message entrant récent. On ne
 * sait pas CE QUI se passe dans l'échange (pas de compréhension du
 * contenu), seulement QUI parle à QUI et depuis quand : le panneau reste
 * générique plutôt que d'inventer un état précis par conversation.
 */
export async function listRecentActivity(tenantId: TenantId, opts: {
  limit?: number
  sinceHours?: number
} = {}) {
  const since = new Date(Date.now() - (opts.sinceHours ?? 24) * 60 * 60 * 1000)
  return db.select({
    profile: conversations.profile,
    contact: contacts,
    lastInboundAt: conversations.lastInboundAt,
  })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(and(
      eq(conversations.tenantId, tenantId),
      gte(conversations.lastInboundAt, since),
      isNull(conversations.closedAt),
    ))
    .orderBy(desc(conversations.lastInboundAt))
    .limit(opts.limit ?? 4)
}

/**
 * Le fil WhatsApp d'un contact avec un profil donné. Un contact peut avoir
 * plusieurs conversations (une par profil qui lui a parlé), mais jamais
 * deux avec le même profil.
 */
export async function getThreadByContactAndProfile(
  tenantId: TenantId,
  contactId: string,
  profile: 'sales' | 'property_manager' | 'catalogue' | 'assistant',
) {
  const [conversation] = await db.select().from(conversations)
    .where(and(
      eq(conversations.tenantId, tenantId),
      eq(conversations.contactId, contactId),
      eq(conversations.profile, profile),
    ))
    .limit(1)
  if (!conversation) return null

  const thread = await db.select().from(messages)
    .where(eq(messages.conversationId, conversation.id))
    .orderBy(messages.sentAt)

  // Sans le binaire : le fil n'affiche qu'une vignette, servie par /media/:id.
  const media = await db.select({ id: messageMedia.id, messageId: messageMedia.messageId, mimeType: messageMedia.mimeType })
    .from(messageMedia)
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(and(eq(messageMedia.tenantId, tenantId), eq(messages.conversationId, conversation.id)))
    .orderBy(messageMedia.createdAt)

  return {
    conversation,
    messages: thread.map((m) => ({
      ...m,
      media: media.filter((x) => x.messageId === m.id).map(({ id, mimeType }) => ({ id, mimeType })),
    })),
  }
}

/* ───────────────────────── Médias ───────────────────────── */

/** Le binaire d'une photo, borné au tenant de la session — jamais servi par id seul. */
export async function getMedia(tenantId: TenantId, mediaId: string) {
  const [row] = await db.select({ data: messageMedia.data, mimeType: messageMedia.mimeType })
    .from(messageMedia)
    .where(and(eq(messageMedia.tenantId, tenantId), eq(messageMedia.id, mediaId)))
    .limit(1)
  return row?.data ? { data: row.data, mimeType: row.mimeType ?? 'application/octet-stream' } : null
}

/** Toutes les photos jointes à un dossier, sans le binaire. */
export async function listTicketMedia(tenantId: TenantId, ticketId: string) {
  return db.select({ id: messageMedia.id, mimeType: messageMedia.mimeType, sentAt: messages.sentAt })
    .from(messageMedia)
    .innerJoin(messages, eq(messageMedia.messageId, messages.id))
    .where(and(eq(messageMedia.tenantId, tenantId), eq(messageMedia.ticketId, ticketId)))
    .orderBy(messages.sentAt)
}

/** Les dossiers encore ouverts d'un locataire — ce que Malick doit connaître
 *  avant de répondre, pour compléter un dossier plutôt qu'en ouvrir un second. */
export async function listOpenTicketsForContact(tenantId: TenantId, contactId: string) {
  return db.select().from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.contactId, contactId), eq(tickets.status, 'open')))
    .orderBy(desc(tickets.createdAt))
}

/** La demande de visite d'un lead donné, avec le bien visé s'il y en a un. */
export async function getVisitRequestForLead(tenantId: TenantId, leadId: string) {
  const [row] = await db.select({ visitRequest: visitRequests, property: properties })
    .from(visitRequests)
    .leftJoin(properties, eq(visitRequests.propertyId, properties.id))
    .where(and(eq(visitRequests.tenantId, tenantId), eq(visitRequests.leadId, leadId)))
    .orderBy(desc(visitRequests.createdAt))
    .limit(1)
  return row ?? null
}

export async function getActivityCounters(tenantId: TenantId, since: Date) {
  const [msgs] = await db.select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.tenantId, tenantId), gte(messages.sentAt, since)))

  const [newLeads] = await db.select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.tenantId, tenantId), gte(leads.createdAt, since)))

  const [newVisitRequests] = await db.select({ n: sql<number>`count(*)::int` })
    .from(visitRequests)
    .where(and(eq(visitRequests.tenantId, tenantId), gte(visitRequests.createdAt, since)))

  const [openTickets] = await db.select({ n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(eq(tickets.tenantId, tenantId), eq(tickets.status, 'open')))

  const [resolvedSince] = await db.select({ n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(
      eq(tickets.tenantId, tenantId),
      eq(tickets.status, 'resolved'),
      gte(tickets.resolvedAt, since),
    ))

  const byProfile = await db.select({ profile: conversations.profile, n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, since)))
    .groupBy(conversations.profile)

  return {
    messages: msgs?.n ?? 0,
    newLeads: newLeads?.n ?? 0,
    newVisitRequests: newVisitRequests?.n ?? 0,
    openTickets: openTickets?.n ?? 0,
    resolvedTicketsSince: resolvedSince?.n ?? 0,
    conversationsByProfile: Object.fromEntries(byProfile.map((r) => [r.profile, r.n])) as
      Partial<Record<'sales' | 'property_manager' | 'catalogue' | 'assistant', number>>,
  }
}
