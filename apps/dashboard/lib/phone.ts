/**
 * Le numéro est une donnée qu'on possède réellement — ce n'est pas une
 * déduction. Ne sert qu'à distinguer un indicatif étranger, jamais à
 * déduire une ville : « l'indicatif donne le pays du numéro, pas celui de
 * la personne » (packages/db/src/schema.ts, commentaire sur `contacts`).
 */
export function isForeignNumber(phone: string): boolean {
  return !phone.replace(/\s/g, '').startsWith('+221')
}

import { countryByIso, countryOfWaId, flagOf } from './countries'

/**
 * Indicatif choisi + numéro national → format wa_id de Meta (chiffres,
 * indicatif compris, sans « + »), qui est ce que le webhook compare.
 *
 * Le 0 de tête du numéro national est retiré (06… en France → 6…), sauf en
 * Italie et au Vatican où il fait partie du numéro. Si la personne colle un
 * numéro international complet (+… ou 00…), il prime sur le menu.
 */
export function toWaId(countryIso: string, input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, '')
  const international = compact.match(/^(?:\+|00)(\d+)$/)
  let digits: string
  if (international) {
    digits = international[1]!
  } else {
    const country = countryByIso(countryIso)
    if (!country || !/^\d+$/.test(compact)) return null
    const national = country.dial === '39' ? compact : compact.replace(/^0/, '')
    digits = country.dial + national
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

/** « 🇸🇳 +221 771234567 » — le drapeau situe le numéro, rien de plus. */
export function formatWaId(waId: string): string {
  const country = countryOfWaId(waId)
  return country ? `${flagOf(country.iso)} +${country.dial} ${waId.slice(country.dial.length)}` : `+${waId}`
}
