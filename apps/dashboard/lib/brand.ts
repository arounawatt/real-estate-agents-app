/**
 * Ce que l'en-tête affiche pour l'agence — avec les replis voulus :
 * pas de nom → « Codaya » et « de l'IA dans votre agence » ; pas de logo →
 * l'initiale du nom sur fond de marque (« C » si pas de nom non plus).
 */
export type Brand = { title: string; subtitle: string; initial: string; logoUrl: string | null }

export function brandOf(tenant: { name: string | null; logoUpdatedAt: Date | null } | null): Brand {
  const name = tenant?.name?.trim() ?? ''
  const title = name || 'Codaya'
  return {
    title,
    subtitle: name ? 'par Codaya' : "de l'IA dans votre agence",
    initial: title[0]!.toUpperCase(),
    logoUrl: tenant?.logoUpdatedAt ? `/brand/logo?v=${tenant.logoUpdatedAt.getTime()}` : null,
  }
}
