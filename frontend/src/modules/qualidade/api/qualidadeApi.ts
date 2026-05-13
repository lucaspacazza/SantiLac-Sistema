import { apiGet, apiPostFile } from '../../../api/http'

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

export type ImportWarning = {
  code: string
  message: string
  details?: {
    produtor_codigos?: string[]
    [key: string]: unknown
  }
}

export type ImportError = {
  sheet?: string
  line?: number
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ImportAnalisesResponse = {
  summary: {
    arquivo: string | null
    arquivo_hash: string | null
    ja_importado: boolean
    total_linhas: number
    linhas_validas_processor: number
    linhas_com_erro: number
    produtores_nao_encontrados: number
    registros_criados: number
    registros_completados: number
    registros_sem_mudanca: number
  }
  warnings: ImportWarning[]
  errors: ImportError[]
}

const API_BASE = '/api/qualidade'

export const qualidadeApi = {
  produtores: () => apiGet<ProducersResponse>(`${API_BASE}/produtores?per_page=100`),
  analises: () => apiGet<AnalisesResponse>(`${API_BASE}/analises?per_page=100`),
  importarAnalises: (file: File) => apiPostFile<ImportAnalisesResponse>(`${API_BASE}/analises/importacoes`, 'arquivo', file),
  overview: () => apiGet<Overview>(`${API_BASE}/overview`),
}
