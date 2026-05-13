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

async function postFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData()
  formData.append('arquivo', file)

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  })

  const json = (await response.json()) as ApiResponse<T>
  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? 'Falha ao enviar arquivo')
  }

  return json.data
}

export const qualidadeApi = {
  produtores: () => getJson<ProducersResponse>('/produtores?per_page=100'),
  analises: () => getJson<AnalisesResponse>('/analises?per_page=100'),
  importarAnalises: (file: File) => postFile<ImportAnalisesResponse>('/analises/importacoes', file),
  overview: () => getJson<Overview>('/overview'),
}
