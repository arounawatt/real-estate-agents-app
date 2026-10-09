/**
 * URL de détail RÉELLE — `/leads/:id`.
 *
 * La maquette est une page unique qui bascule des vues en JavaScript : il
 * n'y existe aucune adresse pour un lead donné. Ici il en faut une, et dès
 * le départ. Sans URL stable, aucun lien profond n'est possible — et c'est
 * la moitié de l'intérêt de l'assistante de direction.
 *
 * Ces pages exigent une session : un lien envoyé sur WhatsApp qui ouvrirait
 * la fiche d'un client sans authentification serait une fuite de données
 * personnelles dont l'agence serait responsable. getSession() est un stub
 * de développement pour l'instant — voir lib/session.ts.
 *
 * Pas de bouton « Relancer » : il enverrait un message WhatsApp libre sans
 * déclencheur humain, hors du cas « Reprendre la main » (qui, lui, prévient
 * bien le client — texte libre dans la fenêtre de 24 h, sinon le template
 * `handover`, voir lib/actions.ts).
 */
import { getLeadWithContact, getTenant, getThreadByContactAndProfile, getVisitRequestForLead } from '@codaya/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/ActionButton'
import { ActionForm } from '@/components/ActionForm'
import { SubmitButton } from '@/components/SubmitButton'
import { Thread } from '@/components/Thread'
import { Tooltip } from '@/components/Tooltip'
import { AGENTS } from '@/lib/agents'
import { handoverLeadAction, releaseHandoverAction, updateContactAction } from '@/lib/actions'
import {
  CONTACT_KIND_LABELS, INTENT_LABELS, PROPERTY_TYPE_LABELS, TIMELINE_LABELS, VISIT_MODE_LABELS,
} from '@/lib/labels'
import { isForeignNumber } from '@/lib/phone'
import { getSession } from '@/lib/session'
import { hostOf } from '@/lib/url'

const agent = AGENTS.find((a) => a.href === '/leads')!

function formatBudget(amount: number | null, currency: string | null) {
  if (amount == null) return null
  return `${amount.toLocaleString('fr-FR')} ${currency ?? 'XOF'}`
}

