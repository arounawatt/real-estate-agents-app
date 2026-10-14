/**
 * Consommateur de la file `inbound` (webhooks Meta, mis en file par
 * webhook.ts) — traite un message WhatsApp entrant, texte ou photo, pour
 * Coumba (`sales`) ou Malick (`property_manager`). L'assistante (Adja) peut
 * être désignée par routeProfile() mais rien ne la fait encore répondre :
 * une branche à la fois, comme sa branche vide dans routing.ts.
 *
 * Aucun appel LLM dans webhook.ts — c'est ici, hors de la requête HTTP
 * Meta, que ça se passe (CLAUDE.md « Le webhook Meta »).
 */
import {
  createEscalation, findOrCreateContact, findOrCreateConversation, findOrCreateLead,
  getAgencyUserByWhatsapp, getLead, getTenant, getThreadByContactAndProfile,
  getWhatsappAccountByPhoneNumberId, listOpenTicketsForContact, listPublishedPrices,
  recordInboundMedia, recordInboundMessage, recordOutboundMessage, tenantAccess, updateConversationAgentState,
} from '@codaya/db'
import {
  agencyPhoneAmounts, buildIntroduction, ensureSafetyNotice, withIntroduction, withVideoNotice, ESCALATION_FALLBACK_MESSAGE, routeProfile,
  runPropertyManagerTurn, runSalesTurn,
  screenOutbound,
} from '@codaya/agent'
import { decryptToken, downloadMedia, sendText, toWhatsappText } from '@codaya/whatsapp'

interface MetaWebhookMessage {
  from: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type?: string; caption?: string }
  video?: { id: string; caption?: string }
  id: string
}

interface MetaWebhookValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[]
  messages?: MetaWebhookMessage[]
  metadata: { phone_number_id: string }
}

interface MetaWebhookPayload {
  entry?: { changes?: { field: string; value: MetaWebhookValue }[] }[]
}

type Account = { tenantId: string; phoneNumberId: string; accessTokenEncrypted: string }
type Tenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>
type Contact = Awaited<ReturnType<typeof findOrCreateContact>>
type Conversation = Awaited<ReturnType<typeof findOrCreateConversation>>
type Thread = Awaited<ReturnType<typeof getThreadByContactAndProfile>>

export async function processInboundWebhook(payload: MetaWebhookPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      await processMessagesChange(change.value)
    }
  }
}

async function processMessagesChange(value: MetaWebhookValue) {
  const phoneNumberId = value.metadata?.phone_number_id
  if (!phoneNumberId) return

  // Le phone_number_id est la clé de tenant — et nulle part ailleurs.
  const account = await getWhatsappAccountByPhoneNumberId(phoneNumberId)
  if (!account) {
    console.error(`Aucun tenant pour phone_number_id=${phoneNumberId}`)
    return
  }

  for (const message of value.messages ?? []) {
    // Statuts de livraison (`statuses`), vocaux, documents, boutons… : hors
    // périmètre de ce passage, ignorés proprement plutôt que de planter.
    const isText = message.type === 'text' && Boolean(message.text?.body)
    const isImage = message.type === 'image' && Boolean(message.image?.id)
    const isVideo = message.type === 'video'
    if (!isText && !isImage && !isVideo) continue
    await processMessage(account, value, message)
  }
}

