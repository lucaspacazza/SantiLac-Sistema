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
  productStock: Array<{
    product: string
    available: number
    reserved: number
    agingDays: number
    expiringKg: number
  }>
  shipments: Array<{
    id: string
    client: string
    destination: string
    date: string
    kg: number
    status: 'Concluída' | 'Carregando' | 'Programada'
    progress: number
  }>
  dispatchedDays: Array<{
    date: string
    kg: number
  }>
}

export const expedicaoIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<ExpedicaoIndicador>('/api/dashboard/expedicao', options)
  },
}
