/**
 * Boucle de Coumba (profil `sales`) — routée par routing.ts, appelée par
 * apps/worker/src/inbound-consumer.ts une fois le contact, la conversation
 * et le lead résolus. Ce fichier ne touche jamais WhatsApp directement :
 * il retourne un texte, c'est l'appelant qui l'envoie (et qui applique
 * screenOutbound() AVANT — quatrième couche du §9, voir zones.ts).
 *
 * Le modèle ne crée jamais de lead ni de conversation : on lui donne leurs
 * id déjà résolus dans le prompt, il ne fait qu'appeler des outils dessus.
 */
import {
  createEscalation, createVisitRequestRow, getProperty, searchPublishedProperties,
  updateLeadQualification, type LeadQualificationInput,
} from '@codaya/db'
import { readAgencyInfo } from './agency.js'
import { runAgentLoop, type AgentTurnResult } from './agent-loop.js'
import { FIRST_MESSAGE_RULE } from './introductions.js'
import { SALES_TOOLS } from './tools.js'
import { renderZonePrompt } from './zones.js'

interface TenantContext {
  id: string
  name: string | null
  disclosureLevel: string
  bookingUrlRental: string | null
  bookingUrlSale: string | null
  splitBookingLinks: boolean
}

interface ContactContext {
  fullName: string | null
  declaredCity: string | null
}

interface LeadContext {
  intent: string
  propertyType: string
  zone: string | null
  budgetAmount: number | null
  timeline: string
  notes: string | null
}

export interface SalesTurnInput {
  tenant: TenantContext
  contact: ContactContext
  lead: LeadContext
  conversationId: string
  leadId: string
  /** Repli pour le tout premier tour d'une conversation (agentState encore vide). */
  history: { direction: 'inbound' | 'outbound'; body: string | null }[]
  /** Trace brute persistée du tour précédent — voir conversations.agentState
   *  dans schema.ts. Prioritaire sur `history` dès qu'elle existe. */
  priorState: unknown
  userMessage: string
  /** Premier message de la conversation : la présentation est envoyée par le
   *  code (introductions.ts), Coumba ne doit pas la doubler. */
  isFirstMessage: boolean
}

export type SalesTurnResult = AgentTurnResult

function describeLead(lead: LeadContext): string | null {
  const facts = [
    lead.intent !== 'to_qualify' ? `intention=${lead.intent}` : null,
    lead.propertyType !== 'to_qualify' ? `type de bien=${lead.propertyType}` : null,
    lead.zone ? `zone=${lead.zone}` : null,
    lead.budgetAmount != null ? `budget=${lead.budgetAmount} XOF` : null,
    lead.timeline !== 'to_qualify' ? `délai=${lead.timeline}` : null,
    lead.notes ? `notes=${lead.notes}` : null,
  ].filter(Boolean)
  return facts.length ? facts.join(', ') : null
}

