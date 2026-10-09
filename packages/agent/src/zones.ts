/**
 * Périmètre de réponse des agents — §9 des spécifications.
 *
 * Le comportement par défaut d'un modèle est de répondre à tout, y compris
 * sur le titre foncier et la fiscalité de l'investissement au Sénégal, avec
 * un aplomb parfait. C'est le risque, pas la solution : ce message part au
 * nom de l'agence.
 *
 * Ce fichier est la source de vérité d'où se dérivent les prompts système.
 * Jamais l'inverse : une règle écrite seulement dans un prompt se perd à la
 * première réécriture.
 *
 * QUATRE COUCHES, JAMAIS LE PROMPT SEUL — une consigne de refus dans un
 * prompt fuit, après trente messages ou face à un client insistant :
 *   1. le prompt porte la règle (`renderZonePrompt`) ;
 *   2. `escalate_to_human` en fait une action, pas une intention ;
 *   3. `screenOutbound()` retient le message sortant avant envoi ;
 *   4. un jeu de conversations pièges est rejoué à chaque changement de prompt.
 */

export type Zone = 'green' | 'amber' | 'red'

/** Réglage par tenant de la SEULE zone orange. La rouge n'est configurable
 *  par personne, pas même sur demande d'un client qui trouverait son agent
 *  trop timide : c'est ce qui protège Codaya, et c'est un argument de vente. */
export type DisclosureLevel = 'listing_only' | 'neighbourhood'

/* ───────────────────────── Zone rouge ─────────────────────────
 * Ces questions sont exactement celles que pose un acheteur diaspora
 * sérieux — et ce sont celles où la vente se joue. L'escalade est le bon
 * réflexe métier, pas un aveu de faiblesse.
 * ─────────────────────────────────────────────────────────── */

export const RED_ZONE_TOPICS = {
  legal: [
    'titre foncier', 'bail', 'succession', 'indivision', 'notaire',
    'acte de vente', 'régularité juridique', 'litige', 'expulsion',
    'congé', 'dépôt de garantie', 'augmentation de loyer',
  ],
  financial: [
    'fiscalité', 'impôt', 'crédit', 'financement', 'prêt',
    'frais d\'enregistrement', 'rendement', 'rentabilité',
  ],
} as const

/**
 * La non-discrimination est une zone rouge à part entière, et NON DÉROGEABLE.
 *
 * « Est-ce qu'il y a beaucoup d'étrangers dans l'immeuble ? », « le
 * propriétaire accepte les familles nombreuses ? » sont des questions qu'un
 * agent immobilier reçoit réellement.
 *
 * L'agent ne répond pas, ne filtre pas le catalogue là-dessus, et surtout
 * N'ÉCRIT RIEN DE TEL DANS `notes` — sinon on construit tranquillement une
 * base de données de critères illégaux. Il ramène poliment la conversation
 * sur les critères du bien.
 */
export const DISCRIMINATION_TOPICS = [
  'origine', 'nationalité', 'ethnie', 'religion', 'communauté',
  'situation familiale', 'handicap', 'état de santé', 'orientation',
  // Ajoutés le 2026-09-25 : la première liste ne contenait aucun des mots
  // réellement employés. « Il y a beaucoup d'étrangers dans l'immeuble ? »
  // passait le filet — la règle était écrite mais pas appliquée.
  'étranger', 'étrangers', 'musulman', 'chrétien',
  'couleur de peau', 'famille nombreuse',
] as const

/* ───────────── Engagements interdits — tous agents, sans exception ─────────────
 * Plus dangereux encore qu'une information fausse. Un message WhatsApp d'une
 * agence qui dit « oui, on peut faire 270 millions » pèse dans une
 * négociation, et il part sous son nom.
 * ─────────────────────────────────────────────────────────────────────────── */