async function processMessage(account: Account, value: MetaWebhookValue, message: MetaWebhookMessage) {
  const tenantId = account.tenantId
  const waId = message.from
  const declaredName = value.contacts?.find((c) => c.wa_id === waId)?.profile?.name ?? null

  const tenant = await getTenant(tenantId)
  if (!tenant) {
    console.error(`Tenant introuvable pour ${tenantId}`)
    return
  }

  const isAgencyUser = Boolean(await getAgencyUserByWhatsapp(tenantId, waId))
  const contact = await findOrCreateContact(tenantId, waId, waId, declaredName)

  const profile = routeProfile({
    isAgencyUser,
    isKnownTenantContact: contact.kind === 'tenant',
    plan: tenant.plan,
  })

  if (profile !== 'sales' && profile !== 'property_manager') {
    console.log(`Profil "${profile}" désigné pour ${waId} — pas encore construit, message conservé sans réponse.`)
    return
  }

  // Les vidéos ne concernent que Malick, qui les refuse explicitement. Chez
  // Coumba, rien n'est encore prévu : ignorées comme avant.
  if (message.type === 'video' && profile !== 'property_manager') return

  const conversation = await findOrCreateConversation(tenantId, contact.id, profile)
  // Historique lu AVANT d'enregistrer le message du jour, pour ne pas se le renvoyer à lui-même.
  const priorThread = await getThreadByContactAndProfile(tenantId, contact.id, profile)
  const accessToken = decryptToken(account.accessTokenEncrypted)

  const userMessage = message.type === 'image'
    ? await recordImage(tenantId, contact, conversation, profile, message, accessToken)
    : message.type === 'video'
      ? await recordVideo(tenantId, conversation, message)
      : message.text!.body

  if (message.type === 'text') {
    await recordInboundMessage(tenantId, conversation.id, message.text!.body, message.id)
  }

  const access = tenantAccess(tenant)
  if (access !== 'active') {
    // Agence désactivée ou en fin d'accès (pnpm ops:tenant-status) : le
    // message est conservé — rien n'est perdu si l'accès est rétabli — mais
    // aucun agent ne répond.
    console.log(`Agence ${tenantId} ${access === 'expired' ? 'en fin d\'accès' : 'désactivée'} — message conservé sans réponse.`)
    return
  }

  if (conversation.handedOverAt) {
    // « Reprendre la main » (tableau de bord) : le message reste visible dans
    // le fil pour le conseiller, mais l'agent ne répond plus automatiquement.
    console.log(`Conversation ${conversation.id} reprise par l'agence — pas de réponse automatique.`)
    return
  }

  // Une rafale de photos (WhatsApp en envoie une par message) : seule la
  // première déclenche une réponse, les suivantes sont jointes en silence.
  if (isMediaBurst(priorThread, message)) return

  // Premier message de CETTE conversation (un contact a une conversation par
  // agent) : l'agent se présente — texte écrit par le code, voir introductions.ts.
  const isFirstMessage = (priorThread?.messages.length ?? 0) === 0

  const turn = profile === 'sales'
    ? await runSales(tenant, contact, conversation, priorThread, userMessage, isFirstMessage)
    : await runPropertyManager(tenant, contact, conversation, priorThread, userMessage, message.type === 'video', isFirstMessage)

  const finalText = toWhatsappText(isFirstMessage
    ? withIntroduction(turn.finalText, buildIntroduction(profile, tenant.name), turn.safetyTriggered)
    : turn.finalText)
  await updateConversationAgentState(conversation.id, replaceLastAssistant(turn.agentState, finalText))

  const sent = await sendText({
    phoneNumberId: account.phoneNumberId,
    accessToken,
    to: waId,
    body: finalText,
  })

  await recordOutboundMessage(tenantId, conversation.id, finalText, null, sent.metaMessageId)
}

/**
 * Rapatrie la photo TOUT DE SUITE — l'URL Meta expire, une photo ratée est
 * perdue — et l'enregistre. Chez Malick, elle est jointe au dossier ouvert
 * le plus récent ; sans dossier, elle le sera à l'ouverture.
 */
async function recordImage(
  tenantId: string,
  contact: Contact,
  conversation: Conversation,
  profile: 'sales' | 'property_manager',
  message: MetaWebhookMessage,
  accessToken: string,
): Promise<string> {
  const caption = message.image!.caption?.trim() || null
  const messageId = await recordInboundMessage(tenantId, conversation.id, caption ?? '', message.id, null, 'image')
  const who = profile === 'property_manager' ? 'le locataire' : 'le client'

  let media: { data: Buffer; mimeType: string }
  try {
    media = await downloadMedia(message.image!.id, accessToken)
  } catch (err) {
    console.error(`Photo ${message.image!.id} non récupérée`, err)
    await createEscalation(
      tenantId, conversation.id,
      `Photo envoyée par ${who} mais non récupérée auprès de Meta : ${err instanceof Error ? err.message : String(err)}`,
      'no_progress',
    )
    return `[Photo envoyée par ${who}, mais elle n'a pas pu être récupérée — demande-lui de la renvoyer]`
      + (caption ? `\n${caption}` : '')
  }

  const ticket = profile === 'property_manager'
    ? (await listOpenTicketsForContact(tenantId, contact.id))[0] ?? null
    : null
  await recordInboundMedia(tenantId, messageId, { ...media, ticketId: ticket?.id ?? null })

  const where = profile === 'sales'
    ? ''
    : ticket ? ` — jointe au dossier n°${ticket.reference}` : ' — elle sera jointe au dossier dès son ouverture'
  return `[Photo envoyée par ${who}${where}]` + (caption ? `\n${caption}` : '')
}

