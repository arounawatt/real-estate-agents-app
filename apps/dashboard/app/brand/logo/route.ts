import { getTenantLogo } from '@codaya/db'
import { getOptionalSession } from '@/lib/session'

/**
 * Sert le logo du tenant de la session. L'URL porte `?v=` (logoUpdatedAt) :
 * un nouveau logo change l'URL, donc le cache peut être long. `private` :
 * l'URL est la même pour tous les tenants, un cache partagé les mélangerait.
 */
export async function GET() {
  const session = await getOptionalSession()
  if (!session) return new Response(null, { status: 401 })
  const logo = await getTenantLogo(session.tenantId)
  if (!logo) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(logo.data), {
    headers: {
      'Content-Type': logo.mimeType,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
