/**
 * Ce que l'en-tête affiche pour l'agence — avec les replis voulus :
 * pas de nom → le nom et l'accroche du produit (PRODUCT_NAME, PRODUCT_TAGLINE) ;
 * pas de logo → l'initiale du titre sur fond de marque.
 */
export type Brand = { title: string; subtitle: string; initial: string; logoUrl: string | null }

/** Nom et accroche du produit : repli de l'en-tête, et marque de la page de
 *  connexion (avant connexion, on ne sait pas de quelle agence il s'agit). */
export const PRODUCT_NAME = 'Keurbi'
export const PRODUCT_TAGLINE = "de l'IA dans votre agence"

export function brandOf(tenant: { name: string | null; logoUpdatedAt: Date | null } | null): Brand {
  const name = tenant?.name?.trim() ?? ''
  const title = name || PRODUCT_NAME
  return {
    title,
    subtitle: name ? 'par Codaya' : PRODUCT_TAGLINE,
    initial: title[0]!.toUpperCase(),
    logoUrl: tenant?.logoUpdatedAt ? `/brand/logo?v=${tenant.logoUpdatedAt.getTime()}` : null,
  }
}
