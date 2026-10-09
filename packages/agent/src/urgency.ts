/**
 * L'urgence est CALCULÉE, jamais jugée — §3 des spécifications.
 *
 * Pourquoi ne pas demander à l'agent « est-ce urgent ? » : le modèle
 * répondrait à la FORMULATION autant qu'aux faits. Un locataire qui écrit
 * en majuscules pour une ampoule grillée passerait en urgent ; une personne
 * qui signale calmement une odeur de gaz ne passerait pas. Et le jour où
 * l'agence demande pourquoi un dossier n'était pas marqué urgent, il n'y
 * aurait aucune réponse à donner.
 *
 * L'agent établit quatre faits fermés. Le code en déduit le niveau.
 */

export type Habitable = 'yes' | 'no' | 'partly'
export type UtilityCut = 'none' | 'water' | 'power' | 'water_and_power'
export type UrgencyLevel = 'safety' | 'urgent' | 'normal' | 'low'

export interface TicketFacts {
  habitable?: Habitable | null
  utilityCut?: UtilityCut | null
  safetyRisk?: boolean | null
  worsening?: boolean | null
  /** Chemin de sécurité : gaz, feu, inondation, installation qui fume,
   *  personne blessée. Ce n'est PAS un niveau de plus dans l'échelle. */
  safetyReason?: string | null
  nature?: string | null
  /** Forçage manuel par l'agence — toujours tracé. */
  forced?: UrgencyLevel | null
}

export interface UrgencyResult {
  level: UrgencyLevel
  /** Le badge ne s'affiche JAMAIS sans sa raison : « Urgent · eau coupée »,
   *  jamais « Urgent » seul. Chaque affirmation montre d'où elle vient. */
  reason: string
  forced: boolean
}

const CUT_LABEL: Record<Exclude<UtilityCut, 'none'>, string> = {
  water: 'eau coupée',
  power: 'électricité coupée',
  water_and_power: 'eau et électricité coupées',
}

export function computeUrgency(facts: TicketFacts): UrgencyResult {
  if (facts.forced) {
    return { level: facts.forced, reason: 'forcé par l’agence', forced: true }
  }

  // Le chemin de sécurité prime sur tout le reste. Répondre « c'est bien
  // noté, l'agence revient vers vous » à une odeur de gaz serait une
  // mauvaise réponse, potentiellement dangereuse.
  if (facts.safetyReason) {
    return { level: 'safety', reason: facts.safetyReason, forced: false }
  }

  const reasons: string[] = []
  if (facts.habitable === 'no') reasons.push('logement inhabitable')
  else if (facts.habitable === 'partly') reasons.push('logement partiellement utilisable')

  if (facts.utilityCut && facts.utilityCut !== 'none') {
    reasons.push(CUT_LABEL[facts.utilityCut])
  }
  if (facts.safetyRisk) reasons.push('risque de sécurité')
  if (facts.worsening) reasons.push("situation qui s’aggrave")

  if (reasons.length) {
    return { level: 'urgent', reason: reasons[0]!, forced: false }
  }
  if (facts.nature === 'admin') {
    return { level: 'low', reason: 'demande administrative', forced: false }
  }
  return { level: 'normal', reason: '', forced: false }
}

/** Libellé complet du badge. Vide pour « normal » : on n'affiche pas ce
 *  qui n'apporte rien. */
export function urgencyBadge(r: UrgencyResult): string {
  if (r.level === 'safety') return `Sécurité · ${r.reason}`
  if (r.level === 'urgent') return `Urgent · ${r.reason}`
  if (r.level === 'low') return 'Faible'
  return ''
}

/**
 * Le niveau À AFFICHER d'un dossier stocké : le forçage de l'agence prime
 * sur le niveau calculé. Une seule fonction pour toutes les vues — une liste
 * qui ignorerait le forçage afficherait « Urgent » pour un dossier que
 * l'agence a explicitement rétrogradé.
 */
export function storedUrgency(ticket: {
  urgency: UrgencyLevel
  urgencyReason: string | null
  urgencyForced: UrgencyLevel | null
}): UrgencyResult {
  return ticket.urgencyForced
    ? { level: ticket.urgencyForced, reason: 'forcé par l’agence', forced: true }
    : { level: ticket.urgency, reason: ticket.urgencyReason ?? '', forced: false }
}