function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await getSession()

  const row = await getLeadWithContact(tenantId, id)
  if (!row) notFound()
  const { lead, contact } = row

  const [thread, visit, tenant] = await Promise.all([
    getThreadByContactAndProfile(tenantId, contact.id, 'sales'),
    getVisitRequestForLead(tenantId, lead.id),
    getTenant(tenantId),
  ])

  const budget = formatBudget(lead.budgetAmount, lead.budgetCurrency)

  return (
    <main className="page">
      <Link href="/leads" className="back-link">← Leads</Link>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <span className="mono c1" style={{ width: 52, height: 52, fontSize: 16 }}>
          {(contact.fullName ?? contact.phone).slice(0, 2).toUpperCase()}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{contact.fullName ?? contact.phone}</h1>
          <p className="page-sub" style={{ marginBottom: 4 }}>
            {contact.declaredCity ? `${contact.declaredCity} · ` : ''}
            premier contact le {formatDate(lead.createdAt)}
          </p>
          <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="telbtn">{contact.phone}</a>
        </div>
        {isForeignNumber(contact.phone) && (
          <span className="badge dia" style={{ height: 22 }}>
            Diaspora{contact.declaredCity ? ` · ${contact.declaredCity}` : ''}
          </span>
        )}
      </div>

      <div className="lead-grid">
        <section className="card" style={{ gridArea: 'thread' }}>
          <div className="card-hd">
            <h3>Échange WhatsApp</h3>
            <span className="micro">traité par {agent.name}</span>
          </div>
          {thread ? <Thread messages={thread.messages} /> : <div className="empty">Aucun message échangé pour l&apos;instant.</div>}
        </section>

        <section className="card acts" style={{ gridArea: 'contact' }}>
          <div className="card-hd"><h3>Contact</h3></div>
            <ActionForm action={updateContactAction.bind(null, contact.id, lead.id)} className="formgrid" style={{ padding: 16 }}>
              <div className="fld">
                <span>Prénom / nom</span>
                <input type="text" name="fullName" defaultValue={contact.fullName ?? ''} placeholder={contact.phone} />
              </div>
              <div className="fld">
                <Tooltip text="Le statut conditionne qui répond sur WhatsApp au prochain message : Coumba pour un prospect, Malick pour un locataire. Passer en Locataire termine la conversation avec Coumba.">
                  <span>Statut</span>
                </Tooltip>
                <select name="kind" defaultValue={contact.kind}>
                  {Object.entries(CONTACT_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="span2" style={{ textAlign: 'right' }}>
                <SubmitButton className="btn btn-g" pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section className="card" style={{ gridArea: 'retained' }}>
            <div className="card-hd"><h3>Ce que {agent.name} a retenu</h3></div>
            <div className="kv"><span className="kv-k">Téléphone</span><span className="kv-v">{contact.phone}</span></div>
            <div className="kv"><span className="kv-k">Intention</span><span className="kv-v">{INTENT_LABELS[lead.intent] ?? lead.intent}</span></div>
            <div className="kv"><span className="kv-k">Type de bien</span><span className="kv-v">{PROPERTY_TYPE_LABELS[lead.propertyType] ?? lead.propertyType}</span></div>
            <div className="kv"><span className="kv-k">Zone</span><span className="kv-v">{lead.zone ?? '—'}</span></div>
            <div className="kv"><span className="kv-k">Budget</span><span className="kv-v">{budget ?? '—'}</span></div>
            <div className="kv"><span className="kv-k">Échéance</span><span className="kv-v">{TIMELINE_LABELS[lead.timeline] ?? lead.timeline}</span></div>
            {lead.score != null && (
              <div className="kv"><span className="kv-k">Score</span><span className="kv-v">{lead.score}</span></div>
            )}
            {lead.notes && (
              <div className="kv"><span className="kv-k">Notes libres</span><span className="kv-v" style={{ fontStyle: 'italic', fontWeight: 400 }}>{lead.notes}</span></div>
            )}
          </section>

          {visit && (
            <section className="card" style={{ gridArea: 'visit' }}>
              <div className="card-hd">
                <h3>Demande de visite</h3>
                <span className={`badge ${visit.visitRequest.mode === 'link_sent' ? 'ok' : 'nt'}`}>
                  {VISIT_MODE_LABELS[visit.visitRequest.mode] ?? visit.visitRequest.mode}
                </span>
              </div>
              <div className="kv"><span className="kv-k">Bien</span><span className="kv-v">{visit.property?.title ?? 'Non précisé'}</span></div>
              <div className="kv"><span className="kv-k">Intention</span><span className="kv-v">{INTENT_LABELS[visit.visitRequest.intent] ?? visit.visitRequest.intent}</span></div>
              <div className="kv">
                <span className="kv-k">Ce que {agent.name} a fait</span>
                <span className="kv-v" style={{ maxWidth: '62%' }}>
                  {visit.visitRequest.mode === 'link_sent'
                    ? 'envoyé le lien de prise de rendez-vous'
                    : "annoncé qu'un conseiller rappellerait — aucun lien n'est configuré"}
                </span>
              </div>
              {visit.visitRequest.mode === 'link_sent' && visit.visitRequest.bookingUrlSent && (
                <div className="kv">
                  <span className="kv-k">Lien</span>
                  <span className="kv-v">
                    <a href={visit.visitRequest.bookingUrlSent} target="_blank" rel="noopener" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                      {hostOf(visit.visitRequest.bookingUrlSent)}
                    </a>
                  </span>
                </div>
              )}
            </section>
          )}

          {thread && (
            <section className="card acts" style={{ gridArea: 'handover' }}>
              <div className="actions">
                {thread.conversation.closedAt ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    Conversation terminée le {formatDate(thread.conversation.closedAt)} : le contact est passé en locataire.
                    {' '}
                    {tenant?.plan === 'complete'
                      ? 'Malick prend le relais sur WhatsApp.'
                      : `Votre offre n'inclut pas Malick : s'il réécrit, ${agent.name} lui répondra et la conversation reprendra.`}
                  </p>
                ) : thread.conversation.handedOverAt ? (
                  <>
                  <Tooltip text={`La main a été reprise le ${formatDate(thread.conversation.handedOverAt)}. Un message a été envoyé au client pour le prévenir — vérifiez malgré tout qu'un conseiller l'a bien contacté.`}>
                    <button type="button" className="btn btn-g" disabled>Main déjà reprise</button>
                  </Tooltip>
                  <Tooltip text={`${agent.name} recommencera à répondre automatiquement au prochain message du client. Aucun message n'est envoyé au client à ce moment-là.`}>
                    <ActionButton action={releaseHandoverAction.bind(null, lead.id)} pendingLabel="En cours…">
                      Rendre la main à {agent.name}
                    </ActionButton>
                  </Tooltip>
                  </>
                ) : (
                  <Tooltip text="À ne cliquer que si vous êtes prêt à appeler le client dans l'heure. Un message WhatsApp automatique le prévient que l'agence prend le relais — ce n'est pas à vous de le faire.">
                    <ActionButton action={handoverLeadAction.bind(null, lead.id)} pendingLabel="Reprise en cours…">
                      Reprendre la main
                    </ActionButton>
                  </Tooltip>
                )}
              </div>
            </section>
          )}
      </div>
    </main>
  )
}
