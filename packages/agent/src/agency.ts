/**
 * Comment désigner l'agence dans un message au client. Le nom est
 * facultatif (page « Mes paramètres ») : sans lui, « l'agence » — jamais un nom
 * deviné, et jamais « Codaya », qui n'est pas l'agence du client.
 */
export function agencyReference(name: string | null): string {
  return name?.trim() || "l'agence"
}
