/**
 * Boucle commune à tous les agents qui parlent aux clients de l'agence
 * (Coumba, Malick) : un tour de conversation, outils compris. Seuls le
 * prompt, les outils et leur exécution changent d'un profil à l'autre —
 * « un seul runtime, plusieurs profils » (§4 des spécifications).
 *
 * Ce fichier ne touche jamais WhatsApp : il retourne un texte, c'est le
 * worker qui l'envoie, après screenOutbound().
 */
import Anthropic from '@anthropic-ai/sdk'
import { createEscalation } from '@codaya/db'

export interface AgentTurnResult {
  reply: string
  /** À repersister via updateConversationAgentState — sinon le prochain tour
   *  repart sans mémoire des outils déjà appelés (voir schema.ts). */
  agentState: Anthropic.MessageParam[]
}

/** Combien de tours on garde : assez pour une vraie mémoire de conversation,
 *  borné pour ne pas faire grossir le prompt indéfiniment. */
const MAX_STATE_MESSAGES = 40

const MAX_TOOL_ROUNDS = 6

/** Formules d'attente sans action derrière — voir le filet anti-blocage plus bas. */
const STALL_PATTERN = /laisse-?moi v[ée]rifier|je v[ée]rifie\b|un (petit )?instant|une (petite )?seconde|je reviens vers (toi|vous)|je te (tiens|reviens)/i

/**
 * Message de repli quand on n'envoie pas la réponse du modèle (réponse vide,
 * boucle d'outils épuisée, ou retenue par screenOutbound côté worker). Elle
 * affirme qu'un humain est prévenu — donc à chaque usage, une vraie
 * escalade doit être créée juste avant, sinon c'est exactement l'indicateur
 * invérifiable que la règle n°1 du projet interdit.
 */
export const ESCALATION_FALLBACK_MESSAGE =
  "J'ai remonté votre besoin aux membres de l'agence, ils sont déjà dessus et l'un d'eux vous contactera très vite."

function isStoredMessageArray(value: unknown): value is Anthropic.MessageParam[] {
  return Array.isArray(value) && value.every((m) => m && typeof m === 'object' && 'role' in m && 'content' in m)
}

/** Une trace doit commencer par un message du client, jamais par un
 *  `tool_result` dont le `tool_use` a été coupé : l'API rejette alors toute la
 *  requête (400), et comme la trace cassée est réenregistrée à chaque tour, la
 *  conversation ne répondait plus que par le message de repli — arrivé en
 *  test sur une conversation de locataire passée au-delà de 40 messages. */
export function trimToCleanStart(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const start = messages.findIndex((m) =>
    m.role === 'user'
    && (typeof m.content === 'string' || m.content.every((b) => b.type !== 'tool_result')))
  return start === -1 ? [] : messages.slice(start)
}

/** L'état persisté doit refléter ce que le client a VRAIMENT reçu — pas le
 *  brouillon interne du modèle quand il a été remplacé par un repli. */
function finalizeState(messages: Anthropic.MessageParam[], sentText: string): Anthropic.MessageParam[] {
  return trimToCleanStart([...messages, { role: 'assistant' as const, content: sentText }].slice(-MAX_STATE_MESSAGES))
}

export interface AgentLoopInput {
  tenantId: string
  conversationId: string
  system: string
  tools: Anthropic.Tool[]
  /** Repli pour le tout premier tour d'une conversation (agentState encore vide). */
  history: { direction: 'inbound' | 'outbound'; body: string | null }[]
  /** Trace brute persistée du tour précédent — prioritaire sur `history`. */
  priorState: unknown
  userMessage: string
  executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>
  /**
   * Contrôle propre au profil sur la réponse finale, avant envoi. Renvoie une
   * consigne de relance si la réponse oublie une action obligatoire (ex. :
   * Malick qui pose les questions sans avoir ouvert le dossier), ou null.
   * Appliqué une seule fois par tour.
   */
  checkFinal?: (text: string) => Promise<string | null>
}

