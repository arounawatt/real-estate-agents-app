'use client'

import type { ReactNode } from 'react'
import { useActionPending } from '@/components/ActionForm'

/** Bouton submit d'un <ActionForm> — désactivé pendant l'appel, voir ActionForm.tsx. */
export function SubmitButton({
  children, pendingLabel, className = 'btn btn-p',
}: {
  children: ReactNode
  pendingLabel?: ReactNode
  className?: string
}) {
  const pending = useActionPending()
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? 'Un instant…') : children}
    </button>
  )
}
