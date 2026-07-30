import { apiGet, type ApiGetOptions } from '../../../api/http'

export type LeiteIndicador = {
  litros_mes_atual: number
  litros_mes_anterior: number
  variacao_percentual: number | null
  serie_mensal: Array<{
    periodo: string
    litros: number
    coletas: number
  }>
}

export const leiteIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<LeiteIndicador>('/api/dashboard/leite', options)
  },
}
