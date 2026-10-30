import { countryByIso, countryOfWaId, flagOf } from './countries'

/**
 * « Numéro France » : le pays d'un indicatif étranger, null pour un numéro
 * sénégalais. Le numéro est une donnée qu'on possède réellement, mais il ne
 * dit que le pays du NUMÉRO, pas celui de la personne (commentaire sur
 * `contacts` dans packages/db/src/schema.ts) — d'où ce libellé, et jamais
 * « Diaspora » : celui-là ne vient que de `contacts.residence`, déclaré.
 *
 * Les numéros sont stockés au format wa_id de Meta, sans « + » : l'ancien
 * test `startsWith('+221')` marquait donc TOUS les contacts comme diaspora.
 */
export function foreignNumberLabel(phone: string): string | null {
  const country = countryOfWaId(phone.replace(/\D/g, ''))
  if (!country || country.iso === 'SN') return null
  return `Numéro ${country.name}`
}

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
