/**
 * Bibliothèque de templates — huit, strictement identiques pour tous les tenants.
 *
 * Les templates appartiennent au WABA de chaque client : on pousse cette
 * définition N fois, mais on n'en maintient qu'une. C'est ce que permet la
 * règle « aucun template ne porte de lien » : sans adresse dans le corps,
 * il n'y a plus rien à faire varier par agence.
 *
 * Trois règles, toutes vérifiées par `validateTemplates()` :
 *   · aucun lien, nulle part ;
 *   · une question fermée et des boutons, jamais « répondez OUI » ;
 *   · toute relance marketing porte un bouton de retrait.
 *
 * Paramètres NOMMÉS (`parameter_format: "named"`), en minuscules avec
 * underscores. Un template ne peut pas mélanger nommé et positionnel, et
 * relu six mois plus tard, `{{first_name}}` reste lisible là où `{{1}}`
 * ne l'est pas.
 */

export type TemplateCategory = 'UTILITY' | 'MARKETING'

export interface TemplateDefinition {
  name: string
  category: TemplateCategory
  language: string
  body: string
  /** Libellés des boutons de réponse rapide. */
  buttons: string[]
  /** À quoi il sert, et quand il part. Sert de documentation au code appelant. */
  purpose: string
}

/** Meta annonce 25 caractères ; des guides tiers citent encore 20 et
 *  l'éditeur du fournisseur peut être plus strict. On reste sous 20,
 *  ce qui est de toute façon meilleur à l'affichage sur un téléphone. */
export const BUTTON_MAX_LENGTH = 20
export const BODY_MAX_LENGTH = 1024
export const OPT_OUT_LABEL = 'Ne plus me contacter'

export const TEMPLATES: TemplateDefinition[] = [
  {
    name: 'lead_followup_no_reply',
    // Relancer un prospect qui n'a pas répondu est une sollicitation
    // commerciale, quel que soit le ton. Déclaré en utility, Meta le
    // requalifie en marketing — autant le déclarer honnêtement.
    category: 'MARKETING',
    language: 'fr',
    body: "Bonjour {{first_name}}, nous n'avons pas eu votre retour concernant {{property_name}}. Souhaitez-vous programmer une visite ?",
    buttons: ['Oui, une visite', 'Plus tard', OPT_OUT_LABEL],
    purpose: "Relance sur un bien précis, hors fenêtre de 24 h.",
  },
  {
    name: 'lead_reengage',
    category: 'MARKETING',
    language: 'fr',
    body: "Bonjour {{first_name}}, je n'ai pas eu votre retour. J'ai plusieurs biens qui correspondent à ce que vous cherchez. Je vous les envoie ?",
    buttons: ['Oui, envoyez', 'Plus tard', OPT_OUT_LABEL],
    purpose: "Rallume une conversation éteinte sans rien promettre de précis.",
  },
  {
    name: 'new_listing_match',
    category: 'MARKETING',
    language: 'fr',
    body: "Bonjour {{first_name}}, un nouveau bien correspond à votre recherche : {{property_name}}, {{property_price}}. Je vous envoie la fiche ?",
    buttons: ['Oui, envoyez', 'Non merci', OPT_OUT_LABEL],
    purpose: "Nouveau bien au catalogue correspondant à une qualification.",
  },
  {
    name: 'visit_slot',
    category: 'UTILITY',
    language: 'fr',
    // Ne propose plus de créneau : aucun agenda n'est intégré. Le tap
    // rouvre la fenêtre, et le lien de prise de rendez-vous part ensuite
    // en message libre.
    body: "Bonjour {{first_name}}, souhaitez-vous programmer une visite de {{property_name}} ?",
    buttons: ['Oui, programmer', 'Plus tard'],
    purpose: "Ouvre la voie à l'envoi du lien de prise de rendez-vous.",
  },
  {
    name: 'visit_slot_followup',
    category: 'UTILITY',
    language: 'fr',
    body: "Bonjour {{first_name}}, nous n'avons pas eu votre retour concernant la visite de {{property_name}}. Souhaitez-vous toujours la programmer ?",
    buttons: ['Oui, programmer', 'Plus tard'],
    purpose: "Relance après un lien envoyé ou un rappel annoncé resté sans suite.",
  },
  {
    name: 'ticket_received',
    category: 'UTILITY',
    language: 'fr',
    // N'annonce AUCUN délai. L'ancienne rédaction portait un
    // {{response_delay}}, ce qui contredisait la règle « Malick constate,
    // il n'engage rien » : une promesse d'automate non tenue devient un
    // litige pour l'agence.
    body: "Bonjour {{first_name}}, votre demande concernant {{issue_summary}} est enregistrée sous le numéro {{ticket_number}}. L'agence revient vers vous dès qu'un créneau d'intervention est fixé.",
    buttons: ['Ajouter un détail', 'Autre problème'],
    purpose: "Accusé de réception d'un dossier, hors fenêtre de 24 h.",
  },
  {
    name: 'ticket_status_update',
    category: 'UTILITY',
    language: 'fr',
    body: "Bonjour {{first_name}}, votre dossier {{ticket_number}} ({{issue_summary}}) est passé au statut : {{ticket_status}}.",
    buttons: ['En savoir plus', "Ce n'est pas réglé"],
    purpose: "Changement de statut d'un dossier.",
  },
  {
    name: 'handover',
    category: 'UTILITY',
    language: 'fr',
    body: "Bonjour {{first_name}}, un conseiller de {{agency_name}} va vous contacter personnellement au sujet de {{subject}}.",
    buttons: ["J'attends l'appel", 'Rappeler plus tard'],
    purpose: "L'agence a repris la main. Ne part QUE si elle appelle vraiment.",
  },
]

