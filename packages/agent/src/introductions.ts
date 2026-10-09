/**
 * Présentation envoyée au TOUT PREMIER message d'une conversation, écrite par
 * le code et placée en tête de la réponse : la formulation ne dépend pas du
 * modèle, et l'obligation de se présenter comme automate (§4 des
 * spécifications) est tenue à coup sûr.
 *
 * Elle dit trois choses : qui écrit (un assistant automatique, pas une
 * personne), que des réponses précises font avancer plus vite, et que le but
 * est qu'un membre de l'équipe revienne vers la personne avec sa demande
 * traitée. Aucun délai — c'est une promesse que l'agence tient, pas une heure.
 */
import { agencyReference } from './agency.js'

export function buildIntroduction(profile: 'sales' | 'property_manager', agencyName: string | null): string {
  const agency = agencyReference(agencyName)
  if (profile === 'property_manager') {
    return `Bonjour, je suis Malick, l'assistant automatique de ${agency} pour les locataires. `
      + 'Je vais vous poser quelques questions courtes : plus vos réponses sont précises, mieux votre '
      + 'demande sera traitée. Mon but : qu\'un membre de l\'équipe revienne vers vous avec tout ce qu\'il '
      + 'faut pour régler votre problème.'
  }
  return `Bonjour, je suis Coumba, l'assistante automatique de ${agency}. `
    + 'Je vais vous poser quelques questions courtes : plus vos réponses sont précises, mieux je pourrai '
    + 'cerner votre projet. Mon but : qu\'un membre de l\'équipe revienne vers vous avec ce qu\'il faut '
    + 'pour vous accompagner.'
}

/** Consigne ajoutée au prompt du premier tour : la présentation est déjà
 *  faite par le système, l'agent ne doit pas la doubler. */
export const FIRST_MESSAGE_RULE =
  'PREMIER MESSAGE DE LA CONVERSATION : le système envoie déjà, juste avant ta réponse, ta présentation '
  + '(ton prénom, assistant automatique, l\'objectif). Ne dis pas bonjour, ne te présente pas, ne répète '
  + 'pas cet objectif : enchaîne directement sur la demande de la personne.'

/** Assemble présentation et réponse. Si le chemin de sécurité a été déclenché,
 *  la consigne de sécurité passe AVANT : rien ne doit la retarder. */
export function withIntroduction(reply: string, introduction: string, safetyFirst = false): string {
  return safetyFirst ? `${reply}\n\n${introduction}` : `${introduction}\n\n${reply}`
}
