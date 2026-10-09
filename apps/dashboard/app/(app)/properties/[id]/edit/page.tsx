import { getProperty } from '@codaya/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PropertyForm } from '@/components/PropertyForm'
import { updatePropertyAction } from '@/lib/actions'
import { getSession } from '@/lib/session'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenantId } = await getSession()

  const property = await getProperty(tenantId, id)
  if (!property) notFound()

  return (
    <main className="page">
      <Link href={`/properties/${id}`} className="back-link">← {property.title}</Link>
      <h1 className="page-title">Modifier le bien</h1>
      <p className="page-sub">{property.reference}</p>

      <section className="card">
        <PropertyForm
          action={updatePropertyAction.bind(null, id)}
          defaults={property}
          submitLabel="Enregistrer"
        />
      </section>
    </main>
  )
}
