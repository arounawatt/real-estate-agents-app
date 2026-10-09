export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** Un domaine propre au tenant, ou un domaine tiers (place de marché ou
 *  autre) — jamais deviné, seulement comparé à `tenant.listingDomains`. */
export function isOwnDomain(url: string, listingDomains: string[]): boolean {
  const host = hostOf(url)
  return listingDomains.some((d) => host === d || host.endsWith(`.${d}`))
}
