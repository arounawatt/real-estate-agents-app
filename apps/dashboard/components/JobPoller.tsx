'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Tant que le job d'import est `pending`, redemande la page toutes les 2s — le worker écrit en tâche de fond. */
export function JobPoller() {
  const router = useRouter()

  useEffect(() => {
    const id = setTimeout(() => router.refresh(), 2000)
    return () => clearTimeout(id)
  }, [router])

  return null
}
