/**
 * Boucle de Malick (profil `property_manager`, régisseur) — routée par
 * routing.ts pour un locataire connu d'une agence en plan `complete`,
 * appelée par apps/worker/src/inbound-consumer.ts.
 *
 * Son métier : ouvrir un dossier dès qu'il a le minimum (le bien, dans les
 * mots du locataire, et le problème — le numéro est déjà connu), puis
 * établir les quatre faits fermés du §3. Il ne juge JAMAIS l'urgence :
 * computeUrgency() la calcule ici, en code, à chaque nouveau fait.
 *
 * Le modèle ne nomme ni le tenant ni le contact : ils sont injectés. Un
 * `ticket_id` fourni par le modèle n'est accepté que s'il désigne un dossier
 * ouvert DE CE locataire.
 */
import {
  attachPendingMediaToTicket, createEscalation, createTicket, listOpenTicketsForContact,
  updateTicketFacts, type TicketFactsInput,
} from '@codaya/db'
import { runAgentLoop, type AgentTurnResult } from './agent-loop.js'
import { PROPERTY_MANAGER_TOOLS } from './tools.js'
import { computeUrgency } from './urgency.js'
import { FIRST_MESSAGE_RULE } from './introductions.js'
import { renderPropertyManagerZonePrompt } from './zones.js'

/** La réponse DEMANDE-t-elle de quel logement il s'agit ? Une phrase
 *  interrogative qui en parle — pas une simple mention (« je note bien :
 *  Résidence Keur Gorgui » a trompé une première version de ce filet). */
const PROPERTY_WORDS = /\b(bien|adresse|résidence|logement|appartement|appart|immeuble|villa|maison|quartier|habitez|louez)\b/i
function asksForProperty(text: string): boolean {
  return (text.match(/[^.!?\n]*\?/g) ?? []).some((q) => PROPERTY_WORDS.test(q))
}

/** Consigne commune aux relances internes : elles ne doivent jamais transparaître
 *  dans le message au locataire (« j'ai relu l'historique… » est arrivé). */
const NUDGE_SUFFIX = ' Cette consigne est interne : ne la mentionne jamais. Ta réponse s\'adresse '
  + 'directement au locataire, comme si de rien n\'était.'

const FACT_KEYS = ['habitable', 'utilityCut', 'safetyRisk', 'worsening'] as const

type SafetyReasonCode = 'gas_leak' | 'fire' | 'flooding' | 'dangerous_electrical' | 'injury'

/** Ce que lit l'agence sur le badge : « Sécurité · odeur de gaz ». */
export const SAFETY_REASON_LABELS: Record<SafetyReasonCode, string> = {
  gas_leak: 'odeur de gaz',
  fire: 'feu ou fumée',
  flooding: 'inondation en cours',
  dangerous_electrical: 'installation électrique dangereuse',
  injury: 'personne blessée',
}

const NATURES = ['plumbing', 'electricity', 'air_conditioning', 'locksmith', 'gas', 'admin', 'other'] as const

/** Dossiers auxquels un danger peut se rattacher : il doit en être le
 *  problème. Arrivé en test : une odeur de gaz greffée sur un dossier de VMC
 *  (nature `other`) — le dossier affichait « Sécurité · odeur de gaz » et le
 *  gaz n'avait pas de dossier à lui. null : toute nature (une blessure peut
 *  venir de n'importe quel problème). */
const SAFETY_COMPATIBLE_NATURES: Record<SafetyReasonCode, readonly string[] | null> = {
  gas_leak: ['gas'],
  fire: ['gas', 'electricity'],
  flooding: ['plumbing'],
  dangerous_electrical: ['electricity'],
  injury: null,
}

export function isSafetyCompatible(code: SafetyReasonCode, nature: string): boolean {
  const compatible = SAFETY_COMPATIBLE_NATURES[code]
  return compatible === null || compatible.includes(nature)
}
const HABITABLE = ['yes', 'no', 'partly'] as const
const UTILITY_CUT = ['none', 'water', 'power', 'water_and_power'] as const

