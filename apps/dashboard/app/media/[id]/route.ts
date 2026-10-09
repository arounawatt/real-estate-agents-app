import { getMedia } from '@codaya/db'
import { getOptionalSession } from '@/lib/session'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sert une photo reçue sur WhatsApp. Bornée au tenant de la session : un id
 * valide d'une autre agence répond 404, exactement comme un id inexistant.
 * Ces photos montrent l'intérieur d'un logement — jamais d'accès sans session.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession()
  if (!session) return new Response(null, { status: 401 })
  const { id } = await params
  if (!UUID_PATTERN.test(id)) return new Response(null, { status: 404 })

  const media = await getMedia(session.tenantId, id)
  if (!media) return new Response(null, { status: 404 })

  // Seules les images s'affichent dans le navigateur ; tout autre type est
  // proposé en téléchargement plutôt qu'interprété.
  const isImage = /^image\/(jpeg|png|webp|gif)$/.test(media.mimeType)
  return new Response(new Uint8Array(media.data), {
    headers: {
      'Content-Type': isImage ? media.mimeType : 'application/octet-stream',
      'Content-Disposition': isImage ? 'inline' : 'attachment',
      // Une photo reçue ne change jamais : cache long, mais privé.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
