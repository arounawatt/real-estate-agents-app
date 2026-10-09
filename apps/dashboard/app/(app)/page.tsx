/**
 * Accueil — agrégat des autres entités, donc construit en dernier (voir
 * conversation). Chaque chiffre vient d'un comptage réel ; le graphique de
 * temps de réponse vient de getResponseTimesByDay(), calculé depuis de
 * vrais messages, jamais estimé (CLAUDE.md, règle qui prime sur toutes les
 * autres).
 *
 * Pas de score de lead — voir packages/db/src/queries.ts, listHotLeads().
 * Pas de mesure « avant l'installation » (relevé manuel unique de la
 * maquette) : aucun champ ne la stocke encore par tenant.
 */
import {
  getActivityCounters, getResponseTimesByDay, getTenant, listUrgentTicketsWithContact,
} from '@codaya/db'
import { storedUrgency, urgencyBadge } from '@codaya/agent'
import Link from 'next/link'
import { ResponseTimeChart } from '@/components/ResponseTimeChart'
import { AGENTS } from '@/lib/agents'
import { TICKET_NATURE_LABELS } from '@/lib/labels'
import { getSession } from '@/lib/session'

const BAR_COLOR: Record<string, string> = { c1: 'var(--brand)', c2: 'var(--accent)', c4: 'var(--third)' }

function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })
}

export default async function HomePage() {
  const { tenantId } = await getSession()

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [tenant, counters, responseTimes, urgentTickets] = await Promise.all([
    getTenant(tenantId),
    getActivityCounters(tenantId, since),
    getResponseTimesByDay(tenantId, since),
    listUrgentTicketsWithContact(tenantId),
  ])

  const visibleAgents = AGENTS.filter(
    (a) => a.profile !== 'property_manager' || tenant?.plan === 'complete',
  )
  const maxConversations = Math.max(
    ...visibleAgents.map((a) => counters.conversationsByProfile[a.profile as keyof typeof counters.conversationsByProfile] ?? 0),
    1,
  )

  return (
    <main className="page">
      <div className="roster">
        {visibleAgents.map((agent) => (
          <Link key={agent.profile} href={agent.href} className="roster-item">
            <span className={`roster-av ${agent.color}`}>{agent.name[0]}</span>
            <span className="roster-n">{agent.name}</span>
            <span className="roster-r">{agent.role}</span>
          </Link>
        ))}
      </div>

      <div className="micro">Du {formatDate(since)} au {formatDate(new Date())}</div>
      <h1 className="page-title">Cette semaine</h1>
      <div style={{ height: 20 }} />

      <div className="kpis">
        <Kpi label="Messages échangés" value={counters.messages} caption="sur 7 jours" />
        <Kpi label="Nouveaux leads" value={counters.newLeads} caption="sur 7 jours" />
        <Kpi label="Visites demandées" value={counters.newVisitRequests} caption="sur 7 jours" />
        <Kpi
          label="Incidents résolues"
          value={counters.resolvedTicketsSince}
          caption={`${counters.openTickets} encore ouvert${counters.openTickets > 1 ? 's' : ''}`}
        />
      </div>

      <h2 className="section-title">Activité</h2>
      <div className="grid2">
        <section className="card">
          <div className="card-hd">
            <h3>Temps de réponse moyen</h3>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>7 derniers jours · en secondes</span>
          </div>
          <div className="chartwrap">
            <ResponseTimeChart data={responseTimes} />
          </div>
        </section>

        <section className="card">
          <div className="card-hd"><h3>Qui a fait quoi</h3></div>
          <div className="split">
            {visibleAgents.map((agent) => {
              const n = counters.conversationsByProfile[agent.profile as keyof typeof counters.conversationsByProfile] ?? 0
              return (
                <div key={agent.profile} className="bar-row">
                  <span className="bar-label">{agent.name}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(n / maxConversations) * 100}%`, background: BAR_COLOR[agent.color] }} />
                  </span>
                  <span className="bar-value">{n}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <h2 className="section-title">Ce qui demande votre attention</h2>
      <section className="card">
        {urgentTickets.length === 0 && (
          <div className="empty">Rien pour l&apos;instant.</div>
        )}
        {urgentTickets.map(({ ticket, contact }) => {
          const badge = urgencyBadge(storedUrgency(ticket))
          return (
            <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="row-link">
              <div className="row-name">#{ticket.reference} · {ticket.subjectAsDeclared}</div>
              <div className="row-meta">
                <span>{contact.fullName ?? contact.phone} · {TICKET_NATURE_LABELS[ticket.nature] ?? ticket.nature}</span>
                {badge && <span className="badge urg">{badge}</span>}
              </div>
            </Link>
          )
        })}
      </section>
    </main>
  )
}

function Kpi({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="kpi">
      <div className="kpi-k">{label}</div>
      <div className="kpi-v">{value}</div>
      <div className="kpi-n">{caption}</div>
    </div>
  )
}
