/**
 * Client Cloud API. TODO — à compléter.
 *
 * Deux règles qui ne doivent pas se perdre dans l'implémentation :
 *
 *  · La règle des 24 h. `si (now - lastInboundAt) < 24h` → texte libre ;
 *    sinon → template approuvé. Hors fenêtre, un envoi de texte libre est
 *    rejeté par Meta : ce n'est pas une erreur à réessayer, c'est un
 *    mauvais choix en amont.
 *
 *  · Les médias. Meta ne renvoie qu'un `media_id` et l'URL de
 *    téléchargement expire. Rapatrier le binaire IMMÉDIATEMENT et le
 *    stocker. Un worker qui rate ce téléchargement perd la photo
 *    définitivement — et c'est souvent la pièce qui permet au plombier
 *    de venir avec la bonne pièce détachée.
 */

export interface SendTextInput {
  phoneNumberId: string
  accessToken: string
  to: string
  body: string
}

/**
 * Texte libre — n'appeler QUE dans la fenêtre de 24 h (voir CLAUDE.md « La
 * règle des 24 heures »). L'appelant (packages/agent) est responsable de
 * cette vérification ; ce client ne fait que transmettre.
 */
export async function sendText(input: SendTextInput): Promise<{ metaMessageId: string }> {
  const version = process.env.META_API_VERSION || 'v21.0'
  const res = await fetch(`https://graph.facebook.com/${version}/${input.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'text',
      text: { body: input.body },
    }),
  })
  const payload = await res.json() as { messages?: { id: string }[]; error?: { message: string } }
  if (!res.ok || !payload.messages?.[0]) {
    throw new Error(`Envoi WhatsApp échoué : ${payload.error?.message ?? res.statusText}`)
  }
  return { metaMessageId: payload.messages[0].id }
}

export interface SendTemplateInput {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  language: string
  /** Paramètres NOMMÉS — voir packages/whatsapp/src/templates.ts, « parameter_format: named ». */
  params: Record<string, string>
}

/**
 * Hors fenêtre de 24 h, seul un template déjà approuvé par Meta peut partir.
 * Le template doit avoir été créé et approuvé sur le WABA du tenant au
 * préalable (toMetaPayload dans templates.ts) — ce n'est pas ce client qui
 * s'en charge.
 */
export async function sendTemplate(input: SendTemplateInput): Promise<{ metaMessageId: string }> {
  const version = process.env.META_API_VERSION || 'v21.0'
  const res = await fetch(`https://graph.facebook.com/${version}/${input.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: input.to,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.language },
        components: [{
          type: 'body',
          parameters: Object.entries(input.params).map(([parameter_name, text]) => ({
            type: 'text',
            parameter_name,
            text,
          })),
        }],
      },
    }),
  })
  const payload = await res.json() as { messages?: { id: string }[]; error?: { message: string } }
  if (!res.ok || !payload.messages?.[0]) {
    throw new Error(`Envoi du template WhatsApp échoué : ${payload.error?.message ?? res.statusText}`)
  }
  return { metaMessageId: payload.messages[0].id }
}

/** Plafond de Meta pour une image WhatsApp ; au-delà, on refuse plutôt que
 *  de charger en mémoire un binaire inattendu. */
const MAX_MEDIA_BYTES = 16 * 1024 * 1024

/**
 * Rapatrie le binaire d'un média entrant. Deux appels : l'id donne une URL
 * signée de courte durée, puis l'URL donne le binaire — avec le même jeton,
 * l'URL seule renvoie une erreur. À appeler dès réception : l'URL expire.
 */
export async function downloadMedia(
  mediaId: string,
  accessToken: string,
): Promise<{ data: Buffer; mimeType: string }> {
  const version = process.env.META_API_VERSION || 'v21.0'
  const metaRes = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const meta = await metaRes.json() as { url?: string; mime_type?: string; file_size?: number; error?: { message: string } }
  if (!metaRes.ok || !meta.url) {
    throw new Error(`Média ${mediaId} introuvable chez Meta : ${meta.error?.message ?? metaRes.statusText}`)
  }
  if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) {
    throw new Error(`Média ${mediaId} trop volumineux (${meta.file_size} octets)`)
  }

  const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!binRes.ok) throw new Error(`Téléchargement du média ${mediaId} échoué : ${binRes.statusText}`)
  const data = Buffer.from(await binRes.arrayBuffer())
  if (data.length > MAX_MEDIA_BYTES) throw new Error(`Média ${mediaId} trop volumineux (${data.length} octets)`)

  return { data, mimeType: meta.mime_type ?? binRes.headers.get('content-type') ?? 'application/octet-stream' }
}

/**
 * Vérifie qu'un jeton donne bien accès à ce phone_number_id, et renvoie le
 * numéro affiché. Sert au raccordement d'une agence (packages/ops) : on ne
 * lie jamais un compte sans avoir vérifié la paire auprès de Meta.
 */
export async function getPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ displayPhoneNumber: string; verifiedName: string | null }> {
  const version = process.env.META_API_VERSION || 'v21.0'
  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const payload = await res.json() as { display_phone_number?: string; verified_name?: string; error?: { message: string } }
  if (!res.ok || !payload.display_phone_number) {
    throw new Error(`Meta refuse ce phone_number_id avec ce jeton : ${payload.error?.message ?? res.statusText}`)
  }
  return { displayPhoneNumber: payload.display_phone_number, verifiedName: payload.verified_name ?? null }
}

/**
 * Abonne notre application aux webhooks du WABA de l'agence — sans ça,
 * Meta n'envoie aucun message entrant de ce numéro. Idempotent.
 */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  const version = process.env.META_API_VERSION || 'v21.0'
  const res = await fetch(`https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const payload = await res.json() as { success?: boolean; error?: { message: string } }
  if (!res.ok || !payload.success) {
    throw new Error(`Abonnement aux webhooks du WABA refusé : ${payload.error?.message ?? res.statusText}`)
  }
}

/**
 * Le modèle écrit spontanément du Markdown ; WhatsApp a sa propre syntaxe
 * (*gras*, _italique_) et afficherait « **…** » ou « ### » tels quels chez
 * le client. Conversion minimale, appliquée à tout texte libre sortant.
 */
export function toWhatsappText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '_$1_')
    .replace(/^#{1,6}\s+/gm, '')
}