export async function runAgentLoop(params: AgentLoopInput): Promise<AgentTurnResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // priorState porte les blocs tool_use/tool_result bruts du tour précédent —
  // sans ça, l'agent « oublie » l'id qu'il vient de trouver dès le message
  // suivant. `history` (texte seul, reconstruit depuis messages) ne sert
  // qu'au tout premier tour.
  // trimToCleanStart aussi à la lecture : il répare les traces déjà
  // enregistrées cassées, sans migration.
  const base: Anthropic.MessageParam[] = isStoredMessageArray(params.priorState)
    ? trimToCleanStart(params.priorState)
    : params.history
      .filter((m) => m.body)
      .map((m): Anthropic.MessageParam => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.body!,
      }))
  const messages: Anthropic.MessageParam[] = [...base, { role: 'user' as const, content: params.userMessage }]
  let finalChecked = false
  /** Réponse d'origine avant une relance de checkFinal, et la longueur de la
   *  trace à laquelle revenir si la relance ne produit aucun appel d'outil. */
  let preNudge: { text: string; length: number } | null = null

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 1024,
      system: params.system,
      tools: params.tools,
      messages,
    })

    const toolUses = res.content.filter((b) => b.type === 'tool_use')
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()

    if (toolUses.length === 0 || res.stop_reason !== 'tool_use') {
      // La relance de checkFinal n'a servi à rien (aucun outil appelé) : on
      // revient à la réponse d'origine. La nouvelle réponse est jetée — elle
      // risquerait de commenter la consigne interne devant le client
      // (« il n'a pas répondu à ma question… » est arrivé en test).
      if (preNudge) {
        messages.length = preNudge.length
        return { reply: preNudge.text, agentState: finalizeState(messages, preNudge.text) }
      }
      // Filet anti-blocage, en code plutôt que dans le seul prompt (règle des
      // « quatre couches ») : « laisse-moi vérifier » sans jamais vérifier est
      // réapparu même avec la consigne. Il n'y a pas de second message côté
      // WhatsApp — si le texte promet une vérification, on la force plutôt
      // que d'envoyer une promesse creuse.
      const isStalling = text && STALL_PATTERN.test(text)
      if (isStalling && round < MAX_TOOL_ROUNDS - 1) {
        messages.push({ role: 'assistant', content: text })
        messages.push({
          role: 'user',
          content:
            "Tu viens de promettre une vérification sans la faire — il n'y a pas de second "
            + "message, le client ne recevra jamais la suite. Appelle MAINTENANT l'outil "
            + 'nécessaire et donne la vraie réponse dans ce message, sans aucune formule '
            + "d'attente.",
        })
        continue
      }
      if (!text || isStalling) {
        await createEscalation(
          params.tenantId, params.conversationId,
          !text ? 'Réponse vide du modèle.' : "Formule d'attente persistante malgré la relance.",
          'no_progress',
        )
        return { reply: ESCALATION_FALLBACK_MESSAGE, agentState: finalizeState(messages, ESCALATION_FALLBACK_MESSAGE) }
      }
      if (params.checkFinal && !finalChecked && round < MAX_TOOL_ROUNDS - 1) {
        finalChecked = true
        const nudge = await params.checkFinal(text)
        if (nudge) {
          preNudge = { text, length: messages.length }
          messages.push({ role: 'assistant', content: text })
          messages.push({ role: 'user', content: nudge })
          continue
        }
      }
      return { reply: text, agentState: finalizeState(messages, text) }
    }

    // La relance a provoqué un appel d'outil : elle a servi, la réponse finale
    // viendra après l'outil.
    preNudge = null
    messages.push({ role: 'assistant', content: res.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      const result = await params.executeTool(tu.name, tu.input as Record<string, unknown>)
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  await createEscalation(
    params.tenantId, params.conversationId,
    `Boucle d'outils interrompue après ${MAX_TOOL_ROUNDS} tours sans réponse finale.`,
    'no_progress',
  )
  return { reply: ESCALATION_FALLBACK_MESSAGE, agentState: finalizeState(messages, ESCALATION_FALLBACK_MESSAGE) }
}
