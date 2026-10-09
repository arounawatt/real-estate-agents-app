/**
 * URL de détail RÉELLE — `/properties/:id`. Troisième des trois URL de
 * détail exigées dès le premier commit (CLAUDE.md « Trois contraintes »).
 *
 * Les biens n'ont pas de contact rattaché : pas de jointure nécessaire ici,
 * contrairement à /leads/:id et /tickets/:id.
 *
 * `fieldsToConfirm` porte la même règle que partout ailleurs dans le
 * produit : ce qu'Amadou n'a pas trouvé dans l'annonce reste vide plutôt
 * que d'être deviné, et l'interface le signale au lieu de le lisser.
 */
import { getProperty, getTenant } from '@codaya/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/ActionButton'
import { togglePropertyStatusAction } from '@/lib/actions'
import {
  CHARGES_LABELS, FURNISHED_LABELS, LISTING_STATUS_LABELS,
  PROPERTY_FIELD_LABELS, PROPERTY_TYPE_LABELS, RENT_PERIOD_SUFFIX,
  TRANSACTION_LABELS, TYPOLOGY_LABELS,
} from '@/lib/labels'
import { getSession } from '@/lib/session'
import { hostOf, isOwnDomain } from '@/lib/url'

function formatPrice(price: number | null, rentPeriod: string | null): string {
  if (price == null) return 'Prix à définir'
  const suffix = rentPeriod ? (RENT_PERIOD_SUFFIX[rentPeriod] ?? '') : ''
  return `${price.toLocaleString('fr-FR')} FCFA${suffix}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatAvailability(availability: string, availableFrom: string | null) {
  if (availability === 'available') return 'Disponible'
  if (availableFrom) return `À partir du ${formatDate(availableFrom)}`
  return null
}

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await getSession()

  const [property, tenant] = await Promise.all([
    getProperty(tenantId, id),
    getTenant(tenantId),
  ])
  if (!property) notFound()

  const toConfirm = new Set(property.fieldsToConfirm)
  const hostedElsewhere = property.listingUrl && !isOwnDomain(property.listingUrl, tenant?.listingDomains ?? [])

  return (
    <main className="page">
      <Link href="/properties" className="back-link">← Nos biens</Link>
      <p className="page-sub" style={{ marginBottom: 4 }}>
        {property.reference} · {property.district ? `${property.district}, ` : ''}{property.city ?? '—'} · {TRANSACTION_LABELS[property.transaction] ?? property.transaction}
      </p>
      <h1 className="page-title">{property.title}</h1>
      <p className="price">
        {formatPrice(property.price, property.rentPeriod)}
        {property.charges !== 'none' && (
          <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 8, fontFamily: 'var(--sans)' }}>
            {CHARGES_LABELS[property.charges] ?? property.charges}
          </span>
        )}
        {toConfirm.has('price') && <span className="kv-v confirm" style={{ marginLeft: 8 }}>à confirmer</span>}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <span className={`badge ${property.status === 'published' ? 'ok' : 'nt'}`}>
          {LISTING_STATUS_LABELS[property.status] ?? property.status}
        </span>
        {toConfirm.size > 0 && <span className="badge urg">{toConfirm.size} à confirmer</span>}
      </div>

      {toConfirm.size > 0 && (
        <div className="banner warn">
          <b>Amadou n&apos;a pas pu tout extraire.</b>
          {' '}Les champs marqués « à confirmer » n&apos;apparaissaient pas dans l&apos;annonce d&apos;origine.
          Il ne les a pas inventés — complétez-les avant publication.
        </div>
      )}

      {!property.listingUrl && (
        <div className="banner alert">
          <b>Aucun lien d&apos;annonce.</b>
          {' '}Coumba peut décrire ce bien, mais elle n&apos;a rien à envoyer.
        </div>
      )}

      {hostedElsewhere && (
        <div className="banner warn">
          <b>Cette fiche est hébergée sur {hostOf(property.listingUrl!)}.</b>
          {' '}Coumba peut l&apos;envoyer sans difficulté — techniquement, rien ne l&apos;en empêche. Mais {hostOf(property.listingUrl!)} affiche les biens des autres agences à côté du vôtre : vous payez la relance, le prospect peut repartir en face.
        </div>
      )}

      <h2 className="section-title">Caractéristiques</h2>
      <section className="card">
        <div className="kv"><span className="kv-k">Type de bien</span><span className="kv-v">{PROPERTY_TYPE_LABELS[property.type] ?? property.type}</span></div>
        {(property.typology !== 'none' || toConfirm.has('typology')) && (
          <Row
            label="Typologie"
            value={property.typology !== 'none' ? (TYPOLOGY_LABELS[property.typology] ?? property.typology) : null}
            toConfirm={toConfirm.has('typology')}
            fieldLabel={PROPERTY_FIELD_LABELS.typology}
          />
        )}
        <Row
          label="Surface"
          value={property.areaSqm != null ? `${property.areaSqm} m²` : null}
          toConfirm={toConfirm.has('areaSqm')}
          fieldLabel={PROPERTY_FIELD_LABELS.areaSqm}
        />
        <div className="kv"><span className="kv-k">Pièces</span><span className="kv-v">{property.rooms ?? '—'}</span></div>
        <div className="kv"><span className="kv-k">Chambres</span><span className="kv-v">{property.bedrooms ?? '—'}</span></div>
        <div className="kv"><span className="kv-k">Salles d&apos;eau</span><span className="kv-v">{property.bathrooms ?? '—'}</span></div>
        {property.type !== 'land' && (
          <div className="kv"><span className="kv-k">WC visiteurs</span><span className="kv-v">{property.guestToilet == null ? '—' : (property.guestToilet ? 'Oui' : 'Non')}</span></div>
        )}
        {property.floor && <div className="kv"><span className="kv-k">Étage</span><span className="kv-v">{property.floor}</span></div>}
        <Row
          label="Ameublement"
          value={property.furnished !== 'none' ? (FURNISHED_LABELS[property.furnished] ?? property.furnished) : null}
          toConfirm={toConfirm.has('furnished')}
          fieldLabel={PROPERTY_FIELD_LABELS.furnished}
        />
        <div className="kv"><span className="kv-k">Disponibilité</span><span className="kv-v">{formatAvailability(property.availability, property.availableFrom) ?? '—'}</span></div>
      </section>

      {(property.amenities.length > 0 || property.services.length > 0) && (
        <>
          <div style={{ height: 24 }} />
          <h2 className="section-title">Équipements et services</h2>
          <section className="card" style={{ padding: 16 }}>
            {property.amenities.length > 0 && <ChipRow label="Équipements" items={property.amenities} />}
            {property.services.length > 0 && <ChipRow label="Services inclus" items={property.services} />}
          </section>
        </>
      )}

      {property.notes && (
        <>
          <div style={{ height: 24 }} />
          <h2 className="section-title">Notes libres</h2>
          <section className="card" style={{ padding: 16, fontSize: 13, color: 'var(--ink-2)', fontWeight: 300 }}>
            {property.notes}
          </section>
        </>
      )}

      {property.rawListing && (
        <>
          <div style={{ height: 24 }} />
          <h2 className="section-title">Annonce d&apos;origine</h2>
          <section className="card" style={{ padding: 16, fontSize: 13, color: 'var(--ink-2)', fontWeight: 300, fontStyle: 'italic' }}>
            {property.rawListing}
          </section>
        </>
      )}

      <div style={{ height: 24 }} />
      <h2 className="section-title">Fiche</h2>
      <section className="card">
        <div className="kv"><span className="kv-k">Référence</span><span className="kv-v">{property.reference}</span></div>
        <div className="kv"><span className="kv-k">Ajouté</span><span className="kv-v">{property.source === 'url' ? 'par Amadou depuis une URL' : 'via le formulaire'}</span></div>
        <div className="kv">
          <span className="kv-k">Lien envoyé par Coumba</span>
          <span className="kv-v">
            {property.listingUrl
              ? <a href={property.listingUrl} target="_blank" rel="noopener" style={{ color: 'var(--brand)', fontWeight: 600 }}>{hostOf(property.listingUrl)}</a>
              : <span style={{ color: 'var(--neg)' }}>aucun</span>}
          </span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="actions">
          <Link href={`/properties/${property.id}/edit`} className="btn btn-p">Modifier</Link>
          <ActionButton action={togglePropertyStatusAction.bind(null, property.id, property.status)}>
            {property.status === 'published' ? 'Dépublier' : 'Publier'}
          </ActionButton>
        </div>
      </section>
    </main>
  )
}

function Row({
  label, value, toConfirm, fieldLabel,
}: { label: string; value: string | null; toConfirm?: boolean; fieldLabel?: string }) {
  return (
    <div className="kv">
      <span className="kv-k">{label}</span>
      <span className="kv-v">
        {value ?? '—'}
        {toConfirm && (
          <span className="kv-v confirm">
            {' '}· à confirmer{!value && fieldLabel ? ` (${fieldLabel})` : ''}
          </span>
        )}
      </span>
    </div>
  )
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="micro" style={{ marginBottom: 8 }}>{label}</div>
      <div className="chips">
        {items.map((item) => <span key={item} className="chip">{item}</span>)}
      </div>
    </div>
  )
}
