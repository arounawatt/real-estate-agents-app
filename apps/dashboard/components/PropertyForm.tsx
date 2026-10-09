import { ActionForm } from '@/components/ActionForm'
import { SubmitButton } from '@/components/SubmitButton'
import {
  AVAILABILITY_LABELS, CHARGES_LABELS, FURNISHED_LABELS, PROPERTY_TYPE_LABELS,
  RENT_PERIOD_LABELS, TRANSACTION_LABELS, TYPOLOGY_LABELS,
} from '@/lib/labels'

export type PropertyDefaults = {
  title: string
  transaction: string
  type: string
  typology: string
  city: string | null
  district: string | null
  floor: string | null
  areaSqm: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  guestToilet: boolean | null
  price: number | null
  rentPeriod: string
  charges: string
  furnished: string
  availability: string
  availableFrom: string | null
  amenities: string[]
  services: string[]
  notes: string | null
  listingUrl: string | null
}

export const EMPTY_PROPERTY_DEFAULTS: PropertyDefaults = {
  title: '',
  transaction: 'sale',
  type: 'apartment',
  typology: 'none',
  city: null,
  district: null,
  floor: null,
  areaSqm: null,
  rooms: null,
  bedrooms: null,
  bathrooms: null,
  guestToilet: null,
  price: null,
  rentPeriod: 'none',
  charges: 'none',
  furnished: 'none',
  availability: 'available',
  availableFrom: null,
  amenities: [],
  services: [],
  notes: null,
  listingUrl: null,
}

function options(labels: Record<string, string>, exclude: string[] = []) {
  return Object.entries(labels).filter(([key]) => !exclude.includes(key))
}

export function PropertyForm({
  action, defaults = EMPTY_PROPERTY_DEFAULTS, submitLabel, hidden,
}: {
  action: (formData: FormData) => Promise<void>
  defaults?: PropertyDefaults
  submitLabel: string
  /** Champs cachés reportés d'une étape précédente — l'origine d'un import URL, voir /properties/new. */
  hidden?: Record<string, string>
}) {
  return (
    <ActionForm action={action}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="formgrid">
        <div className="fld span2">
          <span>Titre</span>
          <input type="text" name="title" required defaultValue={defaults.title} placeholder="Villa avec piscine à Saly" />
        </div>

        <div className="fld">
          <span>Transaction</span>
          <select name="transaction" defaultValue={defaults.transaction} required>
            {options(TRANSACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="fld">
          <span>Type de bien</span>
          <select name="type" defaultValue={defaults.type} required>
            {options(PROPERTY_TYPE_LABELS, ['to_qualify']).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="fld">
          <span>Typologie</span>
          <select name="typology" defaultValue={defaults.typology}>
            {options(TYPOLOGY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="fld">
          <span>Étage</span>
          <input type="text" name="floor" defaultValue={defaults.floor ?? ''} placeholder="1er, Plain-pied…" />
        </div>

        <div className="fld">
          <span>Ville</span>
          <input type="text" name="city" defaultValue={defaults.city ?? ''} placeholder="Dakar" />
        </div>
        <div className="fld">
          <span>Quartier</span>
          <input type="text" name="district" defaultValue={defaults.district ?? ''} placeholder="Ngor" />
        </div>

        <div className="fld">
          <span>Surface (m²)</span>
          <input type="number" name="areaSqm" defaultValue={defaults.areaSqm ?? ''} min={0} />
        </div>
        <div className="fld">
          <span>Pièces</span>
          <input type="number" name="rooms" defaultValue={defaults.rooms ?? ''} min={0} />
        </div>
        <div className="fld">
          <span>Chambres</span>
          <input type="number" name="bedrooms" defaultValue={defaults.bedrooms ?? ''} min={0} />
        </div>
        <div className="fld">
          <span>Salles d&apos;eau</span>
          <input type="number" name="bathrooms" defaultValue={defaults.bathrooms ?? ''} min={0} />
        </div>

        <div className="fld">
          <span>WC visiteurs</span>
          <select name="guestToilet" defaultValue={defaults.guestToilet == null ? '' : (defaults.guestToilet ? 'yes' : 'no')}>
            <option value="">À qualifier</option>
            <option value="yes">Oui</option>
            <option value="no">Non</option>
          </select>
        </div>
        <div className="fld">
          <span>Ameublement</span>
          <select name="furnished" defaultValue={defaults.furnished}>
            {options(FURNISHED_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="fld">
          <span>Prix (FCFA)</span>
          <input type="number" name="price" defaultValue={defaults.price ?? ''} min={0} placeholder="Laisser vide si à définir" />
        </div>
        <div className="fld">
          <span>Périodicité du loyer</span>
          <select name="rentPeriod" defaultValue={defaults.rentPeriod}>
            {options(RENT_PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="fld">
          <span>Charges</span>
          <select name="charges" defaultValue={defaults.charges}>
            {options(CHARGES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        <div className="fld">
          <span>Disponibilité</span>
          <select name="availability" defaultValue={defaults.availability}>
            {options(AVAILABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="fld">
          <span>Disponible à partir du</span>
          <input type="date" name="availableFrom" defaultValue={defaults.availableFrom ?? ''} />
        </div>

        <div className="fld span2">
          <span>Équipements (séparés par des virgules)</span>
          <input type="text" name="amenities" defaultValue={defaults.amenities.join(', ')} placeholder="Piscine, Climatisation, Jardin" />
        </div>
        <div className="fld span2">
          <span>Services inclus (séparés par des virgules)</span>
          <input type="text" name="services" defaultValue={defaults.services.join(', ')} placeholder="Gardiennage, Wifi inclus" />
        </div>

        <div className="fld span2">
          <span>Lien de l&apos;annonce</span>
          <input type="url" name="listingUrl" defaultValue={defaults.listingUrl ?? ''} placeholder="https://…" />
        </div>

        <div className="fld span2">
          <span>Notes libres</span>
          <textarea name="notes" defaultValue={defaults.notes ?? ''} placeholder="Ce qui ne rentre dans aucun champ contraint" />
        </div>
      </div>

      <div className="actions">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  )
}
