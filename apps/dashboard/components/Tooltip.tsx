import type { ReactNode } from 'react'

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="tw" tabIndex={0}>
      {children}
      <span className="tt" role="tooltip">{text}</span>
    </span>
  )
}
