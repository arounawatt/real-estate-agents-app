/**
 * URL de détail RÉELLE — `/tickets/:id`. Même raison qu'pour `/leads/:id` :
 * pas de routage en mémoire, une session obligatoire (stub de dev pour
 * l'instant, voir lib/session.ts).
 *
 * L'urgence n'est jamais rejugée ici : `urgency`/`urgencyReason` sont les
 * valeurs déjà calculées et stockées (packages/agent/src/urgency.ts). Le
 * badge ne s'affiche jamais sans sa justification.
 *
 */
import { getThreadByContactAndProfile, getTicketWithContact, listTicketMedia } from '@codaya/db'
import { storedUrgency, urgencyBadge } from '@codaya/agent'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/ActionButton'
import { ActionForm } from '@/components/ActionForm'
import { SubmitButton } from '@/components/SubmitButton'
import { Thread } from '@/components/Thread'
import { Tooltip } from '@/components/Tooltip'
import { AGENTS } from '@/lib/agents'
import { forceTicketUrgencyAction, toggleTicketStatusAction } from '@/lib/actions'
import {
  HABITABLE_LABELS, TICKET_NATURE_LABELS, TICKET_STATUS_LABELS, UTILITY_CUT_LABELS,
} from '@/lib/labels'
import { getSession } from '@/lib/session'

const agent = AGENTS.find((a) => a.href === '/tickets')!

