/**
 * Lit une annonce hébergée par l'agence elle-même et en extrait les champs
 * du catalogue — c'est le travail qu'Amadou fait sur WhatsApp via
 * `fetchListingTool` (tools.ts). Le tableau de bord déclenche la même
 * chose en tâche de fond (apps/worker/src/listing-import-worker.ts,
 * file pg-boss) plutôt que dans la requête HTTP : certains sites ne
 * répondent qu'après plusieurs secondes de vérification anti-bot, hors de
 * question de dépendre d'un timeout serverless pour ça (même principe que
 * le webhook Meta). Même règle partout : un champ que la page ne dit pas
 * reste vide, jamais deviné — voir `fieldsToConfirm` dans
 * packages/db/src/schema.ts.
 *
 * Refuse toute URL hors des domaines d'annonces du tenant : Amadou ne lit
 * que les annonces de l'agence cliente, jamais celles d'une autre.
 *
 * Ce module ne contient QUE le fetch simple et l'extraction — pas de
 * navigateur headless ici, pour ne pas traîner Playwright/Chromium dans
 * tout ce qui dépend de @codaya/agent (dont le tableau de bord). Le repli
 * par navigateur, pour les sites qui bloquent un fetch sans JavaScript,
 * vit uniquement dans apps/worker. Il ne doit jamais cliquer sur un
 * CAPTCHA ni forcer un palier interactif : un blocage qui persiste reste
 * un échec honnête (`fetch_failed`), jamais contourné.
 */
import Anthropic from '@anthropic-ai/sdk'

export interface ListingExtraction {
  title: string | null
  transaction: 'sale' | 'long_term_rental' | 'short_term_rental' | null
  type: 'apartment' | 'villa' | 'land' | 'commercial' | null
  typology: 'studio' | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6_plus' | null
  city: string | null
  district: string | null
  floor: string | null
  areaSqm: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  price: number | null
  amenities: string[]
  services: string[]
  fieldsNotFound: string[]
}

export type ListingImportResult =
  | { ok: true; data: ListingExtraction; rawText: string }
  | { ok: false; reason: 'domain_not_allowed' | 'fetch_failed' | 'no_extraction' }

export function isOwnListingDomain(url: string, allowedDomains: string[]): boolean {
  let host: string
  try {
    host = new URL(url).host.replace(/^www\./, '')
  } catch {
    return false
  }
  return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`))
}

/** Signale un palier anti-bot (Cloudflare et équivalents) resté non résolu dans le HTML obtenu. */
export function looksLikeChallengePage(html: string): boolean {
  return /just a moment|cf-chl-|v[ée]rification de s[ée]curit[ée] en cours|checking your browser/i.test(html)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fetch simple, sans navigateur — suffit pour un site sans protection anti-bot. `null` si bloqué ou en échec. */
export async function fetchListingHtmlPlain(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CodayaImport/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    return looksLikeChallengePage(html) ? null : html
  } catch {
    return null
  }
}

const FIELD_NAMES = [
  'title', 'transaction', 'type', 'typology', 'city', 'district', 'floor',
  'areaSqm', 'rooms', 'bedrooms', 'bathrooms', 'price', 'amenities', 'services',
] as const

const extractListingTool = {
  name: 'save_extracted_listing',
  description:
    'Record only what this page actually states about the property. Omit a ' +
    'property entirely — never send an empty string, a zero or a guess — when ' +
    'the page does not say it. List every omitted field by name in fields_not_found.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' },
      transaction: { type: 'string', enum: ['sale', 'long_term_rental', 'short_term_rental'] },
      type: { type: 'string', enum: ['apartment', 'villa', 'land', 'commercial'] },
      typology: { type: 'string', enum: ['studio', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6_plus'] },
      city: { type: 'string' },
      district: { type: 'string' },
      floor: { type: 'string' },
      area_sqm: { type: 'integer' },
      rooms: { type: 'integer' },
      bedrooms: { type: 'integer' },
      bathrooms: { type: 'integer' },
      price: { type: 'integer', description: 'In XOF (FCFA) unless the page states otherwise.' },
      amenities: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Physical features or equipment on the property itself: climatisation, terrasse, '
          + 'ascenseur, garage/parking, vue mer, piscine, groupe électrogène, réservoir d’eau, '
          + 'local gardien, caméras de surveillance… Never an ongoing service someone performs.',
      },
      services: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Ongoing services performed by the agency or staff, not physical features: '
          + 'conciergerie, gardiennage, service de nettoyage/ménage, wifi inclus… '
          + 'A given item goes in amenities OR services, never both.',
      },
      fields_not_found: {
        type: 'array',
        items: { type: 'string', enum: FIELD_NAMES as unknown as string[] },
        description: 'Names of the fields above that the page did not state.',
      },
    },
    required: ['fields_not_found'],
  },
}

/** Étape d'extraction pure : à partir d'un HTML déjà obtenu (fetch simple ou navigateur), interroge Claude. */
export async function extractListingFromHtml(html: string): Promise<ListingImportResult> {
  const text = stripHtml(html).slice(0, 12000)
  if (text.length < 40) return { ok: false, reason: 'fetch_failed' }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let message
  try {
    message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 1024,
      system:
        "You read one real-estate listing page and extract the property's facts for a " +
        "Senegalese agency's catalogue. Never infer a value the page does not state — a " +
        'plausible surface or price that turns out wrong is worse than a blank field.',
      tools: [extractListingTool],
      tool_choice: { type: 'tool', name: 'save_extracted_listing' },
      messages: [{ role: 'user', content: `Page content:\n\n${text}` }],
    })
  } catch {
    return { ok: false, reason: 'no_extraction' }
  }

  const toolUse = message.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') return { ok: false, reason: 'no_extraction' }

  const input = toolUse.input as Record<string, unknown>
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : null)
  const num = (k: string) => (typeof input[k] === 'number' ? (input[k] as number) : null)

  const data: ListingExtraction = {
    title: str('title'),
    transaction: str('transaction') as ListingExtraction['transaction'],
    type: str('type') as ListingExtraction['type'],
    typology: str('typology') as ListingExtraction['typology'],
    city: str('city'),
    district: str('district'),
    floor: str('floor'),
    areaSqm: num('area_sqm'),
    rooms: num('rooms'),
    bedrooms: num('bedrooms'),
    bathrooms: num('bathrooms'),
    price: num('price'),
    amenities: Array.isArray(input.amenities)
      ? (input.amenities as unknown[]).filter((a): a is string => typeof a === 'string')
      : [],
    services: Array.isArray(input.services)
      ? (input.services as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
    fieldsNotFound: Array.isArray(input.fields_not_found)
      ? (input.fields_not_found as unknown[]).filter((f): f is string => typeof f === 'string')
      : [],
  }

  return { ok: true, data, rawText: text.slice(0, 3000) }
}

/**
 * Enchaîne les trois étapes avec le seul fetch simple (pas de navigateur) —
 * pratique pour un appel direct, mais c'est apps/worker qui l'utilise en
 * pratique aujourd'hui, avec son repli par navigateur en plus.
 */
export async function extractListingFromUrl(
  url: string,
  allowedDomains: string[],
): Promise<ListingImportResult> {
  if (allowedDomains.length === 0 || !isOwnListingDomain(url, allowedDomains)) {
    return { ok: false, reason: 'domain_not_allowed' }
  }
  const html = await fetchListingHtmlPlain(url)
  if (!html) return { ok: false, reason: 'fetch_failed' }
  return extractListingFromHtml(html)
}
