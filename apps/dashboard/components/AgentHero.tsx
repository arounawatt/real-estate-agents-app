import type { AGENTS } from '@/lib/agents'

export function AgentHero({ agent, stats }: {
  agent: typeof AGENTS[number]
  stats?: { value: number; label: string }[]
}) {
  return (
    <div className="agenthero">
      <span className={`agenthero-av ${agent.color}`}>{agent.name[0]}</span>
      <div>
        <div className="agenthero-name">{agent.name}</div>
        <div className="agenthero-role">{agent.role}</div>
        <p className="agenthero-desc">{agent.description}</p>
        {stats && stats.length > 0 && (
          <div className="ah-stats">
            {stats.map((s) => (
              <span key={s.label}><b>{s.value}</b> {s.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
