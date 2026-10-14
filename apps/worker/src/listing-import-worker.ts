/**
 * Traite un job `listing_import` mis en file par le tableau de bord (bouton
 * « Analyser l'annonce », apps/dashboard/lib/actions.ts). C'est le seul
 * endroit du produit qui lance un navigateur : réservé aux sites qui
 * bloquent un fetch simple (portails tiers avec Cloudflare et équivalents).
 * Le site de l'agence elle-même n'en a normalement pas besoin.
 *
 * `fetchWithBrowser` laisse le palier de vérification se résoudre tout
 * seul, de façon passive (attente fixe, aucune interaction). S'il reste
 * bloqué — palier interactif, IP bannie — c'est un échec honnête, jamais
 * contourné : voir packages/agent/src/listing-import.ts.
 */
import {
  extractListingFromHtml, fetchListingHtmlPlain, importableListingDomains, isOwnListingDomain, looksLikeChallengePage,
} from '@codaya/agent'
import {
  completeListingImportJob, failListingImportJob, getTenant, tenantAccess,
} from '@codaya/db'
import { chromium } from 'playwright'

async function fetchListingHtmlWithBrowser(url: string): Promise<string | null> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    // Laisse un palier de vérification JS se résoudre tout seul — jamais d'interaction.
    await page.waitForTimeout(6000)
    const html = await page.content()
    return looksLikeChallengePage(html) ? null : html
  } catch {
    return null
  } finally {
    await browser.close()
  }
}

export interface ListingImportJobData {
  jobId: string
  tenantId: string
  url: string
}

export async function processListingImportJob(data: ListingImportJobData) {
  const { jobId, tenantId, url } = data

  const tenant = await getTenant(tenantId)
  // Agence désactivée ou en fin d'accès entre la mise en file et le
  // traitement : pas d'appel au modèle pour une agence qui n'a plus accès.
  if (!tenant || tenantAccess(tenant) !== 'active') {
    await failListingImportJob(jobId, 'tenant_disabled')
    return
  }
  if (!isOwnListingDomain(url, importableListingDomains(tenant.listingDomains))) {
    await failListingImportJob(jobId, 'domain_not_allowed')
    return
  }

  const html = (await fetchListingHtmlPlain(url)) ?? (await fetchListingHtmlWithBrowser(url))
  if (!html) {
    await failListingImportJob(jobId, 'fetch_failed')
    return
  }

  const result = await extractListingFromHtml(html)
  if (!result.ok) {
    await failListingImportJob(jobId, result.reason)
    return
  }
  await completeListingImportJob(jobId, result.data, result.rawText)
}