/** Ce que lit Malick à la place de la vidéo. La consigne est DANS le message,
 *  pas seulement dans le prompt système : en test, sans elle, il remerciait
 *  pour la vidéo refusée et redemandait des photos en doublon. */
const VIDEO_MARKER = '[Vidéo envoyée par le locataire. Elle n\'est pas acceptée et le système vient '
  + 'de lui répondre qu\'il faut envoyer une ou plusieurs photos à la place. Ne parle NI de la vidéo '
  + 'NI des photos, ne remercie pas : enchaîne directement sur la suite du dossier.]'

/**
 * Une vidéo n'est NI téléchargée NI conservée : Malick ne prend que des
 * photos. Le message est enregistré pour que le fil montre qu'elle a été
 * reçue — c'est ce qui explique la réponse de Malick au conseiller qui relit.
 */
async function recordVideo(tenantId: string, conversation: Conversation, message: MetaWebhookMessage): Promise<string> {
  const caption = message.video?.caption?.trim() || null
  await recordInboundMessage(tenantId, conversation.id, caption ?? '', message.id, null, 'video')
  return VIDEO_MARKER
    + (caption ? `\n${caption}` : '')
}

/** Vrai pour une photo (ou une vidéo) sans légende qui suit directement un
 *  média du même type, sans réponse de l'agent entre les deux : une rafale
 *  n'appelle qu'une réponse. */
function isMediaBurst(priorThread: Thread, message: MetaWebhookMessage): boolean {
  if (message.type !== 'image' && message.type !== 'video') return false
  const caption = message.type === 'image' ? message.image?.caption : message.video?.caption
  if (caption?.trim()) return false
  const last = priorThread?.messages.at(-1)
  return Boolean(last && last.direction === 'inbound' && last.mediaKind === message.type)
}

async function runSales(
  tenant: Tenant, contact: Contact, conversation: Conversation, priorThread: Thread, userMessage: string,
  isFirstMessage: boolean,
) {
  const tenantId = tenant.id
  const lead = await findOrCreateLead(tenantId, contact.id)

  // Tout ce qui suit peut échouer de façon imprévue (outil planté sur une
  // donnée que le modèle a mal formée, appel Claude en erreur…). Avant ce
  // filet, un tel échec laissait le prospect sans AUCUNE réponse, en
  // silence total — pire que le message de repli lui-même. Ici, on essaie
  // toujours d'envoyer quelque chose d'honnête et de prévenir un humain.
  let finalText: string
  let agentState: unknown = conversation.agentState
  try {
    const result = await runSalesTurn({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        disclosureLevel: tenant.disclosureLevel,
        bookingUrlRental: tenant.bookingUrlRental,
        bookingUrlSale: tenant.bookingUrlSale,
        splitBookingLinks: tenant.splitBookingLinks,
      },
      contact: { fullName: contact.fullName, declaredCity: contact.declaredCity },
      lead: {
        intent: lead.intent,
        propertyType: lead.propertyType,
        zone: lead.zone,
        budgetAmount: lead.budgetAmount,
        timeline: lead.timeline,
        notes: lead.notes,
      },
      conversationId: conversation.id,
      leadId: lead.id,
      history: priorThread?.messages ?? [],
      priorState: conversation.agentState,
      userMessage,
      isFirstMessage,
    })
    const { reply } = result
    agentState = result.agentState

    const knownPrices = await listPublishedPrices(tenantId)
    // Le budget que le prospect a lui-même annoncé n'est pas un montant inventé
    // par Coumba — elle doit pouvoir le reformuler (« légèrement au-dessus de
    // votre budget ») sans que screenOutbound le prenne pour une négociation.
    // Relu en base, pas la valeur capturée avant runSalesTurn : save_qualification
    // a pu la mettre à jour pendant ce tour.
    const updatedLead = await getLead(tenantId, lead.id)
    if (updatedLead?.budgetAmount) knownPrices.push(updatedLead.budgetAmount)
    // Le téléphone de l'agence (get_agency_info) n'est pas un montant non plus.
    knownPrices.push(...agencyPhoneAmounts(tenant.phone))

    const screen = screenOutbound(reply, knownPrices)
    finalText = screen.ok ? reply : ESCALATION_FALLBACK_MESSAGE
    if (!screen.ok) {
      console.warn(`Message retenu par screenOutbound (lead ${lead.id}) :`, screen.reasons)
      // Le message de repli affirme qu'un humain est prévenu — ça doit être vrai.
      await createEscalation(
        tenantId, conversation.id,
        `Message sortant retenu par screenOutbound : ${screen.reasons.join(', ')}`,
        'no_progress',
      )
      agentState = replaceLastAssistant(agentState, finalText)
    }
  } catch (err) {
    console.error(`Échec de la boucle de Coumba (lead ${lead.id})`, err)
    finalText = ESCALATION_FALLBACK_MESSAGE
    await createEscalation(
      tenantId, conversation.id,
      `Échec technique pendant la boucle de Coumba : ${err instanceof Error ? err.message : String(err)}`,
      'no_progress',
    )
  }
  return { finalText, agentState, safetyTriggered: false }
}

