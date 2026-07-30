import { apiGet, type ApiGetOptions } from '../../../api/http'

export type PasteurizadorIndicador = {
  amostras: number
  ultima_coleta: {
    status: 'rascunho' | 'processada' | 'erro'
    coletado_em: string | null
    total_amostras: number
  } | null
}

export const pasteurizadorIndicadorApi = {
  buscar(options?: ApiGetOptions) {
    return apiGet<PasteurizadorIndicador>('/api/dashboard/pasteurizador', options)
  },
}
