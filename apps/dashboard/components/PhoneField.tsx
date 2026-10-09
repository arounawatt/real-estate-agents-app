'use client'

import { useState } from 'react'
import { COUNTRIES, countryByIso, DEFAULT_COUNTRY_ISO, flagOf, PRIORITY_COUNTRIES } from '@/lib/countries'

/**
 * Indicatif (menu avec drapeaux) + numéro national. Envoie deux champs :
 * `${name}Country` (code ISO) et `${name}` (numéro tel que saisi) —
 * à recombiner côté serveur avec toWaId() (lib/phone.ts).
 *
 * Le menu natif est posé, transparent, sur une étiquette « 🇸🇳 +221 » : au
 * toucher on garde la liste native du téléphone (noms des pays lisibles),
 * mais fermé il n'affiche pas un libellé tronqué au milieu d'un nom.
 */
export function PhoneField({
  name, label, autoComplete, autoFocus,
}: {
  name: string
  label: string
  autoComplete?: string
  autoFocus?: boolean
}) {
  const [iso, setIso] = useState(DEFAULT_COUNTRY_ISO)
  const selected = countryByIso(iso)!
  const option = (c: { iso: string; name: string; dial: string }) => (
    <option key={c.iso} value={c.iso}>{`${flagOf(c.iso)} ${c.name} (+${c.dial})`}</option>
  )
  return (
    <div className="fld">
      <span>{label}</span>
      <div className="phonefld">
        <div className="phonecc">
          <span aria-hidden="true">{flagOf(selected.iso)} +{selected.dial}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          <select name={`${name}Country`} value={iso} onChange={(e) => setIso(e.target.value)} aria-label={`Indicatif du pays : ${selected.name}`}>
            <optgroup label="Fréquents">{PRIORITY_COUNTRIES.map(option)}</optgroup>
            <optgroup label="Tous les pays">{COUNTRIES.map(option)}</optgroup>
          </select>
        </div>
        <input type="tel" name={name} inputMode="tel" autoComplete={autoComplete} autoFocus={autoFocus} placeholder="77 123 45 67" required />
      </div>
    </div>
  )
}
