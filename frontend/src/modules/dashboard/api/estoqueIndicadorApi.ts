import { apiGet, type ApiGetOptions } from '../../../api/http'

export type EstoqueIndicador = {
  itens_ativos: number
  abaixo_minimo: number
  movimentos_mes: number
}

export const estoqueIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<EstoqueIndicador>('/api/dashboard/estoque', options)
  },
}
