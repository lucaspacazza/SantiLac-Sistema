import { apiGet, type ApiGetOptions } from '../../../api/http'

export type EstoqueIndicador = {
  itens_ativos: number
  abaixo_minimo: number
  movimentos_mes: number
  inventory: Array<{
    name: string
    unit: string
    stock: number
    min: number
    max: number | null
  }>
}

export const estoqueIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<EstoqueIndicador>('/api/dashboard/estoque', options)
  },
}
