import { AGENTS } from '@/lib/agents'
import { ThemeToggle } from './ThemeToggle'

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function RightPanel({ activity }: {
  activity: { profile: string; contact: { fullName: string | null; phone: string } }[]
}) {
  const today = capitalize(new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }))

  return (
    <aside className="rightcol">
      <div className="greet">
        <div className="greet-top">
          <div style={{ flex: 1 }}>
            <h2>Bonjour</h2>
            <div className="greet-date">{today}</div>
          </div>
          <ThemeToggle />
        </div>

        {activity.length > 0 && (
          <div className="nowlist">
            <div className="micro" style={{ marginBottom: 12 }}>En ce moment</div>
            {activity.map((item, i) => {
              const agent = AGENTS.find((a) => a.profile === item.profile)
              return (
                <div key={i} className="nowitem">
                  <span className={`pulse ${agent?.color ?? ''}${i === 0 ? ' an' : ''}`} />
                  <span>
                    <b>{agent?.name ?? item.profile}</b> échange avec {item.contact.fullName ?? item.contact.phone}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
