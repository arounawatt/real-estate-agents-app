import {
  countProperties, getCatalogueSummary, getTenant, listProperties,
} from '@codaya/db'
import Link from 'next/link'
import { AgentHero } from '@/components/AgentHero'
import { AGENTS } from '@/lib/agents'
import { Pager } from '@/components/Pager'
import { LISTING_STATUS_LABELS, RENT_PERIOD_SUFFIX, TRANSACTION_LABELS } from '@/lib/labels'
import { getSession } from '@/lib/session'
import { hostOf, isOwnDomain } from '@/lib/url'

const PER_PAGE = 12
const agent = AGENTS.find((a) => a.href === '/properties')!

const FILTERS = [
  { key: undefined, label: 'Tous' },
  { key: 'sale', label: 'Vente' },
  { key: 'rental', label: 'Location' },
  { key: 'todo', label: 'À confirmer' },
] as const

function formatPrice(price: number | null, rentPeriod: string | null): string {
  if (price == null) return 'Prix à définir'
  const suffix = rentPeriod ? (RENT_PERIOD_SUFFIX[rentPeriod] ?? '') : ''
  return `${price.toLocaleString('fr-FR')} FCFA${suffix}`
}

export default async function PropertiesPage({
  searchParams,
}: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const { page: pageParam, filter: filterParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const category = (['sale', 'rental', 'todo'] as const).find((c) => c === filterParam)
  const { tenantId } = await getSession()

  const [tenant, total, rows, summary] = await Promise.all([
    getTenant(tenantId),
    countProperties(tenantId, { category }),
    listProperties(tenantId, { category, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    getCatalogueSummary(tenantId),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const listingDomains = tenant?.listingDomains ?? []

  const stats = [
    { value: summary.total, label: 'biens au catalogue' },
    { value: summary.importedFromUrl, label: 'importés depuis une URL' },
    { value: summary.fieldsToConfirmCount, label: 'champs à confirmer' },
  ]

  return (
    <main className="page">
      <Link href="/" className="back-link">← Accueil</Link>
      <AgentHero agent={agent} stats={stats} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <h1 className="page-title">Nos biens</h1>
        <Link href="/properties/new" className="btn btn-p">+ Ajouter un bien</Link>
      </div>
      <div style={{ height: 20 }} />

      <section className="card">
        <div className="card-hd">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="tbl">Filtrer</span>
            <span className="seg">
              {FILTERS.map((f) => (
                <Link
                  key={f.label}
                  href={f.key ? `/properties?filter=${f.key}` : '/properties'}
                  className={category === f.key ? 'on' : ''}
                >
                  {f.label}
                </Link>
              ))}
            </span>
          </div>
          <span className="micro">{total} bien{total > 1 ? 's' : ''}</span>
        </div>

        {rows.length === 0 && <div className="empty">Aucun bien.</div>}
        {rows.map((property) => (
          <Link key={property.id} href={`/properties/${property.id}`} className="row-avatar-link">
            <span className="mono c4">{property.type.slice(0, 2).toUpperCase()}</span>
            <span className="row-avatar-body">
              <div className="row-top">
                <span className="row-name">{property.title}</span>
                <span style={{ fontFamily: 'var(--display)', fontSize: 15 }}>{formatPrice(property.price, property.rentPeriod)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {property.district ? `${property.district}, ` : ''}{property.city ?? '—'} · {TRANSACTION_LABELS[property.transaction] ?? property.transaction}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>
                <span className={`badge ${property.status === 'published' ? 'ok' : 'nt'}`}>
                  {LISTING_STATUS_LABELS[property.status] ?? property.status}
                </span>
                {property.fieldsToConfirm.length > 0 && (
                  <span className="badge urg">{property.fieldsToConfirm.length} à confirmer</span>
                )}
                <span className="chip">{property.reference}</span>
                {property.listingUrl && !isOwnDomain(property.listingUrl, listingDomains) && (
                  <span className="chip warn">Sur {hostOf(property.listingUrl)}</span>
                )}
                {property.amenities.length > 0 && <span className="chip">{property.amenities.length} équipements</span>}
                {property.services.length > 0 && <span className="chip">{property.services.length} services</span>}
              </div>
            </span>
          </Link>
        ))}
        <Pager basePath="/properties" page={page} totalPages={totalPages} query={category ? { filter: category } : {}} />
      </section>
    </main>
  )
}
