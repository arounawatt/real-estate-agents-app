/**
 * Libellés français des valeurs d'enum stockées en base.
 *
 * Couche de présentation uniquement : le stockage reste en anglais
 * (packages/db/src/schema.ts), l'utilisateur final lit du français. Voir
 * CLAUDE.md « Langue ».
 */

export const INTENT_LABELS: Record<string, string> = {
  purchase: 'Achat',
  rental: 'Location',
  investment: 'Investissement',
  to_qualify: 'À qualifier',
}

export const VISIT_MODE_LABELS: Record<string, string> = {
  link_sent: 'Lien envoyé',
  callback_announced: 'Rappel annoncé',
}

/** `tenant` ici veut dire « locataire » (le statut du contact), à ne pas
 *  confondre avec `tenants`/`tenantId` (l'agence cliente du SaaS). */
export const CONTACT_KIND_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  tenant: 'Locataire',
  unknown: 'À qualifier',
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  villa: 'Villa',
  land: 'Terrain',
  commercial: 'Commercial',
  to_qualify: 'À qualifier',
}

export const TIMELINE_LABELS: Record<string, string> = {
  immediate: 'Immédiat',
  three_months: 'Sous 3 mois',
  six_months: 'Sous 6 mois',
  later: 'Plus tard',
  to_qualify: 'À qualifier',
}

export const TICKET_NATURE_LABELS: Record<string, string> = {
  plumbing: 'Plomberie',
  electricity: 'Électricité',
  air_conditioning: 'Climatisation',
  locksmith: 'Serrurerie',
  gas: 'Gaz',
  admin: 'Administratif',
  other: 'Autre',
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  resolved: 'Résolu',
}

export const HABITABLE_LABELS: Record<string, string> = {
  yes: 'Oui',
  no: 'Non',
  partly: 'Partiellement',
}

export const UTILITY_CUT_LABELS: Record<string, string> = {
  none: 'Aucune',
  water: 'Eau',
  power: 'Électricité',
  water_and_power: 'Eau et électricité',
}

export const TRANSACTION_LABELS: Record<string, string> = {
  sale: 'Vente',
  long_term_rental: 'Location longue durée',
  short_term_rental: 'Location courte durée',
}

export const TYPOLOGY_LABELS: Record<string, string> = {
  studio: 'Studio',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
  f6_plus: 'F6+',
  none: '—',
}

export const FURNISHED_LABELS: Record<string, string> = {
  furnished: 'Meublé',
  unfurnished: 'Non meublé',
  partly: 'Partiellement meublé',
  to_qualify: 'À qualifier',
  none: '—',
}

export const CHARGES_LABELS: Record<string, string> = {
  excluded: 'Hors charges',
  included: 'Charges comprises',
  none: '—',
}

export const RENT_PERIOD_SUFFIX: Record<string, string> = {
  month: '/mois',
  week: '/semaine',
  night: '/nuit',
  none: '',
}

export const RENT_PERIOD_LABELS: Record<string, string> = {
  month: 'Au mois',
  week: 'À la semaine',
  night: 'À la nuit',
  none: 'Sans objet (vente)',
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Disponible',
  from_date: 'À partir d\'une date',
}

export const LISTING_STATUS_LABELS: Record<string, string> = {
  published: 'Publié',
  unpublished: 'Dépublié',
}

/** Nom du champ tel qu'un patron d'agence le reconnaît — utilisé pour
 *  signaler les entrées de `fieldsToConfirm`. */
export const PROPERTY_FIELD_LABELS: Record<string, string> = {
  areaSqm: 'Surface',
  furnished: 'Ameublement',
  price: 'Prix',
  typology: 'Typologie',
  floor: 'Étage',
  title: 'Titre',
  transaction: 'Transaction',
  type: 'Type de bien',
  city: 'Ville',
  district: 'Quartier',
  rooms: 'Pièces',
  bedrooms: 'Chambres',
  bathrooms: "Salles d'eau",
  amenities: 'Équipements',
  services: 'Services inclus',
}
