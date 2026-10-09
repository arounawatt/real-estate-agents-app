'use client'

import {
  createContext, useContext, useTransition,
  type CSSProperties, type FormEvent, type ReactNode,
} from 'react'

const PendingContext = createContext(false)

/** Lu par SubmitButton (et tout autre champ qui voudrait réagir au pending). */
export function useActionPending() {
  return useContext(PendingContext)
}

/**
 * Formulaire pour une Server Action qui lit des champs (FormData). `children`
 * doit être du JSX normal, JAMAIS une fonction : une Server Action passe ses
 * enfants à ce Client Component à travers la frontière RSC, qui ne sait
 * sérialiser que du JSX, pas une closure (« Functions are not valid as a
 * child of Client Components »). Le pending se lit via useActionPending()
 * dans un enfant client (voir SubmitButton).
 */
export function ActionForm({
  action, children, className, style,
}: {
  action: (formData: FormData) => Promise<void>
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => { action(formData) })
  }

  return (
    <form className={className} style={style} onSubmit={handleSubmit}>
      <PendingContext.Provider value={isPending}>
        {children}
      </PendingContext.Provider>
    </form>
  )
}
