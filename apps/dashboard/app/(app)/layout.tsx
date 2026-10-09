import {
  countLeads, countProperties, countTickets, countVisitRequests, getTenant, listRecentActivity,
} from '@codaya/db'
import type { ReactNode } from 'react'
import { Nav } from '@/components/Nav'
import { RightPanel } from '@/components/RightPanel'
import { brandOf } from '@/lib/brand'
import { getSession } from '@/lib/session'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { tenantId } = await getSession()
  const [tenant, activity, leadsCount, ticketsCount, visitsCount, propertiesCount] = await Promise.all([
    getTenant(tenantId),
    listRecentActivity(tenantId),
    countLeads(tenantId),
    countTickets(tenantId),
    countVisitRequests(tenantId),
    countProperties(tenantId),
  ])

  const counts = {
    conversations: leadsCount + ticketsCount,
    leads: leadsCount,
    visits: visitsCount,
    tickets: ticketsCount,
    properties: propertiesCount,
  }

  return (
    <div className="shell">
      <Nav brand={brandOf(tenant)} hasPropertyManager={tenant?.plan === 'complete'} counts={counts} />
      <div className="content">
        <div className="main">
          <div className="center">{children}</div>
          <RightPanel activity={activity} />
        </div>
      </div>
    </div>
  )
}
