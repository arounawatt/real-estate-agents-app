import {
  countTickets, getActivityCounters, getTicketNatureBreakdown, listTicketsWithContact,
} from '@codaya/db'
import { storedUrgency, urgencyBadge } from '@codaya/agent'
import Link from 'next/link'
import { AgentHero } from '@/components/AgentHero'
import { AGENTS } from '@/lib/agents'
import { Pager } from '@/components/Pager'
import { TICKET_NATURE_LABELS } from '@/lib/labels'
import { getSession } from '@/lib/session'

const PER_PAGE = 12
const agent = AGENTS.find((a) => a.href === '/tickets')!

function TicketRow({ ticket, contact }: {
  ticket: { id: string; reference: string; subjectAsDeclared: string; nature: string; urgency: 'safety' | 'urgent' | 'normal' | 'low'; urgencyReason: string | null; urgencyForced: 'safety' | 'urgent' | 'normal' | 'low' | null; createdAt: Date }
  contact: { fullName: string | null; phone: string }
}) {
  const urgency = storedUrgency(ticket)
  const badge = urgencyBadge(urgency)
  const isAlarming = urgency.level === 'safety' || urgency.level === 'urgent'
  return (
    <Link href={`/tickets/${ticket.id}`} className="row-avatar-link">
      <span className="mono c2">{ticket.reference}</span>
      <span className="row-avatar-body">
        <div className="row-top">
          <span className="row-name">{ticket.subjectAsDeclared}</span>
          <span className="row-time">
            {new Date(ticket.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {badge && <span className={`badge ${isAlarming ? 'urg' : 'nt'}`}>{badge}</span>}
          <span className="chip">{TICKET_NATURE_LABELS[ticket.nature] ?? ticket.nature}</span>
          <span className="chip">Locataire : <b>{contact.fullName ?? contact.phone}</b></span>
          {contact.fullName && <span className="chip">{contact.phone}</span>}
        </div>
      </span>
    </Link>
  )
}

export default async function TicketsPage({
  searchParams,
}: { searchParams: Promise<{ page?: string; open?: string }> }) {
  const { page: pageParam, open: openParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const openPage = Math.max(1, Number(openParam) || 1)
  const { tenantId } = await getSession()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [openTotal, openRows, resolvedTotal, resolvedRows, counters, natureBreakdown] = await Promise.all([
    countTickets(tenantId, { status: 'open' }),
    listTicketsWithContact(tenantId, { status: 'open', limit: PER_PAGE, offset: (openPage - 1) * PER_PAGE }),
    countTickets(tenantId, { status: 'resolved' }),
    listTicketsWithContact(tenantId, { status: 'resolved', limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    getActivityCounters(tenantId, since7d),
    getTicketNatureBreakdown(tenantId, since30d),
  ])
  const resolvedTotalPages = Math.max(1, Math.ceil(resolvedTotal / PER_PAGE))
  const openTotalPages = Math.max(1, Math.ceil(openTotal / PER_PAGE))

  const stats = [
    { value: counters.conversationsByProfile.property_manager ?? 0, label: 'conversations cette semaine' },
    { value: counters.resolvedTicketsSince, label: 'incidents résolues cette semaine' },
    { value: counters.openTickets, label: 'ouverts' },
  ]

  return (
    <main className="page">
      <Link href="/" className="back-link">← Accueil</Link>
      <AgentHero agent={agent} stats={stats} />
      <h1 className="page-title">Incidents</h1>
      <div style={{ height: 20 }} />

      <section className="card">
        <div className="card-hd"><h3>Ouvertes</h3><span className="micro">{openTotal} incident{openTotal > 1 ? 's' : ''}</span></div>
        {openRows.length === 0 && <div className="empty">Aucun incident ouvert.</div>}
        {openRows.map(({ ticket, contact }) => <TicketRow key={ticket.id} ticket={ticket} contact={contact} />)}
        <Pager basePath="/tickets" page={openPage} totalPages={openTotalPages} param="open" query={page > 1 ? { page: String(page) } : {}} />
      </section>

      <div style={{ height: 24 }} />

      <section className="card">
        <div className="card-hd"><h3>Résolues</h3><span className="micro">{resolvedTotal} incident{resolvedTotal > 1 ? 's' : ''}</span></div>
        {resolvedRows.length === 0 && <div className="empty">Aucun incident résolu.</div>}
        {resolvedRows.map(({ ticket, contact }) => <TicketRow key={ticket.id} ticket={ticket} contact={contact} />)}
        <Pager basePath="/tickets" page={page} totalPages={resolvedTotalPages} query={openPage > 1 ? { open: String(openPage) } : {}} />
      </section>

      {natureBreakdown.length > 0 && (
        <>
          <div style={{ height: 24 }} />
          <section className="card">
            <div className="card-hd"><h3>Nature des demandes</h3><span className="micro">30 derniers jours</span></div>
            <div className="split">
              {natureBreakdown.map((n) => (
                <div key={n.nature} className="bar-row">
                  <span className="bar-label">{TICKET_NATURE_LABELS[n.nature] ?? n.nature}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${n.pct}%`, background: 'var(--accent)' }} />
                  </span>
                  <span className="bar-value">{n.pct}%</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
