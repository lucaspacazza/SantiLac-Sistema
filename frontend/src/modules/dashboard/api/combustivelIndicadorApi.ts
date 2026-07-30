import { apiGet, type ApiGetOptions } from '../../../api/http'

export type CombustivelIndicador = {
  capacidade_litros: number
  estoque_atual_litros: number
  porcentagem: number
}

export const combustivelIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<CombustivelIndicador>('/api/dashboard/combustivel', options)
  },
}
