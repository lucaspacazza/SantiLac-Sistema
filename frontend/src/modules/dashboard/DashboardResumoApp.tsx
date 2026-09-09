import { useDashboardOverview } from './hooks/useDashboardOverview'
import { OwnerDashboard } from './owner/OwnerDashboard'

export function DashboardResumoApp() {
  const dashboard = useDashboardOverview()
  return <OwnerDashboard dashboard={dashboard} />
}
