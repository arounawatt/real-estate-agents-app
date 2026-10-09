/**
 * Métadonnées des agents — centralisées pour ne pas dupliquer nom/rôle/
 * couleur entre l'accueil, le menu et les pages de liste.
 *
 * Pas de Sokhna ni d'Adja ici, même grisées avec « bientôt » : CLAUDE.md
 * est explicite — « On ne promet pas Sokhna ni Adja : elles n'existent
 * pas. » Les afficher, même désactivées, serait déjà une promesse.
 */
export const AGENTS = [
  {
    profile: 'sales',
    name: 'Coumba',
    role: 'Chargée de clientèle',
    href: '/leads',
    color: 'c1',
    description: "Je réponds à vos acheteurs et à vos candidats locataires sur WhatsApp, à toute heure. Je qualifie leur budget, leur zone et leur délai, puis je les oriente vers votre page de prise de rendez-vous.",
  },
  {
    profile: 'property_manager',
    name: 'Malick',
    role: 'Régisseur',
    href: '/tickets',
    color: 'c2',
    description: "Je reçois les demandes de vos locataires en place sur WhatsApp, avec photos. Je pose les bonnes questions, j'ouvre un dossier structuré et je vous remonte ce qui est urgent — sans que votre équipe décroche.",
  },
  {
    profile: 'catalogue',
    name: 'Amadou',
    role: 'Agent catalogue',
    href: '/properties',
    color: 'c4',
    description: "Vous me donnez l'adresse d'une de vos annonces, je la lis et j'en prépare la fiche : type, typologie, quartier, prix, équipements, services. Ce que l'annonce ne dit pas, je le laisse vide plutôt que de l'inventer — vous complétez, puis vous publiez.",
  },
] as const

export type AgentProfile = typeof AGENTS[number]['profile']
