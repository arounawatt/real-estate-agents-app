/**
 * `/conversations` — leads et dossiers fusionnés, triés par date. Une
 * agence ne pense pas en tables séparées quand elle regarde « qu'est-ce
 * qui s'est passé récemment » ; cette vue existe pour ça, les vues
 * dédiées (`/leads`, `/tickets`) restent la référence pour le détail par
 * entité.
 */
import { listConversationsFeed } from '@codaya/db'
import { storedUrgency, urgencyBadge } from '@codaya/agent'
import Link from 'next/link'
import { AGENTS } from '@/lib/agents'
import { Pager } from '@/components/Pager'
import {
  INTENT_LABELS, PROPERTY_TYPE_LABELS, TICKET_NATURE_LABELS,
} from '@/lib/labels'
import { isForeignNumber } from '@/lib/phone'
import { getSession } from '@/lib/session'

const PER_PAGE = 12
const conversationAgents = AGENTS.filter((a) => a.profile === 'sales' || a.profile === 'property_manager')

function formatBudget(amount: number | null, currency: string | null) {
  if (amount == null) return null
  return `${amount.toLocaleString('fr-FR')} ${currency ?? 'XOF'}`
}

export default async function ConversationsPage({
  searchParams,
}: { searchParams: Promise<{ page?: string; type?: string; sort?: string }> }) {
  const { page: pageParam, type: typeParam, sort: sortParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const kind = (['lead', 'ticket'] as const).find((k) => k === typeParam)
  const sort = sortParam === 'old' ? 'old' : 'recent'
  const { tenantId } = await getSession()

  const { items, total } = await listConversationsFeed(tenantId, {
    kind, sort, limit: PER_PAGE, offset: (page - 1) * PER_PAGE,
  })
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const query = { ...(kind ? { type: kind } : {}), sort }

  return (
    <main className="page">
      <p className="micro">{conversationAgents.map((a) => a.name).join(' et ')}</p>
      <h1 className="page-title">Dernières conversations</h1>
      <div style={{ height: 20 }} />

      <section className="card">
        <div className="card-hd">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tbl">Type</span>
            <span className="seg">
              <Link href="/conversations" className={!kind ? 'on' : ''}>Toutes</Link>
              <Link href="/conversations?type=lead" className={kind === 'lead' ? 'on' : ''}>Leads</Link>
              <Link href="/conversations?type=ticket" className={kind === 'ticket' ? 'on' : ''}>Locataires</Link>
            </span>
            <span className="tbl" style={{ marginLeft: 8 }}>Date</span>
            <span className="seg">
              <Link href={`/conversations?${kind ? `type=${kind}&` : ''}sort=recent`} className={sort === 'recent' ? 'on' : ''}>Plus récentes</Link>
              <Link href={`/conversations?${kind ? `type=${kind}&` : ''}sort=old`} className={sort === 'old' ? 'on' : ''}>Plus anciennes</Link>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/leads" className="chip">Tous les leads</Link>
            <Link href="/tickets" className="chip">Tous les dossiers</Link>
          </div>
        </div>

        {items.length === 0 && <div className="empty">Aucune conversation.</div>}

        {items.map((item) => {
          if (item.kind === 'lead') {
            const { lead, contact } = item
            return (
              <Link key={`lead-${item.id}`} href={`/leads/${item.id}`} className="row-avatar-link">
                <span className="mono c1">{(contact.fullName ?? contact.phone).slice(0, 2).toUpperCase()}</span>
                <span className="row-avatar-body">
                  <div className="row-top">
                    <span className="row-name">
                      {contact.fullName ?? contact.phone}
                      {isForeignNumber(contact.phone) && <span className="badge dia" style={{ marginLeft: 8 }}>Diaspora</span>}
                    </span>
                    <span className="row-time">
                      {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className="row-meta">
                    {INTENT_LABELS[lead.intent] ?? lead.intent} · {PROPERTY_TYPE_LABELS[lead.propertyType] ?? lead.propertyType}
                    {lead.zone ? ` · ${lead.zone}` : ''}
                    {formatBudget(lead.budgetAmount, lead.budgetCurrency) ? ` · ${formatBudget(lead.budgetAmount, lead.budgetCurrency)}` : ''}
                  </div>
                </span>
              </Link>
            )
          }

          const { ticket, contact } = item
          const urgency = storedUrgency(ticket)
          const badge = urgencyBadge(urgency)
          const isAlarming = urgency.level === 'safety' || urgency.level === 'urgent'
          return (
            <Link key={`ticket-${item.id}`} href={`/tickets/${item.id}`} className="row-avatar-link">
              <span className="mono c2">{ticket.reference}</span>
              <span className="row-avatar-body">
                <div className="row-top">
                  <span className="row-name">{contact.fullName ?? contact.phone}</span>
                  <span className="row-time">
                    {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="row-meta">
                  Dossier #{ticket.reference} · {TICKET_NATURE_LABELS[ticket.nature] ?? ticket.nature}
                  {badge && <span className={`badge ${isAlarming ? 'urg' : 'nt'}`} style={{ marginLeft: 8 }}>{badge}</span>}
                </div>
              </span>
            </Link>
          )
        })}

        <Pager basePath="/conversations" page={page} totalPages={totalPages} query={query} />
      </section>
    </main>
  )
}
