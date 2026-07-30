import { apiGet, type ApiGetOptions } from '../../../api/http'

export type QualidadeIndicador = {
  produtores_ativos: number
  produtores_com_analise: number
  produtores_sem_analise: number
  ultima_analise: string | null
}

export const qualidadeIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<QualidadeIndicador>('/api/dashboard/qualidade', options)
  },
}