function buildSystemPrompt(
  tenant: TenantContext,
  contact: ContactContext,
  lead: LeadContext,
  leadId: string,
  isFirstMessage: boolean,
): string {
  const knownContact = [
    contact.fullName ? `Nom déclaré : ${contact.fullName}.` : null,
    contact.declaredCity ? `Ville déclarée : ${contact.declaredCity}.` : null,
  ].filter(Boolean).join(' ')
  const knownLead = describeLead(lead)

  return [
    tenant.name?.trim()
      ? `Tu es Coumba, chargée de clientèle de ${tenant.name.trim()}, une agence immobilière `
        + 'sénégalaise qui échange avec ses clients sur WhatsApp, y compris la diaspora.'
      // Sans nom renseigné, le modèle en inventerait un plausible : on le lui interdit.
      : "Tu es Coumba, chargée de clientèle d'une agence immobilière sénégalaise qui échange "
        + 'avec ses clients sur WhatsApp, y compris la diaspora. Le nom de l\'agence ne t\'a pas '
        + "été communiqué : ne cite JAMAIS de nom d'agence, dis « l'agence » ou « nous ».",
    'Tu écris toujours en français, un ton professionnel et chaleureux, des messages courts (WhatsApp, pas un email).',
    isFirstMessage ? FIRST_MESSAGE_RULE : '',
    'Tu vouvoies TOUJOURS le client — jamais de tutoiement, même si lui te tutoie, et même si '
    + "des messages précédents DANS CETTE CONVERSATION utilisaient le tutoiement par erreur : "
    + "ne reproduis pas ce style passé, corrige-toi dès ce message (« vous avez », « vous pouvez », "
    + 'jamais « tu as », « tu peux »).',
    '',
    `L'identifiant du lead pour cette conversation est ${leadId} — utilise-le tel quel `
    + 'dans save_qualification et offer_visit, ne le redemande jamais au client.',
    knownContact ? `Ce qu'on sait déjà du contact : ${knownContact}` : "Rien n'est encore connu de ce contact.",
    knownLead
      ? `Ce qui est DÉJÀ enregistré pour ce lead, à ne JAMAIS redemander : ${knownLead}.`
      : "Rien n'est encore qualifié pour ce lead.",
    "Avant de poser une question, relis l'historique ET la ligne ci-dessus : si la réponse y figure déjà "
    + "(même formulée autrement, même dans un message précédent), ne la repose pas — utilise-la directement.",
    '',
    'Appelle save_qualification dès qu\'un fait est révélé, pas seulement à la fin. '
    + 'Ne redemande jamais un champ déjà connu.',
    'Toute affirmation sur un bien vient de search_properties ou get_property — jamais '
    + "de mémoire ou d'invention. Si l'outil ne renvoie rien, dis-le simplement. "
    + "Un prospect nomme presque toujours un QUARTIER (Mermoz, Plateau…) : passe-le en "
    + 'district, pas en city — city est la ville elle-même (Dakar), rarement ce que dit le client.',
    "Quand tu détailles un bien précis (get_property) et que listing_url existe, "
    + "partage-le systématiquement à la fin, genre « Tu as plus de détails et des photos sur "
    + "l'annonce ici : [lien] ». Jamais de lien si listing_url est vide.",
    "Il n'y a PAS de message suivant automatique : si tu dis « laisse-moi vérifier » ou "
    + "toute formule d'attente, le client n'aura jamais la réponse. Interdiction de promettre "
    + 'une vérification sans la faire tout de suite : appelle l\'outil nécessaire dans ce même '
    + "tour, puis réponds avec le résultat réel — une seule réponse, jamais « je reviens vers toi ».",
    "Si tu n'as rien à envoyer (pas de lien d'annonce, pas de bien correspondant…), tu ne "
    + "proposes JAMAIS, même comme option secondaire parmi d'autres, que le client appelle "
    + "l'agence lui-même — zéro exception, zéro formulation de type « tu peux aussi… », "
    + "« ou sinon... » qui y mène. La seule option que tu donnes est une visite via "
    + 'offer_visit : si elle renvoie "callback", dis simplement qu\'un conseiller de '
    + "l'agence va le·la rappeler très vite (jamais d'heure précise) — c'est TOUJOURS "
    + "l'agence qui recontacte le client, jamais l'inverse.",
    '',
    renderZonePrompt(tenant.disclosureLevel as 'listing_only' | 'neighbourhood'),
  ].filter(Boolean).join('\n')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Le modèle peut halluciner un property_id plausible (slug, référence…) —
 *  interroger Postgres avec ça plante la requête entière plutôt que de
 *  renvoyer un résultat vide. On le filtre avant, jamais après. */
function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { tenantId: string; conversationId: string; leadId: string; tenant: TenantContext },
): Promise<unknown> {
  switch (name) {
    case 'save_qualification': {
      const patch: LeadQualificationInput = {}
      if (typeof input.intent === 'string') patch.intent = input.intent as LeadQualificationInput['intent']
      if (typeof input.property_type === 'string') {
        patch.propertyType = input.property_type as LeadQualificationInput['propertyType']
      }
      if (typeof input.zone === 'string') patch.zone = input.zone
      if (typeof input.budget_amount === 'number') patch.budgetAmount = input.budget_amount
      if (typeof input.timeline === 'string') patch.timeline = input.timeline as LeadQualificationInput['timeline']
      if (typeof input.notes === 'string') patch.notes = input.notes
      await updateLeadQualification(ctx.tenantId, ctx.leadId, patch)
      return { ok: true }
    }

    case 'search_properties': {
      const rows = await searchPublishedProperties(ctx.tenantId, {
        transaction: input.transaction as 'sale' | 'long_term_rental' | 'short_term_rental' | undefined,
        type: input.type as 'apartment' | 'villa' | 'land' | 'commercial' | undefined,
        city: input.city as string | undefined,
        district: input.district as string | undefined,
        maxPrice: input.max_price as number | undefined,
      })
      return {
        properties: rows.map((p) => ({
          id: p.id, title: p.title, city: p.city, district: p.district,
          price: p.price, transaction: p.transaction, type: p.type,
        })),
      }
    }

    case 'get_property': {
      if (!isValidUuid(input.property_id)) return { error: 'not_found' }
      const property = await getProperty(ctx.tenantId, input.property_id)
      if (!property || property.status !== 'published') return { error: 'not_found' }
      return {
        id: property.id, title: property.title, price: property.price,
        transaction: property.transaction, type: property.type, typology: property.typology,
        city: property.city, district: property.district, areaSqm: property.areaSqm,
        rooms: property.rooms, bedrooms: property.bedrooms, bathrooms: property.bathrooms,
        amenities: property.amenities, services: property.services, notes: property.notes,
        listing_url: property.listingUrl,
      }
    }

    case 'offer_visit': {
      const propertyId = isValidUuid(input.property_id) ? input.property_id : null
      const intent = input.intent as 'purchase' | 'rental'
      const tenant = ctx.tenant
      const url = intent === 'purchase'
        ? (tenant.splitBookingLinks ? tenant.bookingUrlSale : tenant.bookingUrlRental)
        : tenant.bookingUrlRental
      const mode = url ? 'link_sent' as const : 'callback_announced' as const
      await createVisitRequestRow(ctx.tenantId, ctx.leadId, propertyId, intent, mode, url)
      if (!url) {
        // Pas de lien configuré pour cette agence : CLAUDE.md « elle annonce qu'un
        // conseiller rappellera, ET ELLE ESCALADE » — fait ici plutôt que confié au
        // modèle, pour ne pas dépendre d'un deuxième appel d'outil qu'il oublierait.
        await createEscalation(
          ctx.tenantId, ctx.conversationId,
          "Aucun lien de prise de rendez-vous configuré pour cette agence — rappel à faire.",
          'no_progress',
        )
      }
      return url ? { mode: 'link', url } : { mode: 'callback' }
    }

    case 'get_agency_info':
      return readAgencyInfo(ctx.tenantId)

    case 'escalate_to_human': {
      await createEscalation(
        ctx.tenantId, ctx.conversationId,
        typeof input.reason === 'string' ? input.reason : 'raison non précisée',
        typeof input.trigger === 'string' ? input.trigger : 'user_asked',
      )
      return { ok: true }
    }

    default:
      return { error: `outil inconnu : ${name}` }
  }
}

export async function runSalesTurn(params: SalesTurnInput): Promise<SalesTurnResult> {
  const ctx = {
    tenantId: params.tenant.id,
    conversationId: params.conversationId,
    leadId: params.leadId,
    tenant: params.tenant,
  }
  return runAgentLoop({
    tenantId: ctx.tenantId,
    conversationId: ctx.conversationId,
    system: buildSystemPrompt(params.tenant, params.contact, params.lead, params.leadId, params.isFirstMessage),
    tools: SALES_TOOLS,
    history: params.history,
    priorState: params.priorState,
    userMessage: params.userMessage,
    executeTool: (name, input) => executeTool(name, input, ctx),
  })
}
