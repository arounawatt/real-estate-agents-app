'use client'

import { useTransition, type ReactNode } from 'react'

/**
 * Bouton pour une Server Action sans champ (bind déjà tous les arguments).
 * React 18 n'a pas encore useFormStatus (React 19) : sans ce composant,
 * rien ne désactive le bouton pendant l'appel réseau, et un double-clic
 * déclenche l'action deux fois — vu en vrai sur « Prendre la main », qui
 * a envoyé le message WhatsApp en double.
 */
export function ActionButton({
  action, children, pendingLabel, className = 'btn btn-g', disabled,
}: {
  action: () => Promise<void>
  children: ReactNode
  pendingLabel?: ReactNode
  className?: string
  disabled?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || isPending}
      onClick={() => startTransition(() => { action() })}
    >
      {isPending ? (pendingLabel ?? 'Un instant…') : children}
    </button>
  )
}