type Nature = typeof NATURES[number]

export interface EmergencyNumber { label: string; number: string }

export interface OpenTicketContext {
  id: string
  reference: string
  subjectAsDeclared: string
  nature: string
  description: string | null
  habitable: string | null
  utilityCut: string | null
  safetyRisk: boolean | null
  worsening: boolean | null
  safetyReason: string | null
}

export interface PropertyManagerTurnInput {
  tenant: { id: string; name: string | null; emergencyNumbers: EmergencyNumber[] | null }
  contact: { id: string; fullName: string | null }
  conversationId: string
  openTickets: OpenTicketContext[]
  history: { direction: 'inbound' | 'outbound'; body: string | null }[]
  priorState: unknown
  userMessage: string
  /** Premier message de la conversation : la présentation est envoyée par le
   *  code (introductions.ts), l'agent ne doit pas la doubler. */
  isFirstMessage: boolean
}

export interface PropertyManagerTurnResult extends AgentTurnResult {
  /** Vrai si le chemin de sécurité a été déclenché pendant ce tour : le worker
   *  garantit alors la présence des numéros d'urgence dans le message envoyé
   *  (ensureSafetyNotice), même si la réponse du modèle est retenue. */
  safetyTriggered: boolean
}

function oneOf<T extends string>(values: readonly T[], v: unknown): T | undefined {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? v as T : undefined
}

/** Les faits fournis par le modèle, filtrés : une valeur hors liste est
 *  ignorée plutôt qu'écrite — la couche contrainte ne reçoit que des valeurs
 *  de l'enum. */
function readFacts(input: Record<string, unknown>): TicketFactsInput & { safetyCode?: SafetyReasonCode } {
  const facts: TicketFactsInput & { safetyCode?: SafetyReasonCode } = {}
  const habitable = oneOf(HABITABLE, input.habitable)
  if (habitable) facts.habitable = habitable
  const utilityCut = oneOf(UTILITY_CUT, input.utility_cut)
  if (utilityCut) facts.utilityCut = utilityCut
  if (typeof input.safety_risk === 'boolean') facts.safetyRisk = input.safety_risk
  if (typeof input.worsening === 'boolean') facts.worsening = input.worsening
  const safetyCode = oneOf(Object.keys(SAFETY_REASON_LABELS) as SafetyReasonCode[], input.safety_reason)
  if (safetyCode) {
    facts.safetyCode = safetyCode
    facts.safetyReason = SAFETY_REASON_LABELS[safetyCode]
  }
  return facts
}

/**
 * Le « bien, tel que déclaré » doit venir des mots du locataire (§7). Un
 * dossier a déjà été ouvert en test avec un bien inventé alors que le
 * locataire ne l'avait jamais donné : on vérifie que l'essentiel des mots
 * du sujet figure dans ce qu'il a réellement écrit.
 */
function normalizeWords(text: string): string[] {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 3 || /\d/.test(w))
}
export function isStatedByTenant(subject: string, tenantTexts: string[]): boolean {
  const said = new Set(tenantTexts.flatMap(normalizeWords))
  const words = normalizeWords(subject)
  if (words.length === 0) return false
  return words.filter((w) => said.has(w)).length / words.length >= 0.6
}

function urgencyFor(ticket: {
  habitable?: string | null; utilityCut?: string | null; safetyRisk?: boolean | null
  worsening?: boolean | null; safetyReason?: string | null; nature?: string | null
}) {
  const r = computeUrgency({
    habitable: ticket.habitable as 'yes' | 'no' | 'partly' | null,
    utilityCut: ticket.utilityCut as 'none' | 'water' | 'power' | 'water_and_power' | null,
    safetyRisk: ticket.safetyRisk,
    worsening: ticket.worsening,
    safetyReason: ticket.safetyReason,
    nature: ticket.nature,
  })
  return { urgency: r.level, urgencyReason: r.reason }
}

