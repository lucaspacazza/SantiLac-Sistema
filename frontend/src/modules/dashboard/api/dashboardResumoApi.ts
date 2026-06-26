import { apiGet } from '../../../api/http'
import type { DashboardResumoSnapshot } from './dashboardResumoTypes'

export function carregarDashboardResumo(data = ''): Promise<DashboardResumoSnapshot> {
  const query = data ? `?data=${encodeURIComponent(data)}` : ''
  return apiGet<DashboardResumoSnapshot>(`/api/dashboard-resumo/snapshot${query}`)
}
