import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'Codaya — tableau de bord',
}

/** Le document seul. La coquille (menu, panneau de droite) vit dans
 *  app/(app)/layout.tsx : elle exige une session, la page /login non. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
