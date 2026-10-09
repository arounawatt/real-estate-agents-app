/**
 * `/visits` — ce que Coumba a envoyé, pas des rendez-vous confirmés.
 *
 * Table `visit_requests`, jamais `appointments` : on sait qu'un lien a été
 * envoyé ou qu'un rappel a été annoncé, pas ce que le prospect en a fait.
 * La réservation se passe sur l'outil externe de l'agence, qui ne nous en
 * informe pas. Aucune date de rendez-vous n'est donc affichée ici — elle
 * serait inventée. Voir docs/specifications-fonctionnelles.md §10.
 *
 * Chaque ligne renvoie vers le lead concerné, pas vers une page de détail
 * de la visite : il n'y a rien de plus à montrer qu'une ligne ne dit déjà.
 */
import { countVisitRequests, listVisitRequestsWithDetails } from '@codaya/db'
import Link from 'next/link'
import { AGENTS } from '@/lib/agents'
import { Pager } from '@/components/Pager'
import { INTENT_LABELS, VISIT_MODE_LABELS } from '@/lib/labels'
import { getSession } from '@/lib/session'

const PER_PAGE = 12
const agent = AGENTS.find((a) => a.href === '/leads')!

function timeAgo(date: Date) {
  const ms = Date.now() - date.getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export default async function VisitsPage({
  searchParams,
}: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const { tenantId } = await getSession()

  const [total, rows] = await Promise.all([
    countVisitRequests(tenantId),
    listVisitRequestsWithDetails(tenantId, { limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <main className="page">
      <p className="micro">{agent.name} · {agent.role}</p>
      <h1 className="page-title">Demandes de visite</h1>
      <div style={{ height: 20 }} />

      <div className="banner info">
        <b>On sait ce que Coumba a envoyé, pas ce que le prospect en a fait.</b>
        {' '}La réservation se passe sur votre outil de rendez-vous, qui ne nous en informe pas.
        Aucune date n&apos;est affichée ici — elle serait inventée.
      </div>

      <section className="card">
        <div className="card-hd"><h3>Toutes les demandes</h3><span className="micro">{total} demande{total > 1 ? 's' : ''}</span></div>
        {rows.length === 0 && <div className="empty">Aucune demande.</div>}
        {rows.map(({ visitRequest, contact, property }) => (
          <Link key={visitRequest.id} href={`/leads/${visitRequest.leadId}`} className="row-link">
            <div className="row-top">
              <span className="row-name">{property?.title ?? 'Bien non précisé'}</span>
              <span className="row-time">{timeAgo(visitRequest.createdAt)}</span>
            </div>
            <div className="chips" style={{ marginTop: 6, marginBottom: 6 }}>
              <span className={`badge ${visitRequest.mode === 'link_sent' ? 'ok' : 'nt'}`}>
                {VISIT_MODE_LABELS[visitRequest.mode] ?? visitRequest.mode}
              </span>
              <span className="badge nt">{INTENT_LABELS[visitRequest.intent] ?? visitRequest.intent}</span>
            </div>
            <div className="row-meta">
              {contact.fullName ?? contact.phone} — {visitRequest.mode === 'link_sent'
                ? 'a reçu le lien de prise de rendez-vous'
                : "un conseiller doit le rappeler pour convenir d'un créneau"}
            </div>
          </Link>
        ))}
        <Pager basePath="/visits" page={page} totalPages={totalPages} />
      </section>
    </main>
  )
}
