'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AGENTS } from '@/lib/agents'
import { logoutAction } from '@/lib/auth-actions'
import type { Brand } from '@/lib/brand'

const DASHBOARD_LINK = { href: '/', label: 'Tableau de bord' }
const LINKS = [
  { href: '/conversations', label: 'Conversations', countKey: 'conversations' },
  { href: '/leads', label: 'Leads', countKey: 'leads' },
  { href: '/visits', label: 'Visites', countKey: 'visits' },
  { href: '/tickets', label: 'Incidents', countKey: 'tickets' },
  { href: '/properties', label: 'Nos biens', countKey: 'properties' },
] as const

const SETTINGS_LINK = { href: '/settings', label: 'Mes paramètres' }

function BrandMark({ brand }: { brand: Brand }) {
  return brand.logoUrl
    ? <img src={brand.logoUrl} alt="" className="brandmark brandmark-img" />
    : <div className="brandmark">{brand.initial}</div>
}

export function Nav({
  brand, hasPropertyManager, counts,
}: {
  brand: Brand
  hasPropertyManager: boolean
  counts: { conversations: number; leads: number; visits: number; tickets: number; properties: number }
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Le tiroir ne doit pas rester ouvert après un changement de page.
  useEffect(() => { setOpen(false) }, [pathname])

  const visibleAgents = AGENTS.filter((a) => a.profile !== 'property_manager' || hasPropertyManager)

  return (
    <>
      <div className="topbar">
        <button type="button" className="menubtn" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="brandblock" style={{ minWidth: 0 }}>
          <BrandMark brand={brand} />
          <div style={{ minWidth: 0 }}>
            <div className="brandname">{brand.title}</div>
            <div className="brandsub">{brand.subtitle}</div>
          </div>
        </div>
        <Link href={SETTINGS_LINK.href} className="menubtn gearbtn" aria-label={SETTINGS_LINK.label}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>

      <button
        type="button"
        aria-label="Fermer le menu"
        className={`scrim${open ? ' on' : ''}`}
        onClick={() => setOpen(false)}
        style={{ border: 'none', padding: 0 }}
      />

      <aside className={`side${open ? ' open' : ''}`}>
        <div className="brandblock">
          <BrandMark brand={brand} />
          <div style={{ minWidth: 0 }}>
            <div className="brandname">{brand.title}</div>
            <div className="brandsub">{brand.subtitle}</div>
          </div>
          <button type="button" className="closebtn" aria-label="Fermer le menu" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="navgroup">
          <Link
            href={DASHBOARD_LINK.href}
            className={`navlink${pathname === DASHBOARD_LINK.href ? ' on' : ''}`}
          >
            {DASHBOARD_LINK.label}
          </Link>
        </nav>

        <nav className="navgroup">
          <div className="navtitle">Activité</div>
          {LINKS.map((link) => {
            const isOn = pathname.startsWith(link.href)
            return (
              <Link key={link.href} href={link.href} className={`navlink${isOn ? ' on' : ''}`}>
                {link.label}
                <span className="count">{counts[link.countKey]}</span>
              </Link>
            )
          })}
        </nav>

        <nav className="navgroup">
          <div className="navtitle">Mes agents</div>
          {visibleAgents.map((agent) => {
            const isOn = pathname.startsWith(agent.href)
            return (
              <Link key={agent.profile} href={agent.href} className={`navlink${isOn ? ' on' : ''}`}>
                <span className={`nav-agent-av ${agent.color}`}>{agent.name[0]}</span>
                {agent.name}
              </Link>
            )
          })}
        </nav>

        <nav className="navgroup" style={{ marginTop: 'auto' }}>
          <Link
            href={SETTINGS_LINK.href}
            className={`navlink${pathname.startsWith(SETTINGS_LINK.href) ? ' on' : ''}`}
          >
            {SETTINGS_LINK.label}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="navlink navlink-btn">Se déconnecter</button>
          </form>
        </nav>
      </aside>
    </>
  )
}