/* ─────────────────────── Vérifications ───────────────────────
 * À exécuter en intégration continue. Une règle non outillée n'est pas
 * une règle : deux valeurs hors liste s'étaient déjà glissées dans les
 * données de démonstration, écrites par celui-là même qui venait de
 * rédiger la règle.
 * ─────────────────────────────────────────────────────────── */

const LINK_PATTERN = /https?:\/\/|www\.|\{\{\s*\w*url\w*\s*\}\}/i
const KEYWORD_PATTERN = /r[ée]pondez\s+[A-ZÉÈ]{2,}/i

export function validateTemplates(defs: TemplateDefinition[] = TEMPLATES): string[] {
  const errors: string[] = []

  for (const t of defs) {
    if (LINK_PATTERN.test(t.body)) {
      errors.push(`${t.name} : contient un lien. Aucun template n'en porte.`)
    }
    if (KEYWORD_PATTERN.test(t.body)) {
      errors.push(`${t.name} : demande d'écrire un mot-clé. Utiliser des boutons.`)
    }
    if (t.body.length > BODY_MAX_LENGTH) {
      errors.push(`${t.name} : corps de ${t.body.length} caractères, maximum ${BODY_MAX_LENGTH}.`)
    }
    if (t.buttons.length === 0) {
      errors.push(`${t.name} : aucun bouton. Chaque template finit par une question fermée.`)
    }
    for (const b of t.buttons) {
      if (b.length > BUTTON_MAX_LENGTH) {
        errors.push(`${t.name} : bouton « ${b} » de ${b.length} caractères, maximum ${BUTTON_MAX_LENGTH}.`)
      }
    }
    if (t.category === 'MARKETING' && !t.buttons.includes(OPT_OUT_LABEL)) {
      errors.push(
        `${t.name} : relance marketing sans bouton de retrait. ` +
        `C'est l'opposition au sens de l'article 21 du RGPD, et c'est ce qui ` +
        `protège la note de qualité du numéro.`,
      )
    }
  }

  const names = defs.map((t) => t.name)
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  if (dupes.length) errors.push(`Noms en double : ${[...new Set(dupes)].join(', ')}`)

  return errors
}

/** Charge utile de création, à pousser sur le WABA de chaque tenant. */
export function toMetaPayload(t: TemplateDefinition) {
  return {
    name: t.name,
    language: t.language,
    category: t.category,
    parameter_format: 'named' as const,
    components: [
      { type: 'BODY', text: t.body },
      {
        type: 'BUTTONS',
        buttons: t.buttons.map((text) => ({ type: 'QUICK_REPLY', text })),
      },
    ],
  }
}
