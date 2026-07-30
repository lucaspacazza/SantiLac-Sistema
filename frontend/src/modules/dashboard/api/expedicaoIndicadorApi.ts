import { apiGet, type ApiGetOptions } from '../../../api/http'

export type ExpedicaoIndicador = {
  totais: {
    paletes: number
    caixas: number
    peso_total: number
    reservados: number
    ordens_abertas: number
  }
  produtos: Array<{
    produto: string
    paletes: number
    caixas: number
    peso_total: number
  }>
}

export const expedicaoIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<ExpedicaoIndicador>('/api/dashboard/expedicao', options)
  },
}
