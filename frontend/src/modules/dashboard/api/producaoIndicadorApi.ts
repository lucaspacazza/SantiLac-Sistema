import { apiGet, type ApiGetOptions } from '../../../api/http'

export type ProducaoIndicador = {
  formulacoes_queijo: number
  ops_aguardando_formato: number
  rascunhos: number
  products: Array<{
    id: string
    name: string
    short: string
    color: string
  }>
  days: Array<{
    date: string
    cheeseMilk: number
    creamKg: number
    wheyLiters: number
  }>
  lotes: Array<{
    id: string
    productId: string
    date: string
    milk: number
    weight: number | null
    partialWeight: number
    state: 'closed' | 'packing' | 'waiting' | 'format'
    closedAt: string | null
    boxes: number
  }>
  rendimento_ponderado: number | null
  atualizado_em: string | null
}

export const producaoIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<ProducaoIndicador>('/api/dashboard/producao', options)
  },
}