/**
 * Le bloc de sécurité, construit en CODE à partir de la configuration de
 * l'agence — jamais un numéro écrit en dur, jamais un numéro que le modèle
 * aurait « retenu ».
 */
export function buildSafetyNotice(numbers: EmergencyNumber[] | null): string {
  const lines = (numbers ?? []).filter((n) => n.number?.trim())
  return lines.length
    ? `En cas de danger, mettez-vous en sécurité et appelez les secours :\n${lines.map((n) => `• ${n.label} : ${n.number}`).join('\n')}`
    : 'En cas de danger, mettez-vous en sécurité et appelez immédiatement les secours.'
}

/** Le message de sécurité entièrement écrit par le code : consigne, numéros
 *  configurés, et ce qui est VRAI — l'agence est prévenue, rien de plus. */
export function buildSafetyMessage(numbers: EmergencyNumber[] | null): string {
  return 'Consigne de sécurité : si vous pouvez le faire sans danger, coupez l\'arrivée (gaz, eau ou '
    + 'électricité), puis sortez du logement et éloignez-vous.\n\n'
    + `${buildSafetyNotice(numbers)}\n\nL'agence est prévenue à l'instant.`
}

/**
 * Garantit la consigne de sécurité dans le message envoyé quand le chemin de
 * sécurité a été déclenché — elle ne dépend pas du modèle.
 *
 * Un numéro de téléphone que le modèle a écrit sans qu'il figure dans la
 * configuration de l'agence est un numéro inventé (« le 17 ou le 112 » est
 * déjà arrivé en test) : dans un message de danger, c'est inacceptable. Le
 * message entier est alors remplacé par celui du code.
 *
 * @param allowedNumbers les nombres légitimes du message (références de dossier)
 */
export function ensureSafetyNotice(
  reply: string,
  numbers: EmergencyNumber[] | null,
  allowedNumbers: string[] = [],
): string {
  const configured = (numbers ?? []).filter((n) => n.number?.trim())
  const digits = (s: string) => s.replace(/\D/g, '')
  const legit = new Set([...configured.map((n) => digits(n.number)), ...allowedNumbers.map(digits)])

  // Toute suite de chiffres (espaces tolérés) de 2 chiffres ou plus.
  const written = [...reply.matchAll(/\d[\d .-]*\d/g)].map((m) => digits(m[0]))
  const invented = written.some((w) => ![...legit].some((l) => l && (w === l || l.includes(w) || w.includes(l))))
  if (invented) return buildSafetyMessage(numbers)

  const replyDigits = digits(reply)
  const allPresent = configured.length > 0 && configured.every((n) => replyDigits.includes(digits(n.number)))
  return allPresent ? reply : `${reply}\n\n${buildSafetyNotice(numbers)}`
}

/** Réponse à une vidéo, écrite par le CODE et placée en tête du message : la
 *  formulation ne dépend pas du modèle, qui se contente de poursuivre. */
export const VIDEO_NOT_ACCEPTED_NOTICE =
  "Je ne peux pas recevoir les vidéos : celle-ci n'a pas été transmise à l'agence. Envoyez-moi plutôt "
  + 'une ou plusieurs photos, nettes et bien éclairées.'

export function withVideoNotice(reply: string): string {
  return `${VIDEO_NOT_ACCEPTED_NOTICE}\n\n${reply}`
}

function describeTicket(t: OpenTicketContext): string {
  const facts = [
    t.habitable ? `habitable=${t.habitable}` : null,
    t.utilityCut ? `utility_cut=${t.utilityCut}` : null,
    t.safetyRisk != null ? `safety_risk=${t.safetyRisk}` : null,
    t.worsening != null ? `worsening=${t.worsening}` : null,
    t.safetyReason ? `chemin de sécurité=${t.safetyReason}` : null,
  ].filter(Boolean)
  return `- dossier n°${t.reference} (ticket_id=${t.id}) — bien : « ${t.subjectAsDeclared} » — nature=${t.nature}`
    + (t.description ? ` — problème : « ${t.description} »` : '')
    + (facts.length ? ` — faits DÉJÀ établis, à ne pas redemander : ${facts.join(', ')}` : ' — aucun des quatre faits établi')
}

