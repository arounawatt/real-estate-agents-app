import { getTenant } from '@codaya/db'

/**
 * Comment désigner l'agence dans un message au client. Le nom est
 * facultatif (page « Mes paramètres ») : sans lui, « l'agence » — jamais un nom
 * deviné, et jamais « Codaya », qui n'est pas l'agence du client.
 */
export function agencyReference(name: string | null): string {
  return name?.trim() || "l'agence"
}

/**
 * Ce que renvoie l'outil get_agency_info : les coordonnées saisies par
 * l'agence dans « Mes paramètres », telles quelles. Un champ null est un
 * champ que l'agent n'a pas — il le dit, il ne le complète pas.
 */
export async function readAgencyInfo(tenantId: string) {
  const tenant = await getTenant(tenantId)
  if (!tenant) return { error: 'not_found' }
  return {
    name: tenant.name?.trim() || null,
    address: tenant.address,
    phone: tenant.phone,
    email: tenant.contactEmail,
    opening_hours: tenant.openingHours,
  }
}

/**
 * Le téléphone de l'agence ressemble à un montant pour screenOutbound(), qui
 * retiendrait le message qui le donne. On autorise ses chiffres, avec ou sans
 * indicatif (« +221 77 123 45 67 » comme « 77 123 45 67 »). Plusieurs numéros
 * peuvent être saisis, séparés par une virgule, un point-virgule ou « / ».
 */
export function agencyPhoneAmounts(phone: string | null): number[] {
  if (!phone) return []
  const amounts: number[] = []
  for (const part of phone.split(/[,;/]/)) {
    const digits = part.replace(/\D/g, '')
    for (let i = 0; i + 7 <= digits.length; i++) amounts.push(Number(digits.slice(i)))
  }
  return amounts
}
