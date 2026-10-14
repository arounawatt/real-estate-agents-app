/**
 * « Mes paramètres » — nom, logo, coordonnées et liens de prise de rendez-vous.
 *
 * Le nom est facultatif : sans lui, Coumba et le message de reprise de
 * main parlent de « l'agence », et l'en-tête affiche « Codaya ». Les liens sont
 * envoyés tels quels par l'outil offer_visit — aucun agenda n'est intégré
 * (§10). Sans lien, Coumba annonce qu'un conseiller rappellera et escalade.
 */
import { getTenant, listAgencyUsers } from '@codaya/db'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/ActionButton'
import { ActionForm } from '@/components/ActionForm'
import { PhoneField } from '@/components/PhoneField'
import { SubmitButton } from '@/components/SubmitButton'
import { changePasswordAction } from '@/lib/auth-actions'
import { addAgencyUserAction, removeAgencyUserAction, updateTenantSettingsAction } from '@/lib/actions'
import { brandOf } from '@/lib/brand'
import { formatWaId } from '@/lib/phone'
import { getSession } from '@/lib/session'

const ERRORS: Record<string, string> = {
  invalid_url: 'Un lien de prise de rendez-vous doit être une adresse web complète (https://…).',
  invalid_email: 'Adresse email non reconnue. Vérifiez-la, par exemple contact@monagence.sn.',
  logo_type: 'Le logo doit être une image PNG, JPEG ou WebP.',
  logo_size: 'Le logo dépasse 500 Ko. Réduisez-le avant de le renvoyer.',
  admin_number_invalid: 'Numéro non reconnu. Choisissez le pays, puis saisissez le numéro, par exemple 77 123 45 67.',
  admin_number_taken: 'Ce numéro est déjà enregistré comme administrateur.',
  password_current: 'Mot de passe actuel incorrect.',
  password_short: 'Le nouveau mot de passe doit faire au moins 8 caractères.',
  password_mismatch: 'Les deux saisies du nouveau mot de passe ne correspondent pas.',
}

