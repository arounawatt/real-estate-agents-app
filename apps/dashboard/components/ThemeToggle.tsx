'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored)
        document.documentElement.setAttribute('data-theme', stored)
      }
    } catch {
      // localStorage indisponible (navigation privée, etc.) — le thème
      // suit alors simplement les préférences système.
    }
  }, [])

  function toggle() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const current = theme ?? (systemPrefersDark ? 'dark' : 'light')
    const next = current === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch { /* voir ci-dessus */ }
  }

  return (
    <button type="button" className="themebtn" aria-label="Changer de thème" onClick={toggle}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  )
}
