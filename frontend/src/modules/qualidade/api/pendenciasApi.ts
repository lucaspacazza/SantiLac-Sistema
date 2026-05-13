import { apiGet } from '../../../api/http'
import type { Analise } from './qualidadeApi'
import type { PendenciaQualidade, ProdutorRelatorio } from './relatoriosApi'

export type PendenciasProdutorResponse = {
  periodo: {
    inicio: string
    fim: string
    label: string
  }
  produtor: Pick<ProdutorRelatorio, 'codigo' | 'nome' | 'cidade' | 'rota' | 'ativo' | 'novo'>
  ultima_analise: Analise | null
  status_qualidade: ProdutorRelatorio['status_qualidade']
  total_pendencias: number
  pendencias: PendenciaQualidade[]
}

const API_BASE = '/api/qualidade/relatorios'

export const pendenciasApi = {
  produtor: (codigo: string) => apiGet<PendenciasProdutorResponse>(`${API_BASE}/produtores/${encodeURIComponent(codigo)}/pendencias`),
}
