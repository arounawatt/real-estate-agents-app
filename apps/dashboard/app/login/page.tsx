/**
 * Connexion — numéro de téléphone + mot de passe. Pas d'inscription en
 * libre-service : les comptes sont créés à l'onboarding
 * (`pnpm ops:onboard`, `pnpm ops:user` — packages/ops). Avant connexion on ne sait pas de
 * quelle agence il s'agit : marque du produit (lib/brand.ts).
 */
import { redirect } from 'next/navigation'
import { ActionForm } from '@/components/ActionForm'
import { PhoneField } from '@/components/PhoneField'
import { SubmitButton } from '@/components/SubmitButton'
import { loginAction } from '@/lib/auth-actions'
import { brandOf } from '@/lib/brand'
import { getOptionalSession } from '@/lib/session'

const ERRORS: Record<string, string> = {
  invalid: 'Numéro ou mot de passe incorrect.',
  locked: 'Trop de tentatives. Réessayez dans 15 minutes.',
  suspended: "L'accès de votre agence est suspendu. Contactez Codaya pour le rétablir.",
  expired: "L'abonnement de votre agence est arrivé à échéance. Contactez Codaya pour le renouveler.",
  phone_format: "Numéro non reconnu. Choisissez le pays, puis saisissez le numéro, par exemple 77 123 45 67.",
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getOptionalSession()) redirect('/')
  const { error } = await searchParams
  const brand = brandOf(null)

  return (
    <main className="login">
      <div className="brandblock" style={{ marginBottom: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo statique, déjà à la bonne taille */}
        <img className="brandmark" src="/keurbi-logo.png" alt="" width={40} height={40} style={{ width: 40, height: 40 }} />
        <div>
          <div className="brandname">{brand.title} by Codaya</div>
          <div className="brandsub">{brand.subtitle}</div>
        </div>
      </div>

      <section className="card">
        <div className="card-hd"><h3>Connexion</h3></div>
        {error && ERRORS[error] && <div className="banner alert" style={{ margin: '16px 16px 0' }}>{ERRORS[error]}</div>}
        <ActionForm action={loginAction} className="formgrid" style={{ gridTemplateColumns: '1fr' }}>
          <PhoneField name="phone" label="Numéro de téléphone" autoComplete="username" autoFocus />
          <label className="fld">
            <span>Mot de passe</span>
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
        </ActionForm>
      </section>
      <p className="hint" style={{ textAlign: 'center', padding: 0 }}>
        Mot de passe oublié ? Contactez Codaya, qui vous en attribuera un nouveau.
      </p>
    </main>
  )
}
