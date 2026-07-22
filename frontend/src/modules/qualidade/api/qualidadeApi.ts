import { apiGet, apiPostFile } from '../../../api/http'

export type Overview = {
  produtores_ativos: number
  analises_validadas: number
  ultima_analise: string | null
  periodo_atual: string
  produtores_com_analise: number
  produtores_sem_analise: number
  total_produtores: number
  novos_no_mes: number
  saidas_ultimos_dois_meses: number
  ranking: ProducerRankingItem[]
}

export type ProducerRankingItem = {
  codigo: string
  nome: string
  litros: number
  pontuacao_volume: number
  pontuacao_qualidade: number
  pontuacao_geral: number
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
  cpf_cnpj?: string | null
  celular?: string | null
  ativo: boolean
  novo: boolean
  data_cadastro?: string | null
  data_inativacao?: string | null
  ultima_analise: Analise | null
}

export type ProducerTrend = 'melhorou' | 'estavel' | 'piorou' | 'sem_comparacao'
export type MilkTrend = 'aumentou' | 'estavel' | 'diminuiu' | 'sem_comparacao'

export type MilkMonthlyPoint = {
  periodo: string
  litros: number
  coletas: number
  dias_coleta: number
  media_por_coleta: number | null
}

export type QualityMonthlyPoint = {
  periodo: string
  analises: number
  gordura: number | null
  proteina: number | null
  lactose: number | null
  solidos_totais: number | null
  ccs: number | null
  ufc: number | null
}

export type QualityIndicatorComparison = {
  codigo: string
  label: string
  unidade: string
  atual: number
  anterior: number
  variacao: number
  variacao_percentual: number | null
  situacao: Exclude<ProducerTrend, 'sem_comparacao'>
}

export type ProducerDashboard = {
  leite: {
    periodo_atual: string | null
    periodo_anterior: string | null
    periodo_parcial: boolean
    dia_comparacao: number | null
    atual_litros: number | null
    anterior_litros: number | null
    variacao_litros: number | null
    variacao_percentual: number | null
    tendencia: MilkTrend
    coletas_atual: number
    dias_coleta_atual: number
    media_por_coleta: number | null
    ultima_coleta: string | null
    serie_mensal: MilkMonthlyPoint[]
  }
  qualidade: {
    periodo_atual: string | null
    periodo_anterior: string | null
    situacao: ProducerTrend
    alerta_sanitario: boolean
    comparados: number
    melhoraram: number
    estaveis: number
    pioraram: number
    indicadores: Record<string, QualityIndicatorComparison>
    media_atual: QualityMonthlyPoint | null
    media_anterior: QualityMonthlyPoint | null
    serie_mensal: QualityMonthlyPoint[]
  }
}

export type ProducerDetailResponse = {
  produtor: Omit<Produtor, 'ultima_analise'>
  resumo: {
    total_analises: number
    ultima_analise: string | null
    media_gordura: number | null
    media_proteina: number | null
    media_ccs: number | null
    media_ufc: number | null
  }
  ultima_analise: Analise | null
  analises_recentes: Analise[]
  dashboard: ProducerDashboard
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
  produtor: (codigo: string) => apiGet<ProducerDetailResponse>(`${API_BASE}/produtores/${encodeURIComponent(codigo)}`),
  analises: () => apiGet<AnalisesResponse>(`${API_BASE}/analises?per_page=100`),
  importarAnalises: (file: File) => apiPostFile<ImportAnalisesResponse>(`${API_BASE}/analises/importacoes`, 'arquivo', file),
  overview: () => apiGet<Overview>(`${API_BASE}/overview`),
}