function buildSystemPrompt(input: PropertyManagerTurnInput): string {
  const agency = input.tenant.name?.trim()
  return [
    agency
      ? `Tu es Malick, régisseur de ${agency}, une agence immobilière sénégalaise. Tu reçois sur `
        + 'WhatsApp les demandes de ses locataires en place : pannes, dégâts, démarches.'
      : "Tu es Malick, régisseur d'une agence immobilière sénégalaise. Tu reçois sur WhatsApp les "
        + "demandes de ses locataires en place. Le nom de l'agence ne t'a pas été communiqué : ne cite "
        + "JAMAIS de nom d'agence, dis « l'agence ».",
    input.isFirstMessage ? FIRST_MESSAGE_RULE : '',
    'Tu t\'appelles Malick : si on te demande ton nom ou qui tu es, réponds « Malick, l\'assistant '
    + 'automatique de l\'agence pour les locataires ».',
    'Tu écris en français, des messages courts (WhatsApp), calmes et concrets. Tu vouvoies TOUJOURS le locataire.',
    'Pas de mise en forme Markdown : WhatsApp n\'affiche pas les titres ni « **…** ». Une seule '
    + 'question par message, sans numérotation (« question 2 », « 1. ») : le locataire ne voit pas ta liste.',
    input.contact.fullName ? `Nom déclaré du locataire : ${input.contact.fullName}.` : '',
    '',
    '## Ouvrir le dossier',
    'Le problème n\'a PAS besoin d\'être précis pour ouvrir : « souci de robinetterie », « la clim ne '
    + 'marche pas », « problème d\'électricité » suffisent. Ouvre le dossier, puis précise ensuite si '
    + 'besoin (update_ticket, description). Ne redemande jamais un problème déjà donné, même vague.',
    'Les quatre questions ne se posent QU\'APRÈS l\'ouverture du dossier : sans dossier, la seule '
    + 'question permise est celle qui obtient le bien ou le problème manquant.',
    'Dès que tu sais (1) de quel bien il s\'agit — l\'adresse ou la résidence, dans les mots du '
    + 'locataire — et (2) quel est le problème, appelle open_ticket. Son numéro est déjà connu : '
    + 'ne le demande jamais. Si l\'un des deux manque, pose UNE question pour l\'obtenir.',
    'Une fois le dossier ouvert, donne son numéro au locataire, puis établis les quatre faits '
    + 'UN PAR UN, une question fermée à la fois, en enregistrant chaque réponse avec update_ticket '
    + 'dès qu\'elle arrive. Si le locataire a déjà donné l\'information, ne la redemande pas.',
    'Tu ne qualifies jamais toi-même l\'urgence et tu ne dis jamais au locataire que c\'est « urgent » '
    + 'ou « pas urgent » : le système la calcule à partir des faits.',
    'Quand les faits sont établis, tu confirmes que la demande est prise en compte et que l\'agence '
    + 'lui communiquera un créneau — sans aucun délai.',
    '',
    input.openTickets.length
      ? `Dossiers DÉJÀ ouverts pour ce locataire :\n${input.openTickets.map(describeTicket).join('\n')}\n`
        + 'Si le message concerne l\'un d\'eux, complète-le avec update_ticket — n\'en ouvre pas un second. '
        + 'Un nouveau problème distinct justifie un nouveau dossier.'
      : "Aucun dossier ouvert pour ce locataire.",
    '',
    '## Photos — et pas de vidéo',
    'Anticipe : dès que tu connais le problème (au plus tard en donnant le numéro de dossier), invite '
    + 'UNE FOIS le locataire à t\'envoyer une ou plusieurs photos, nettes, '
    + 'bien éclairées, une vue d\'ensemble et une de près sur le problème. Ne répète pas cette '
    + 'invitation à chaque message. Inutile pour une demande purement administrative.',
    'Un message « [Photo …] » signifie que le locataire a envoyé une photo. Elle est jointe au '
    + 'dossier AUTOMATIQUEMENT — tu n\'as rien à faire. Tu ne vois pas son contenu : ne la décris '
    + 'jamais, n\'en déduis rien, et ne dis jamais qu\'elle est nette ou floue. Remercie simplement, et '
    + 'si tu ne sais pas encore de quoi il s\'agit, demande-le.',
    'Un message « [Vidéo …] » signifie que le locataire a envoyé une vidéo. Le système lui répond '
    + 'DÉJÀ qu\'elle n\'est pas prise en charge et lui demande une ou plusieurs photos : n\'en parle '
    + 'pas, ne redemande pas de photos. Poursuis simplement la conversation (légende éventuelle, '
    + 'question suivante du dossier).',
    '',
    '## Questions de zone rouge — exemples réels',
    '« Le plombier vient quand ? », « c\'est à moi de payer ? », « qui paie la réparation ? », '
    + '« vous pouvez baisser le loyer ? », « je récupère ma caution ? » : appelle escalate_to_human '
    + '(trigger red_zone) DANS CE TOUR, puis dis au locataire que tu as transmis sa question à '
    + 'l\'agence, qui lui répondra. N\'esquive jamais la question et ne la passe pas sous silence. '
    + 'Ensuite seulement, tu peux reprendre les questions du dossier.',
    '',
    '## Chemin de sécurité — prioritaire sur tout',
    'Ce qui N\'EST PAS le chemin de sécurité : une fuite, un dégât des eaux, de l\'eau qui coule du '
    + 'plafond ou goutte, une panne d\'électricité, une clim en panne — même importants. Ce sont des '
    + 'dossiers, éventuellement urgents (le système le calcule). Tu peux alors conseiller un geste '
    + 'conservatoire (couper l\'eau, couper le disjoncteur si l\'eau approche d\'un appareil '
    + 'électrique), jamais d\'évacuer ni d\'appeler les secours. Le chemin de sécurité est réservé à un '
    + 'danger immédiat pour les personnes : odeur de gaz, feu ou fumée, eau qui envahit le logement '
    + 'et monte, installation qui fait des étincelles ou fume, personne blessée.',
    'Odeur de gaz, feu ou fumée, inondation en cours, installation électrique qui fume ou fait des '
    + 'étincelles, personne blessée : appelle trigger_safety_path IMMÉDIATEMENT, avant toute autre '
    + 'question, même sans dossier. Puis donne la consigne : couper l\'arrivée si c\'est sans danger, '
    + 'sortir du logement, appeler les secours avec les numéros que l\'outil te renvoie. Jamais '
    + '« c\'est bien noté, l\'agence revient vers vous » seul dans ce cas.',
    'Un danger a son PROPRE dossier : ne le rattache jamais à un dossier ouvert sur un autre sujet '
    + '(une odeur de gaz n\'a rien à voir avec un dossier de VMC). Après la consigne, ouvre un dossier '
    + 'dédié avec open_ticket et safety_reason, sauf si le danger est le problème même d\'un dossier '
    + 'déjà ouvert.',
    'N\'écris JAMAIS un numéro de téléphone qui ne vient pas de l\'outil — si la liste est vide, '
    + 'dis « appelez les secours » sans numéro. Ne dis jamais qu\'une équipe ou une intervention '
    + 'est en route : la seule chose vraie est que l\'agence est prévenue.',
    '',
    "Il n'y a PAS de message suivant automatique : n'écris jamais « je vérifie » ou « je reviens vers "
    + 'vous ». Appelle l\'outil nécessaire dans ce même tour, puis réponds.',
    '',
    renderPropertyManagerZonePrompt(),
  ].filter((l) => l !== '').join('\n')
}