export const FORBIDDEN_COMMITMENTS = [
  'negotiate_or_announce_price',   // y compris une remise
  'promise_availability',          // ou réserver un bien
  'accept_application',            // valider un dossier de candidature
  'confirm_visit_as_final',        // l'agent propose, l'agence confirme
  'commit_to_delay_or_cost',       // délai d'intervention, coût, qui paie
  'promise_yield',
] as const

/* ───────────────────────── Zone orange ───────────────────────── */

export const AMBER_RULES = {
  listing_only:
    "Hors des données du catalogue, renvoyer au conseiller.",
  neighbourhood:
    "Décrire un quartier par des faits STABLES ET VÉRIFIABLES : résidentiel " +
    "ou commerçant, en bord de mer ou non, proximité d'un axe, présence " +
    "d'écoles ou de commerces. Interdits même si le client insiste : tout " +
    "prix ou ordre de grandeur hors catalogue, toute tendance ou prévision, " +
    "et tout jugement sur la sécurité, la réputation, la qualité de vie ou " +
    "le voisinage — invérifiable et lourd de conséquences. " +
    "Dans cette zone : ATTRIBUER OU SE TAIRE (« d'après la fiche », " +
    "« d'après l'agence »). Jamais une affirmation flottante dont personne " +
    "ne pourra dire d'où elle sort.",
} satisfies Record<DisclosureLevel, string>

/* ───────────────────────── Escalade ───────────────────────── */

export type EscalationTrigger =
  | 'red_zone'
  | 'user_asked'
  | 'distress'
  | 'no_progress'
  | 'safety'

/**
 * EN CAS DE DOUTE, ON ESCALADE. L'asymétrie est nette : une escalade
 * inutile coûte une minute à l'agence, une escalade manquée coûte un client
 * ou un litige. C'est le seul endroit du produit où l'on préfère l'excès à
 * la prudence.
 *
 * Et ESCALADER N'EST PAS RACCROCHER : l'agent continue de répondre en zone
 * verte pendant que le conseiller arrive. Se taire d'un coup après vingt
 * messages est la pire des sorties.
 */
export const ESCALATION_RULES = {
  whenInDoubt: 'escalate',
  keepTalking: true,
  /** Hors horaires : annoncer le rappel SANS donner d'heure. Vrai, tenable,
   *  et n'engage sur aucun créneau que l'agence pourrait rater. La diaspora
   *  est justement le segment qui écrit la nuit. */
  outOfHoursMessage:
    "Un conseiller vous recontacte dès l'ouverture.",
} as const

/* ───────────────────────── Filet de sécurité en sortie ───────────────────────── */

export interface OutboundScreenResult {
  ok: boolean
  reasons: string[]
}

/**
 * Contrôle du message sortant AVANT envoi. Même logique que l'urgence
 * calculée : on ne confie pas au modèle un jugement dont l'erreur coûte cher.
 *
 * @param text        le message que le modèle veut envoyer
 * @param knownPrices les montants présents dans le catalogue pour cette
 *                    conversation. Un montant absent de cette liste est une
 *                    négociation ou une invention : le message est retenu.
 */
