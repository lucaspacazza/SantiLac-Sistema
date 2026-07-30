import { apiGet, type ApiGetOptions } from '../../../api/http'

export type ProdutoresIndicador = {
  total: number
}

export const produtoresIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<ProdutoresIndicador>('/api/dashboard/produtores', options)
  },
}