export default async function SettingsPage({
  searchParams,
}: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams
  const { tenantId, agencyUserId } = await getSession()
  const [tenant, admins] = await Promise.all([getTenant(tenantId), listAgencyUsers(tenantId)])
  if (!tenant) notFound()
  const brand = brandOf(tenant)

  return (
    <main className="page">
      <h1 className="page-title">Mes paramètres</h1>
      <p className="page-sub">Ce que voient vos équipes dans le tableau de bord, et ce que Coumba utilise sur WhatsApp.</p>

      {error && ERRORS[error] && <div className="banner alert">{ERRORS[error]}</div>}
      {saved && !error && <div className="banner info">{saved === 'admin' ? 'Numéro administrateur ajouté.' : saved === 'password' ? 'Mot de passe changé. Vos autres sessions ont été déconnectées.' : 'Modifications enregistrées.'}</div>}

      {/* key : remonte le formulaire après chaque enregistrement, sinon le
          fichier choisi reste sélectionné et repartirait au clic suivant. */}
      <ActionForm key={`${tenant.logoUpdatedAt?.getTime() ?? 'none'}-${saved ?? ''}`} action={updateTenantSettingsAction}>
        <section className="card">
          <div className="card-hd"><h3>Identité</h3></div>
          <div className="formgrid">
            <div className="fld span2">
              <span>Nom de l&apos;agence — cité par Coumba ; sans nom, elle dit « l&apos;agence »</span>
              <input type="text" name="name" defaultValue={tenant.name ?? ''} placeholder="Facultatif" />
            </div>
            <div className="fld span2">
              <span>Logo — PNG, JPEG ou WebP, 500 Ko maximum</span>
              <div className="logo-field">
                {brand.logoUrl
                  ? <img src={brand.logoUrl} alt="" className="brandmark brandmark-img" />
                  : <div className="brandmark">{brand.initial}</div>}
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
              </div>
            </div>
            {brand.logoUrl && (
              <label className="fld fld-check span2" style={{ paddingTop: 0 }}>
                <input type="checkbox" name="removeLogo" />
                <span>Retirer le logo (l&apos;initiale s&apos;affichera à la place)</span>
              </label>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-hd"><h3>Coordonnées de l&apos;agence</h3></div>
          <p className="hint" style={{ paddingTop: 16 }}>
            Coumba et Malick les donnent mot pour mot quand un client ou un locataire les demande. Un champ vide,
            ils disent qu&apos;ils ne l&apos;ont pas. Ils ne proposent jamais d&apos;eux-mêmes d&apos;appeler l&apos;agence.
          </p>
          <div className="formgrid" style={{ paddingTop: 0 }}>
            <div className="fld span2">
              <span>Adresse</span>
              <input type="text" name="address" defaultValue={tenant.address ?? ''} placeholder="Ex. 12 rue Carnot, Plateau, Dakar" />
            </div>
            <div className="fld">
              <span>Téléphone — plusieurs numéros : séparez-les par une virgule</span>
              <input type="text" name="phone" defaultValue={tenant.phone ?? ''} placeholder="+221 33 800 00 00" />
            </div>
            <div className="fld">
              <span>Email</span>
              <input type="email" name="contactEmail" defaultValue={tenant.contactEmail ?? ''} placeholder="contact@…" />
            </div>
            <div className="fld span2">
              <span>Horaires d&apos;ouverture</span>
              <input type="text" name="openingHours" defaultValue={tenant.openingHours ?? ''} placeholder="Ex. lundi-vendredi 9 h-18 h, samedi 9 h-13 h" />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-hd"><h3>Prise de rendez-vous</h3></div>
          <p className="hint" style={{ paddingTop: 16 }}>
            Le lien que vous utilisez déjà (Calendly ou autre). Coumba l&apos;envoie tel quel quand un client veut visiter ;
            on sait qu&apos;il a été envoyé, pas qu&apos;il a été utilisé. Sans lien, elle annonce qu&apos;un conseiller rappellera.
          </p>
          <div className="formgrid" style={{ paddingTop: 0 }}>
            <div className="fld span2">
              <span>Lien de prise de rendez-vous</span>
              <input type="url" name="bookingUrlRental" defaultValue={tenant.bookingUrlRental ?? ''} placeholder="https://calendly.com/…" />
            </div>
            <label className="fld fld-check span2" style={{ paddingTop: 0 }}>
              <input type="checkbox" name="splitBookingLinks" defaultChecked={tenant.splitBookingLinks} />
              <span>Utiliser un lien différent pour les ventes (le lien ci-dessus sert alors aux locations)</span>
            </label>
            <div className="fld span2">
              <span>Lien pour les ventes — utilisé seulement si la case ci-dessus est cochée</span>
              <input type="url" name="bookingUrlSale" defaultValue={tenant.bookingUrlSale ?? ''} placeholder="https://calendly.com/…" />
            </div>
          </div>
        </section>

        <div style={{ textAlign: 'right' }}>
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
        </div>
      </ActionForm>

      <section className="card" id="admins" style={{ marginTop: 24 }}>
        <div className="card-hd"><h3>Numéros administrateurs</h3></div>
        <p className="hint" style={{ paddingTop: 16 }}>
          Les numéros WhatsApp de la direction. Coumba ne répond pas à ces numéros : elle ne répond qu&apos;aux clients.
          Pour l&apos;instant, un message envoyé depuis l&apos;un d&apos;eux au numéro de l&apos;agence reste donc sans réponse.
        </p>
        {admins.map((admin) => (
          <div key={admin.id} className="adminrow">
            <div className="adminrow-id">
              <div className="adminrow-name">{admin.fullName ?? 'Sans nom'}{admin.id === agencyUserId ? ' (vous)' : ''}</div>
              <div className="adminrow-num">{admin.whatsappNumber ? formatWaId(admin.whatsappNumber) : '—'}</div>
              {!admin.canLogIn && <div className="micro">pas d&apos;accès au tableau de bord</div>}
            </div>
            {admin.id !== agencyUserId && (
              <ActionButton action={removeAgencyUserAction.bind(null, admin.id)} pendingLabel="Retrait…">Retirer</ActionButton>
            )}
          </div>
        ))}
        {admins.length === 0 && <div className="empty" style={{ paddingTop: 0 }}>Aucun numéro administrateur pour l&apos;instant.</div>}
        <ActionForm action={addAgencyUserAction} className="formgrid" style={{ borderTop: '1px solid var(--line-2)' }}>
          <div className="fld">
            <span>Prénom / nom</span>
            <input type="text" name="fullName" placeholder="Facultatif" />
          </div>
          <PhoneField name="whatsappNumber" label="Numéro WhatsApp" />
          <div className="span2" style={{ textAlign: 'right' }}>
            <SubmitButton className="btn btn-g" pendingLabel="Ajout…">Ajouter ce numéro</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="card" id="password" style={{ marginTop: 24 }}>
        <div className="card-hd"><h3>Mon mot de passe</h3></div>
        <ActionForm key={saved ?? ''} action={changePasswordAction} className="formgrid">
          <label className="fld span2">
            <span>Mot de passe actuel</span>
            <input type="password" name="currentPassword" autoComplete="current-password" required />
          </label>
          <label className="fld">
            <span>Nouveau mot de passe — 8 caractères minimum</span>
            <input type="password" name="newPassword" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="fld">
            <span>Confirmer le nouveau mot de passe</span>
            <input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} required />
          </label>
          <div className="span2" style={{ textAlign: 'right' }}>
            <SubmitButton className="btn btn-g" pendingLabel="Changement…">Changer le mot de passe</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </main>
  )
}
