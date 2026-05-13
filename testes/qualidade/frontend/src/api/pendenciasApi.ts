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

type ApiResponse<T> = {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

const API_BASE = '/api/qualidade/relatorios'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const json = (await response.json()) as ApiResponse<T>
  if (!json.success) {
    throw new Error(json.error?.message ?? 'Resposta inválida')
  }

  return json.data
}

export const pendenciasApi = {
  produtor: (codigo: string) => getJson<PendenciasProdutorResponse>(`/produtores/${encodeURIComponent(codigo)}/pendencias`),
}
