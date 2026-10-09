/**
 * Temps de réponse moyen, jour par jour — calculé depuis de vrais messages
 * (getResponseTimesByDay). Un jour sans donnée n'est pas relié : zéro
 * afficherait une réponse instantanée qui n'a pas eu lieu.
 *
 * L'échelle verticale part du minimum observé, pas de zéro : avec des
 * réponses qui varient de quelques dizaines de secondes, une échelle 0→max
 * aplatit toute la courbe en une ligne presque droite.
 */
function formatSeconds(s: number) {
  if (s < 60) return `${Math.round(s)} s`
  return `${Math.round(s / 60)} min`
}

export function ResponseTimeChart({ data }: { data: { day: string; avgSeconds: number | null }[] }) {
  const withValues = data.filter(
    (d): d is { day: string; avgSeconds: number } => d.avgSeconds != null,
  )
  if (withValues.length === 0) {
    return <div className="empty">Pas encore de messages traités sur cette période.</div>
  }

  const w = 560
  const h = 260
  const padX = 24
  const padTop = 30
  const padBottom = 26
  const plotH = h - padTop - padBottom

  const values = withValues.map((d) => d.avgSeconds)
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const spread = dataMax - dataMin
  // Marge de 25 % de chaque côté ; au moins 20 % de la valeur si la
  // courbe est plate (une seule valeur, ou des valeurs identiques).
  const margin = spread > 0 ? spread * 0.25 : Math.max(dataMax * 0.2, 5)
  const yMin = Math.max(0, dataMin - margin)
  const yMax = dataMax + margin

  const stepX = (w - padX * 2) / Math.max(1, data.length - 1)
  const yFor = (v: number) => padTop + (1 - (v - yMin) / (yMax - yMin)) * plotH

  const points = data.map((d, i) => ({
    x: padX + i * stepX,
    y: d.avgSeconds == null ? null : yFor(d.avgSeconds),
    d,
  }))
  const linePoints = points.filter(
    (p): p is { x: number; y: number; d: typeof p.d } => p.y != null,
  )
  const path = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const last = linePoints[linePoints.length - 1]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chartsvg" role="img" aria-label="Temps de réponse moyen par jour">
      {[yMin, (yMin + yMax) / 2, yMax].map((v) => {
        const y = yFor(v)
        return (
          <g key={v}>
            <line className="gridline" x1={padX} x2={w - padX} y1={y} y2={y} />
            <text x={padX} y={y - 4} className="axis-t">{formatSeconds(v)}</text>
          </g>
        )
      })}
      <path d={path} fill="none" style={{ stroke: 'var(--brand)' }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {linePoints.map((p) => (
        <circle
          key={p.d.day}
          cx={p.x}
          cy={p.y}
          r={4}
          style={{ fill: p === last ? 'var(--brand)' : 'var(--surface)', stroke: 'var(--brand)' }}
          strokeWidth={2.5}
        />
      ))}
      {last && (
        <text x={last.x} y={last.y - 12} className="axis-t" textAnchor="end" fontWeight={600} style={{ fill: 'var(--ink)' }}>
          {formatSeconds(last.d.avgSeconds!)}
        </text>
      )}
      {points.map((p) => (
        <text key={p.d.day} x={p.x} y={h - 6} className="axis-t" textAnchor="middle">
          {new Date(p.d.day).toLocaleDateString('fr-FR', { weekday: 'short' })}
        </text>
      ))}
    </svg>
  )
}
