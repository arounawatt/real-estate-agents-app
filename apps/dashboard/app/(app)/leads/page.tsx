import { countLeads, getActivityCounters, getTenant, listLeadsWithContact } from '@codaya/db'
import Link from 'next/link'
import { AgentHero } from '@/components/AgentHero'
import { Pager } from '@/components/Pager'
import { AGENTS } from '@/lib/agents'
import { INTENT_LABELS, PROPERTY_TYPE_LABELS, TIMELINE_LABELS } from '@/lib/labels'
import { foreignNumberLabel } from '@/lib/phone'
import { getSession } from '@/lib/session'
import { hostOf } from '@/lib/url'

const PER_PAGE = 12
const agent = AGENTS.find((a) => a.href === '/leads')!

function formatBudget(amount: number | null, currency: string | null) {
  if (amount == null) return null
  return `${amount.toLocaleString('fr-FR')} ${currency ?? 'XOF'}`
}

export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<{ page?: string; sort?: string }> }) {
  const { page: pageParam, sort: sortParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const sort = sortParam === 'old' ? 'old' : 'recent'
  const { tenantId } = await getSession()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [total, rows, tenant, counters] = await Promise.all([
    countLeads(tenantId),
    listLeadsWithContact(tenantId, { sort, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    getTenant(tenantId),
    getActivityCounters(tenantId, since),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const stats = [
    { value: counters.conversationsByProfile.sales ?? 0, label: 'conversations cette semaine' },
    { value: counters.newLeads, label: 'nouveaux leads cette semaine' },
    { value: counters.newVisitRequests, label: 'visites proposées' },
  ]

  return (
    <main className="page">
      <Link href="/" className="back-link">← Accueil</Link>
      <AgentHero agent={agent} stats={stats} />

      {tenant && (
        <section className="card" style={{ marginBottom: 20 }}>
          <div className="card-hd">
            <h3>Prise de rendez-vous</h3>
            <span className="micro">Réglage de l&apos;agence</span>
          </div>
          <div style={{ padding: '16px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Quand un prospect veut visiter, Coumba lui envoie ce lien. <b style={{ color: 'var(--ink)' }}>Sans lien, elle annonce qu&apos;un conseiller le rappellera</b> pour convenir d&apos;un créneau, et elle vous remonte la demande.
          </div>
          <div className="kv">
            <span className="kv-k">Lien du calendrier</span>
            <span className="kv-v">
              {tenant.bookingUrlRental
                ? <a href={tenant.bookingUrlRental} target="_blank" rel="noopener" style={{ color: 'var(--brand)', fontWeight: 600 }}>{hostOf(tenant.bookingUrlRental)}</a>
                : <span style={{ color: 'var(--neg)' }}>aucun — Coumba annonce un rappel</span>}
            </span>
          </div>
          <div className="kv">
            <span className="kv-k">Lien différent pour l&apos;achat</span>
            <span className="kv-v">
              {tenant.splitBookingLinks
                ? (tenant.bookingUrlSale ? <a href={tenant.bookingUrlSale} target="_blank" rel="noopener" style={{ color: 'var(--brand)', fontWeight: 600 }}>{hostOf(tenant.bookingUrlSale)}</a> : 'Activé, mais aucun lien renseigné')
                : 'Non — même calendrier pour tout'}
            </span>
          </div>
        </section>
      )}

      <h1 className="page-title">Leads</h1>
      <div style={{ height: 20 }} />

      <section className="card">
        <div className="card-hd">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="tbl">Trier</span>
            <span className="seg">
              <Link href="/leads?sort=recent" className={sort === 'recent' ? 'on' : ''}>Plus récents</Link>
              <Link href="/leads?sort=old" className={sort === 'old' ? 'on' : ''}>Plus anciens</Link>
            </span>
          </div>
          <span className="micro">{total} lead{total > 1 ? 's' : ''}</span>
        </div>

        {rows.length === 0 && <div className="empty">Aucun lead.</div>}
        {rows.map(({ lead, contact }) => (
          <Link key={lead.id} href={`/leads/${lead.id}`} className="row-link">
            <div className="row-top">
              <span className="row-name">
                {contact.fullName ?? contact.phone}
                {contact.residence === 'abroad' && <span className="badge dia" style={{ marginLeft: 8 }}>Diaspora</span>}
                      {foreignNumberLabel(contact.phone) && <span className="badge nt" style={{ marginLeft: 8 }}>{foreignNumberLabel(contact.phone)}</span>}
              </span>
              <span className="row-time">
                {new Date(lead.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
              </span>
            </div>
            <div className="row-meta">
              {INTENT_LABELS[lead.intent] ?? lead.intent} · {PROPERTY_TYPE_LABELS[lead.propertyType] ?? lead.propertyType}
              {lead.zone ? ` · ${lead.zone}` : ''}
              {formatBudget(lead.budgetAmount, lead.budgetCurrency) ? ` · ${formatBudget(lead.budgetAmount, lead.budgetCurrency)}` : ''}
              {` · ${TIMELINE_LABELS[lead.timeline] ?? lead.timeline}`}
            </div>
          </Link>
        ))}
        <Pager basePath="/leads" page={page} totalPages={totalPages} query={{ sort }} />
      </section>
    </main>
  )
}
