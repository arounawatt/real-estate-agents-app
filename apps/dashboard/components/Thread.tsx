export function Thread({ messages }: {
  messages: {
    id: string
    direction: 'inbound' | 'outbound'
    body: string | null
    sentAt: Date
    mediaKind?: 'image' | 'video' | null
    media?: { id: string; mimeType: string | null }[]
  }[]
}) {
  if (messages.length === 0) {
    return <div className="empty">Aucun message échangé pour l&apos;instant.</div>
  }
  return (
    <div className="thread">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.direction === 'inbound' ? 'in' : 'out'}`}>
          <div>
            <div className="msg-b">
              {m.media?.map((x) => (
                <a key={x.id} href={`/media/${x.id}`} target="_blank" rel="noopener" className="msg-img" title="Ouvrir la photo">
                  {/* eslint-disable-next-line @next/next/no-img-element -- binaire privé servi par /media, pas d'optimisation Next */}
                  <img src={`/media/${x.id}`} alt="Photo envoyée sur WhatsApp" loading="lazy" />
                </a>
              ))}
              {m.mediaKind === 'video' && (
                <span className="msg-note">Vidéo reçue — non conservée, seules les photos sont acceptées</span>
              )}
              {m.mediaKind === 'image' && !m.media?.length && (
                <span className="msg-note">Photo non récupérée auprès de WhatsApp</span>
              )}
              {m.body}
            </div>
            <div className="msg-t">
              {m.sentAt.toLocaleString('fr-FR', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
