export type Overview = {
  produtores_ativos: number
  analises_validadas: number
  ultima_analise: string | null
  periodo_atual: string
  produtores_com_analise: number
  produtores_sem_analise: number
}

export type Analise = {
  id?: number
  produtor_codigo?: string
  produtor_nome?: string | null
  produtor_cidade?: string | null
  data: string
  gordura: number | null
  proteina: number | null
  lactose: number | null
  solidos_totais: number | null
  ccs: number | null
  ufc: number | null
  caseina: number | null
  sng: number | null
  ureia: number | null
  antibiotico: number | null
  bacteria: number | null
  temperatura: number | null
}

export type Produtor = {
  codigo: string
  nome: string
  cidade: string
  rota: string
  ativo: boolean
  novo: boolean
  ultima_analise: Analise | null
}

export type ProducersResponse = {
  items: Produtor[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export type AnalisesResponse = {
  items: Analise[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export type ReportsResumo = {
  totais: {
    ativos: number
    inativos: number
    novos: number
    analises: number
  }
  rotas: string[]
  ultima_analise?: string | null
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

const API_BASE = '/api/qualidade'

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

export const qualidadeApi = {
  produtores: () => getJson<ProducersResponse>('/produtores?per_page=100'),
  analises: () => getJson<AnalisesResponse>('/analises?per_page=100'),
  overview: () => getJson<Overview>('/overview'),
  relatoriosResumo: () => getJson<ReportsResumo>('/relatorios/resumo'),
}