export async function runPropertyManagerTurn(params: PropertyManagerTurnInput): Promise<PropertyManagerTurnResult> {
  const tenantId = params.tenant.id
  let safetyTriggered = false
  /** Outils appelés pendant ce tour — sert au filet sur les faits. */
  const toolsCalled = new Set<string>()

  /** Relu à chaque appel : un dossier ouvert pendant ce tour doit être
   *  modifiable dans le même tour. */
  async function findOwnOpenTicket(ticketId: unknown) {
    if (typeof ticketId !== 'string') return null
    const open = await listOpenTicketsForContact(tenantId, params.contact.id)
    return open.find((t) => t.id === ticketId) ?? null
  }

  async function raiseSafety(code: SafetyReasonCode) {
    if (!safetyTriggered) {
      await createEscalation(tenantId, params.conversationId, `Chemin de sécurité : ${SAFETY_REASON_LABELS[code]}`, 'safety')
    }
    safetyTriggered = true
  }

  async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    toolsCalled.add(name)
    switch (name) {
      case 'open_ticket': {
        const subject = typeof input.subject_as_declared === 'string' ? input.subject_as_declared.trim() : ''
        const nature = oneOf(NATURES, input.nature)
        if (!subject) return { error: 'subject_as_declared is required: ask the tenant which property they rent.' }
        const tenantTexts = [
          ...params.history.filter((m) => m.direction === 'inbound' && m.body).map((m) => m.body!),
          params.userMessage,
        ]
        if (!isStatedByTenant(subject, tenantTexts)) {
          return {
            error: 'not_stated: the tenant has not told you which property they rent — do not guess it. '
              + 'No ticket was opened. Ask them for the address or residence, in their own words.',
          }
        }
        if (!nature) return { error: `nature must be one of: ${NATURES.join(', ')}` }
        const description = typeof input.description === 'string' && input.description.trim()
          ? input.description.trim() : null
        const { safetyCode, ...facts } = readFacts(input)

        const ticket = await createTicket(tenantId, params.contact.id, {
          subjectAsDeclared: subject,
          nature: nature as Nature,
          description,
          ...facts,
          ...urgencyFor({ ...facts, nature }),
        })
        await attachPendingMediaToTicket(tenantId, params.conversationId, ticket.id)
        if (safetyCode) await raiseSafety(safetyCode)
        return {
          ticket_id: ticket.id,
          reference: ticket.reference,
          ...(safetyCode ? { emergency_numbers: params.tenant.emergencyNumbers ?? [] } : {}),
        }
      }

      case 'update_ticket': {
        const ticket = await findOwnOpenTicket(input.ticket_id)
        if (!ticket) return { error: 'not_found: this ticket_id is not an open ticket of this tenant.' }
        const { safetyCode, ...facts } = readFacts(input)
        // Même garde-fou que trigger_safety_path : un danger sans rapport ne
        // s'inscrit pas sur ce dossier — l'alerte part quand même.
        const unrelatedDanger = !!safetyCode && !isSafetyCompatible(safetyCode, ticket.nature)
        if (unrelatedDanger) delete facts.safetyReason
        const description = typeof input.description === 'string' && input.description.trim()
          ? input.description.trim() : undefined
        await updateTicketFacts(tenantId, ticket.id, {
          ...facts,
          description,
          ...urgencyFor({ ...ticket, ...facts }),
        })
        if (safetyCode) await raiseSafety(safetyCode)
        return {
          ok: true,
          ...(safetyCode ? { emergency_numbers: params.tenant.emergencyNumbers ?? [] } : {}),
          ...(unrelatedDanger ? {
            ticket: `The danger was NOT written on ticket ${ticket.reference}: it is about another problem. `
              + `Open a DEDICATED ticket with open_ticket (safety_reason: ${safetyCode}).`,
          } : {}),
        }
      }

      case 'trigger_safety_path': {
        const code = oneOf(Object.keys(SAFETY_REASON_LABELS) as SafetyReasonCode[], input.reason)
        if (!code) return { error: `reason must be one of: ${Object.keys(SAFETY_REASON_LABELS).join(', ')}` }
        await raiseSafety(code)
        const ticket = await findOwnOpenTicket(input.ticket_id)
        const attached = !!ticket && isSafetyCompatible(code, ticket.nature)
        if (ticket && attached) {
          const safetyReason = SAFETY_REASON_LABELS[code]
          await updateTicketFacts(tenantId, ticket.id, { safetyReason, ...urgencyFor({ ...ticket, safetyReason }) })
        }
        return {
          ok: true,
          human_alerted: true,
          emergency_numbers: params.tenant.emergencyNumbers ?? [],
          instruction: 'Give the safety instruction now, with these numbers. If the list is empty, '
            + 'tell them to call emergency services immediately — never invent a number.',
          ...(attached ? {} : {
            ticket: (ticket ? `Not attached to ticket ${ticket.reference}: it is about another problem. ` : '')
              + 'In this same turn, after the safety instruction, open a DEDICATED ticket for this danger '
              + `with open_ticket (safety_reason: ${code}) if you know the property; otherwise ask for it `
              + 'only after the safety instruction.',
          }),
        }
      }

      case 'escalate_to_human': {
        await createEscalation(
          tenantId, params.conversationId,
          typeof input.reason === 'string' ? input.reason : 'raison non précisée',
          typeof input.trigger === 'string' ? input.trigger : 'user_asked',
        )
        return { ok: true }
      }

      default:
        return { error: `outil inconnu : ${name}` }
    }
  }

  const result = await runAgentLoop({
    tenantId,
    conversationId: params.conversationId,
    system: buildSystemPrompt(params),
    tools: PROPERTY_MANAGER_TOOLS,
    history: params.history,
    priorState: params.priorState,
    userMessage: params.userMessage,
    executeTool,
    checkFinal: async (text) => {
      // Filet en code de la règle centrale de Malick (« ouvrir dès qu'il a le
      // minimum »), qui a déjà été manquée en test : aucun dossier ouvert, et
      // la réponse ne demande pas de quel bien il s'agit — c'est donc qu'il le
      // connaît, ou qu'il pose les questions sans dossier. On le relance une fois.
      if (safetyTriggered) return null
      const open = await listOpenTicketsForContact(tenantId, params.contact.id)

      if (open.length === 0) {
        // Une relance inutile est sans risque : sans appel d'outil, la réponse
        // d'origine part (agent-loop.ts). On relance donc dès que la réponse
        // ne demande pas le bien — y compris quand elle redemande un problème
        // déjà donné, même vaguement (« souci de robinetterie » suffit).
        if (asksForProperty(text)) return null
        return "Aucun dossier n'est encore ouvert pour ce locataire. Relis tout l'historique : si tu "
          + 'connais le bien ET le problème, appelle open_ticket MAINTENANT, puis réponds en donnant le '
          + 'numéro de dossier. S\'il manque l\'un des deux, ta réponse doit le demander.' + NUDGE_SUFFIX
      }

      // Second filet, né d'une vraie conversation : le locataire a répondu
      // « oui », « ça fonctionne », « non » aux quatre questions et AUCUN fait
      // n'a été enregistré — l'urgence calculée restait donc fausse. Si un
      // dossier a des faits manquants et qu'update_ticket n'a pas été appelé
      // pendant ce tour, on le relance une fois.
      if (toolsCalled.has('update_ticket') || toolsCalled.has('open_ticket')) return null
      if (params.userMessage.startsWith('[')) return null // photo ou vidéo : aucun fait à lire
      const missing = open.filter((t) => FACT_KEYS.some((k) => t[k] == null))
      if (missing.length === 0) return null
      return 'Vérification avant envoi : le dernier message du locataire établit-il l\'un des quatre faits '
        + '(logement habitable, coupure d\'eau ou d\'électricité, risque de sécurité, aggravation) — y '
        + 'compris par une réponse courte comme « oui », « non », « ça fonctionne » à ta question '
        + 'précédente ? Si oui, appelle update_ticket MAINTENANT avec ce fait, puis réponds. Sinon, '
        + 'renvoie ta réponse telle quelle.' + NUDGE_SUFFIX
    },
  })
  return { ...result, safetyTriggered }
}
