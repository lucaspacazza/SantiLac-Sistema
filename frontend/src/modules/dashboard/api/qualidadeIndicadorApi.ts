import { apiGet, type ApiGetOptions } from '../../../api/http'

export type QualidadeIndicador = {
  produtores_ativos: number
  produtores_com_analise: number
  produtores_sem_analise: number
  ultima_analise: string | null
  quality: {
    fat: number | null
    protein: number | null
    solids: number | null
    ccs: number | null
    cbt: number | null
    conformity: number
    analyzed: number
    missing: number
    issues: Array<{
      producer: string
      route: string
      issue: string
      value: string
    }>
    updatedAt: string | null
  }
}

export const qualidadeIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<QualidadeIndicador>('/api/dashboard/qualidade', options)
  },
}
