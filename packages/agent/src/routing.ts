/**
 * Routage par identité du contact.
 *
 * TROIS BRANCHES DÈS MAINTENANT, même si la troisième ne fait encore rien.
 * Ajouter une branche dans un routeur déjà en production est un chantier ;
 * la prévoir vide ne coûte rien. Voir docs/agent-assistant-direction.md.
 */

export type AgentProfile = 'sales' | 'property_manager' | 'catalogue' | 'assistant'

export interface RoutingInput {
  /** Le numéro figure-t-il dans agency_users de CE tenant ? */
  isAgencyUser: boolean
  /** Le contact est-il un locataire connu en base ? */
  isKnownTenantContact: boolean
  /** Malick n'est actif que si le tenant est en plan `complete`. */
  plan: 'essential' | 'complete'
}

export function routeProfile(input: RoutingInput): AgentProfile {
  // Adja — conçue, pas construite. La branche existe pour que le jour où
  // elle arrive, rien ne soit à refactorer dans le chemin critique.
  if (input.isAgencyUser) return 'assistant'

  if (input.isKnownTenantContact && input.plan === 'complete') return 'property_manager'

  // Un locataire connu chez une agence en plan `essential` n'a pas de
  // régisseur : Coumba le prend, et escaladera. Mieux vaut une réponse
  // humaine qu'un agent qui n'existe pas.
  return 'sales'
}
