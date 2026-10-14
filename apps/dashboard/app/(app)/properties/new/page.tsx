/**
 * Création d'un bien — saisie manuelle, ou brouillon pré-rempli par Amadou
 * depuis une URL de l'agence (packages/agent/src/listing-import.ts, même
 * travail que fetchListingTool sur WhatsApp). Le brouillon ne crée rien :
 * il ne fait que remplir les <input defaultValue> du formulaire, relu et
 * soumis explicitement par la personne avant tout enregistrement — règle
 * n°1 du projet, rien n'est affiché comme su tant que ça ne l'est pas.
 *
 * Le fetch tourne en tâche de fond dans apps/worker (potentiellement via
 * navigateur headless pour les sites qui bloquent un fetch simple) : cette
 * page ne fait que lire le job `?job=…` en base et se rafraîchir tant
 * qu'il est `pending` (<JobPoller>, poll toutes les 2s).
 */
import { getListingImportJob, getTenant } from '@codaya/db'
import { importableListingDomains, type ListingExtraction } from '@codaya/agent'
import Link from 'next/link'
import { ActionForm } from '@/components/ActionForm'
import { JobPoller } from '@/components/JobPoller'
import { SubmitButton } from '@/components/SubmitButton'
import { EMPTY_PROPERTY_DEFAULTS, PropertyForm, type PropertyDefaults } from '@/components/PropertyForm'
import { analyzeListingAction, createPropertyAction } from '@/lib/actions'
import { PROPERTY_FIELD_LABELS } from '@/lib/labels'
import { getSession } from '@/lib/session'
import { hostOf } from '@/lib/url'

const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed:
    "Cette page n'est ni sur le site de l'agence ni sur un portail d'annonces reconnu. Amadou ne lit que ces adresses-là.",
  fetch_failed: "Impossible de lire cette page (introuvable, protégée, ou vide).",
  no_extraction: "Aucune information exploitable n'a été trouvée sur cette page.",
}

function buildDraft(extraction: ListingExtraction, sourceUrl: string): { defaults: PropertyDefaults; fieldsToConfirm: string[] } {
  const defaults: PropertyDefaults = {
    ...EMPTY_PROPERTY_DEFAULTS,
    title: extraction.title ?? '',
    transaction: extraction.transaction ?? EMPTY_PROPERTY_DEFAULTS.transaction,
    type: extraction.type ?? EMPTY_PROPERTY_DEFAULTS.type,
    typology: extraction.typology ?? EMPTY_PROPERTY_DEFAULTS.typology,
    city: extraction.city,
    district: extraction.district,
    floor: extraction.floor,
    areaSqm: extraction.areaSqm,
    rooms: extraction.rooms,
    bedrooms: extraction.bedrooms,
    bathrooms: extraction.bathrooms,
    price: extraction.price,
    amenities: extraction.amenities,
    services: extraction.services,
    // Par défaut, la page lue est celle qu'on envoie — modifiable si l'agence préfère un autre lien.
    listingUrl: sourceUrl,
  }
  return { defaults, fieldsToConfirm: extraction.fieldsNotFound }
}

export default async function NewPropertyPage({
  searchParams,
}: { searchParams: Promise<{ job?: string; importError?: string; sourceUrl?: string }> }) {
  const { job: jobId, importError, sourceUrl } = await searchParams
  const { tenantId } = await getSession()
  const tenant = await getTenant(tenantId)
  // Domaines de l'agence + portails communs à toutes (SHARED_LISTING_DOMAINS).
  const listingDomains = importableListingDomains(tenant?.listingDomains ?? [])

  const job = jobId ? await getListingImportJob(tenantId, jobId) : null

  let defaults = EMPTY_PROPERTY_DEFAULTS
  let hidden: Record<string, string> | undefined
  let importedFrom: string | null = null
  let fieldsToConfirm: string[] = []
  let resolvedError: string | null = importError ?? null
  let retryUrl = sourceUrl ?? ''

  if (job?.status === 'done' && job.extraction) {
    const draft = buildDraft(job.extraction as ListingExtraction, job.url)
    defaults = draft.defaults
    fieldsToConfirm = draft.fieldsToConfirm
    importedFrom = job.url
    hidden = {
      importSource: 'url',
      importSourceUrl: job.url,
      importRawListing: job.rawText ?? '',
      importFieldsToConfirm: draft.fieldsToConfirm.join(','),
    }
  } else if (job?.status === 'failed') {
    resolvedError = job.failureReason
    retryUrl = job.url
  }

  return (
    <main className="page">
      <Link href="/properties" className="back-link">← Nos biens</Link>
      <h1 className="page-title">Ajouter un bien</h1>
      <p className="page-sub">Saisie manuelle ou import — le bien est créé dépublié, à publier une fois vérifié.</p>

      {listingDomains.length > 0 ? (
        <section className="card" style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="card-hd"><h3>Importer depuis une URL</h3></div>
          <ActionForm action={analyzeListingAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '16px 16px 0' }}>
            <input
              type="url"
              name="url"
              required
              defaultValue={retryUrl}
              placeholder={`https://${listingDomains[0]}/…`}
              style={{
                flex: '1 1 280px', height: 38, padding: '0 11px', border: '1px solid var(--line)',
                borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--ink)',
                fontFamily: 'var(--sans)', fontSize: 13.5,
              }}
            />
            <SubmitButton className="btn btn-g" pendingLabel="Analyse en cours…">
              Analyser l&apos;annonce
            </SubmitButton>
          </ActionForm>
          <p className="hint">
            Amadou lit les annonces publiées sur {listingDomains.join(', ')}. Sur un portail, collez uniquement vos propres annonces.
          </p>
          {job?.status === 'pending' && (
            <>
              <div className="import-loading">
                <span className="import-loading-av">A</span>
                <div className="import-loading-body">
                  <p className="import-loading-title">
                    Amadou lit l&apos;annonce<span className="dots"><span>.</span><span>.</span><span>.</span></span>
                  </p>
                  <p className="import-loading-sub">Certains sites mettent plusieurs secondes à répondre.</p>
                  <div className="import-loading-track"><div className="import-loading-bar" /></div>
                </div>
              </div>
              <JobPoller />
            </>
          )}
          {resolvedError && (
            <div className="banner alert" style={{ margin: '0 16px 16px' }}>
              {IMPORT_ERROR_MESSAGES[resolvedError] ?? "Échec de l'import."}
            </div>
          )}
        </section>
      ) : (
        <div className="banner warn" style={{ marginTop: 16, marginBottom: 16 }}>
          Aucun domaine d&apos;annonces configuré pour cette agence — l&apos;import depuis une URL est indisponible, seule la saisie manuelle l&apos;est.
        </div>
      )}

      {importedFrom && (
        <div className="banner warn" style={{ marginBottom: 16 }}>
          <b>Pré-rempli depuis {hostOf(importedFrom)}.</b>
          {' '}Relisez chaque champ avant de créer le bien.
          {fieldsToConfirm.length > 0 && (
            <>
              {' '}Non trouvé sur la page : {fieldsToConfirm.map((f) => PROPERTY_FIELD_LABELS[f] ?? f).join(', ')}.
            </>
          )}
        </div>
      )}

      <section className="card">
        <PropertyForm action={createPropertyAction} defaults={defaults} submitLabel="Créer le bien" hidden={hidden} />
      </section>
    </main>
  )
}