async function runPropertyManager(
  tenant: Tenant, contact: Contact, conversation: Conversation, priorThread: Thread, userMessage: string,
  isVideo: boolean,
  isFirstMessage: boolean,
) {
  const tenantId = tenant.id
  const emergencyNumbers = tenant.emergencyNumbers ?? null

  let finalText: string
  let agentState: unknown = conversation.agentState
  let safetyTriggered = false
  try {
    const openTickets = await listOpenTicketsForContact(tenantId, contact.id)
    const result = await runPropertyManagerTurn({
      tenant: { id: tenant.id, name: tenant.name, emergencyNumbers },
      contact: { id: contact.id, fullName: contact.fullName },
      conversationId: conversation.id,
      openTickets,
      history: priorThread?.messages ?? [],
      priorState: conversation.agentState,
      userMessage,
      isFirstMessage,
    })
    agentState = result.agentState
    safetyTriggered = result.safetyTriggered

    // Malick ne cite AUCUN montant : coût et prise en charge sont en zone
    // rouge. Seuls les numéros d'urgence et le téléphone de l'agence passent le
    // filtre des montants (un numéro vert ressemble à un montant).
    const allowed = [
      ...(emergencyNumbers ?? []).map((n) => Number(n.number.replace(/\D/g, ''))).filter(Number.isFinite),
      ...agencyPhoneAmounts(tenant.phone),
    ]
    const screen = screenOutbound(result.reply, allowed)
    finalText = screen.ok ? result.reply : ESCALATION_FALLBACK_MESSAGE
    if (!screen.ok) {
      console.warn(`Message de Malick retenu par screenOutbound (contact ${contact.id}) :`, screen.reasons)
      await createEscalation(
        tenantId, conversation.id,
        `Message sortant retenu par screenOutbound : ${screen.reasons.join(', ')}`,
        'no_progress',
      )
    }
  } catch (err) {
    console.error(`Échec de la boucle de Malick (contact ${contact.id})`, err)
    finalText = ESCALATION_FALLBACK_MESSAGE
    await createEscalation(
      tenantId, conversation.id,
      `Échec technique pendant la boucle de Malick : ${err instanceof Error ? err.message : String(err)}`,
      'no_progress',
    )
  }

  // La consigne de sécurité ne dépend ni du modèle ni du filtre : si le chemin
  // de sécurité a été déclenché, les numéros d'urgence partent, quoi qu'il arrive.
  if (safetyTriggered) {
    // Relu : un dossier a pu être ouvert pendant ce tour, sa référence est légitime dans le message.
    const references = (await listOpenTicketsForContact(tenantId, contact.id)).map((t) => t.reference)
    finalText = ensureSafetyNotice(finalText, emergencyNumbers, references)
  }
  // Une vidéo reçue appelle toujours un refus explicite, écrit par le code —
  // le locataire croirait sinon l'avoir transmise à l'agence.
  if (isVideo) finalText = withVideoNotice(finalText)
  agentState = replaceLastAssistant(agentState, finalText)
  return { finalText, agentState, safetyTriggered }
}

/** La mémoire persistée doit refléter ce que le client a vraiment reçu, pas
 *  le brouillon retenu — sinon l'agent « croit » avoir dit autre chose. */
function replaceLastAssistant(agentState: unknown, sentText: string): unknown {
  if (!Array.isArray(agentState) || agentState.length === 0) return agentState
  const last = agentState.at(-1) as { role?: string; content?: unknown }
  if (last?.role !== 'assistant' || last.content === sentText) return agentState
  return [...agentState.slice(0, -1), { role: 'assistant', content: sentText }]
}
