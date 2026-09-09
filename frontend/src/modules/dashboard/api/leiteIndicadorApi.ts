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
  serie_diaria: Array<{
    data: string
    litros: number
    litros_periodo_anterior: number
    produtores: number
  }>
  rotas: Array<{
    id: string
    nome: string
    motorista: string
    litros: number
    produtores: number
    temperatura_media: number | null
  }>
  atualizado_em: string | null
}

export const leiteIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<LeiteIndicador>('/api/dashboard/leite', options)
  },
}
