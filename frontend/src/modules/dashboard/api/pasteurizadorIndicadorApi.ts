import { apiGet, type ApiGetOptions } from '../../../api/http'
import { type DashboardDateRange, withDashboardDateRange } from './dashboardDateRangeApi'

export type PasteurizadorIndicador = {
  amostras: number
  ultima_coleta: {
    status: 'rascunho' | 'processada' | 'erro'
    coletado_em: string | null
    total_amostras: number
  } | null
  temperatures: Array<{
    hour: string
    timestamp: string
    value: number
  }>
  temperatureMetrics: {
    min: number
    avg: number
    max: number
    updatedAt: string
  } | null
}

export const pasteurizadorIndicadorApi = {
  buscar(range: DashboardDateRange, options?: ApiGetOptions) {
    return apiGet<PasteurizadorIndicador>(withDashboardDateRange('/api/dashboard/pasteurizador', range), options)
  },
}