function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await getSession()

  const row = await getTicketWithContact(tenantId, id)
  if (!row) notFound()
  const { ticket, contact } = row

  const [thread, photos] = await Promise.all([
    getThreadByContactAndProfile(tenantId, contact.id, 'property_manager'),
    listTicketMedia(tenantId, ticket.id),
  ])

  const urgency = storedUrgency(ticket)
  const badge = urgencyBadge(urgency)
  const displayedLevel = urgency.level
  const isAlarming = displayedLevel === 'safety' || displayedLevel === 'urgent'

  return (
    <main className="page">
      <Link href="/tickets" className="back-link">← Incidents</Link>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <span className="mono c2" style={{ width: 52, height: 52, fontSize: 14 }}>{ticket.reference}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{ticket.subjectAsDeclared}</h1>
          <p className="page-sub" style={{ marginBottom: 4 }}>
            {contact.fullName ?? contact.phone} · ouvert le {formatDate(ticket.createdAt)} par {agent.name}
          </p>
          <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="telbtn">{contact.phone}</a>
        </div>
        {badge && <span className={`badge ${isAlarming ? 'urg' : 'nt'}`}>{badge}</span>}
      </div>

      {ticket.safetyReason && (
        <div className="banner alert">
          <b>Chemin de sécurité déclenché — {ticket.safetyReason}</b>
          <br />
          Consigne de sécurité donnée, escalade immédiate vers un humain.
        </div>
      )}

      <div className="grid2">
        <div>
        <section className="card">
          <div className="card-hd">
            <h3>Échange avec le locataire</h3>
            <span className="micro">traité par {agent.name}</span>
          </div>
          {thread ? <Thread messages={thread.messages} /> : <div className="empty">Aucun message échangé pour l&apos;instant.</div>}
        </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="card-hd">
              <h3>Photos du locataire</h3>
              <span className="micro">{photos.length === 0 ? 'aucune' : `${photos.length} reçue${photos.length > 1 ? 's' : ''} sur WhatsApp`}</span>
            </div>
            {photos.length === 0 ? (
              <div className="empty">Aucune photo jointe à ce dossier.</div>
            ) : (
              <div className="photo-grid">
                {photos.map((p) => (
                  <a key={p.id} href={`/media/${p.id}`} target="_blank" rel="noopener" title={`Reçue le ${p.sentAt.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- binaire privé servi par /media */}
                    <img src={`/media/${p.id}`} alt="Photo envoyée par le locataire" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>

        <div>
          <section className="card">
            <div className="card-hd"><h3>Fiche d'incident</h3></div>
            <div className="kv"><span className="kv-k">Référence</span><span className="kv-v">#{ticket.reference}</span></div>
            <div className="kv"><span className="kv-k">Bien, tel que déclaré</span><span className="kv-v" style={{ maxWidth: '62%' }}>{ticket.subjectAsDeclared}</span></div>
            {ticket.description && (
              <div className="kv"><span className="kv-k">Problème, tel que décrit</span><span className="kv-v" style={{ maxWidth: '62%' }}>{ticket.description}</span></div>
            )}
            <div className="kv"><span className="kv-k">Nature</span><span className="kv-v">{TICKET_NATURE_LABELS[ticket.nature] ?? ticket.nature}</span></div>
            <div className="kv"><span className="kv-k">Statut</span><span className="kv-v">{TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}</span></div>
            <div className="kv"><span className="kv-k">Locataire</span><span className="kv-v">{contact.fullName ?? '—'}</span></div>
            <div className="kv"><span className="kv-k">Téléphone</span><span className="kv-v">{contact.phone}</span></div>
          </section>

          <section className="card acts" style={{ marginTop: 16 }}>
            <div className="card-hd">
              <h3>Faits établis par {agent.name}</h3>
              <span className="micro">questions fermées</span>
            </div>
            <div className="kv"><span className="kv-k">Logement habitable</span><span className="kv-v">{ticket.habitable ? (HABITABLE_LABELS[ticket.habitable] ?? ticket.habitable) : '—'}</span></div>
            <div className="kv"><span className="kv-k">Coupure</span><span className="kv-v">{ticket.utilityCut ? (UTILITY_CUT_LABELS[ticket.utilityCut] ?? ticket.utilityCut) : '—'}</span></div>
            <div className="kv"><span className="kv-k">Risque de sécurité</span><span className="kv-v">{ticket.safetyRisk == null ? '—' : (ticket.safetyRisk ? 'Oui' : 'Non')}</span></div>
            <div className="kv"><span className="kv-k">Situation qui s&apos;aggrave</span><span className="kv-v">{ticket.worsening == null ? '—' : (ticket.worsening ? 'Oui' : 'Non')}</span></div>
            <div className="kv" style={{ background: 'var(--surface-2)' }}>
              <span className="kv-k">Niveau</span>
              <span className="kv-v">
                {badge ?? 'Normal'}
                <br />
                <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 11.5 }}>
                  {ticket.urgencyForced ? 'forcé manuellement' : 'calculé depuis les faits ci-dessus'}
                </span>
              </span>
            </div>
            <ActionForm action={forceTicketUrgencyAction.bind(null, ticket.id)}>
              <div className="actions" style={{ borderTop: '1px solid var(--line-2)' }}>
                <Tooltip text="Sécurité : gaz, feu, inondation, installation dangereuse — escalade immédiate vers un humain. Urgent : logement inhabitable, coupure, ou situation qui s'aggrave. Normal : le reste. Faible : demande administrative. Automatique : recalculé depuis les faits établis ci-dessus, à chaque changement.">
                  <select
                    name="level"
                    defaultValue={ticket.urgencyForced ?? 'auto'}
                    style={{
                      height: 38, padding: '0 11px', border: '1px solid var(--line)', borderRadius: 'var(--r)',
                      background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 13.5,
                    }}
                  >
                    <option value="auto">Automatique (calculé)</option>
                    <option value="safety">Sécurité</option>
                    <option value="urgent">Urgent</option>
                    <option value="normal">Normal</option>
                    <option value="low">Faible</option>
                  </select>
                </Tooltip>
                <SubmitButton className="btn btn-g">Forcer le niveau</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="actions">
              <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="btn btn-p">Appeler le locataire</a>
              <ActionButton action={toggleTicketStatusAction.bind(null, ticket.id, ticket.status)}>
                {ticket.status === 'open' ? "Clore l'incident" : "Rouvrir l'incident"}
              </ActionButton>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