export function screenOutbound(text: string, knownPrices: number[]): OutboundScreenResult {
  const reasons: string[] = []
  const haystack = text.toLowerCase()

  for (const topic of [...RED_ZONE_TOPICS.legal, ...RED_ZONE_TOPICS.financial]) {
    if (haystack.includes(topic)) reasons.push(`sujet de zone rouge : « ${topic} »`)
  }
  for (const topic of DISCRIMINATION_TOPICS) {
    if (haystack.includes(topic)) reasons.push(`sujet discriminatoire : « ${topic} »`)
  }

  // Montants à cinq chiffres ou plus, espaces et points de milliers tolérés.
  const amounts = [...text.matchAll(/\b\d[\d . ]{4,}\d\b/g)]
    .map((m) => Number(m[0].replace(/[ . ]/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 10_000)

  for (const amount of amounts) {
    if (!knownPrices.includes(amount)) {
      reasons.push(`montant absent du catalogue : ${amount}`)
    }
  }

  return { ok: reasons.length === 0, reasons }
}

/* ───────────────────────── Rendu pour le prompt ───────────────────────── */

export function renderZonePrompt(level: DisclosureLevel): string {
  return [
    '## Ce dont tu parles, et ce que tu ne dis jamais',
    '',
    "ZONE VERTE — les biens du catalogue, les modalités de visite, les horaires",
    "et coordonnées de l'agence, les étapes du parcours telles que l'agence les a",
    "décrites. Tu réponds librement, en t'appuyant sur tes outils. Ce qui n'est pas",
    "dans la fiche, tu dis que tu ne l'as pas — tu n'inventes jamais pour combler.",
    '',
    `ZONE ORANGE — ${AMBER_RULES[level]}`,
    '',
    'ZONE ROUGE — juridique, fiscal, financier. Tu ne réponds pas : tu appelles',
    "`escalate_to_human`. Ce n'est pas une faiblesse — ce sont les questions où la",
    "vente se joue, et c'est le moment où un conseiller doit prendre le relais.",
    '',
    "Les questions qui trient sur l'origine, la religion, la situation familiale,",
    "l'état de santé ou le handicap : tu ne réponds pas, tu ne filtres pas le",
    "catalogue là-dessus, et tu n'enregistres rien de tel. Tu ramènes poliment la",
    'conversation sur les critères du bien.',
    '',
    "TU N'ENGAGES JAMAIS L'AGENCE. Tu ne négocies ni n'annonces un prix ou une",
    'remise, tu ne promets aucune disponibilité et ne réserves rien, tu ne valides',
    'aucun dossier, tu ne confirmes jamais une visite comme définitive, tu ne',
    "t'engages sur aucun délai, aucun coût, ni sur qui paie, et tu ne promets aucun",
    'rendement. Aucune de ces interdictions ne se négocie.',
    '',
    "EN CAS DE DOUTE, TU ESCALADES — et tu continues à répondre sur le reste.",
  ].join('\n')
}

/**
 * Les zones de Malick (§9, « Les zones de Malick ») — son métier n'est pas
 * celui de Coumba, ses zones non plus. Pas de réglage par tenant ici : la
 * zone orange de Malick (gestes conservatoires) est la même pour tous.
 */
export function renderPropertyManagerZonePrompt(): string {
  return [
    '## Ce dont tu parles, et ce que tu ne dis jamais',
    '',
    'ZONE VERTE — la prise en compte de la demande, les quatre questions fermées',
    '(logement habitable ? eau ou électricité coupée ? porte ou installation qui',
    'met en danger ? situation qui empire ?), le numéro de dossier, et la consigne',
    'du chemin de sécurité, qui passe AVANT tout le reste.',
    '',
    'ZONE ORANGE — des gestes conservatoires simples et sans risque, pour limiter',
    "les dégâts en attendant : fermer le robinet d'arrêt, couper le disjoncteur,",
    'éponger, déplacer ce qui craint l\'eau. Rien de plus. Tu ne fais AUCUN',
    "diagnostic de la panne et tu ne donnes AUCUNE instruction de réparation.",
    '',
    "ZONE ROUGE — le délai d'intervention, le coût, qui prend en charge les",
    'travaux, l\'interprétation du bail, et toutes les questions juridiques',
    'locatives : congé, dépôt de garantie, augmentation de loyer, expulsion.',
    'Tu ne réponds pas : tu appelles `escalate_to_human`, puis tu continues',
    'de répondre sur le reste.',
    '',
    "TU CONSTATES, TU N'ENGAGES RIEN. Tu confirmes que la demande est prise en",
    "compte et que l'agence communiquera un créneau. Tu n'annonces JAMAIS de délai,",
    "même approximatif, même si le locataire insiste — ni de coût, ni qui paie.",
    '',
    "EN CAS DE DOUTE, TU ESCALADES — et tu continues à répondre sur le reste.",
  ].join('\n')
}
