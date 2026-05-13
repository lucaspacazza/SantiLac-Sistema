import type { Analise } from './qualidadeApi'

export type PendenciaQualidade = {
  codigo: string
  label: string
  valor: number | null
  referencia: string
  unidade: string | null
  gravidade: number
}

export type ProdutorRelatorio = {
  codigo: string
  nome: string
  cidade: string
  rota: string
  cpf_cnpj?: string | null
  ativo: boolean
  novo: boolean
  data_cadastro?: string | null
  data_inativacao?: string | null
  ultima_analise: Analise | null
  status_qualidade: 'dentro_padrao' | 'fora_padrao' | 'sem_analise'
  total_pendencias: number
  pendencias: PendenciaQualidade[]
}

export type GrupoForaPadrao = {
  codigo: string
  label: string
  total: number
  media: number | null
  pior: {
    codigo: string
    nome: string
    cidade: string
    rota: string
    data: string | null
    valor: number | null
    referencia: string
    unidade: string | null
    gravidade: number
  } | null
  items: Array<{
    codigo: string
    nome: string
    cidade: string
    rota: string
    data: string | null
    valor: number | null
    referencia: string
    unidade: string | null
    gravidade: number
  }>
}

export type ImportacaoRelatorio = {
  id: number
  arquivo_nome_original: string
  arquivo_hash: string
  status: string
  ja_importado: boolean
  total_linhas: number
  linhas_validas: number
  linhas_com_erro: number
  registros_criados: number
  registros_completados: number
  registros_sem_mudanca: number
  erro_codigo: string | null
  erro_mensagem: string | null
  produtores_nao_encontrados: string[]
  processed_at: string | null
  created_at: string | null
}

export type EvolucaoMensal = {
  mes: string
  total_analises: number
  produtores: number
  media_gordura: number | null
  media_proteina: number | null
  media_lactose: number | null
  media_ccs: number | null
  media_ufc: number | null
}

export type RelatoriosResumo = {
  periodo: {
    inicio: string
    fim: string
    label: string
  }
  totais: {
    produtores: number
    ativos: number
    inativos: number
    novos: number
    analises: number
    produtores_com_analise: number
    produtores_sem_analise: number
    dentro_padrao: number
    fora_padrao: number
    percentual_dentro: number
    percentual_fora: number
  }
  opcoes: {
    rotas: string[]
    cidades: string[]
  }
  ultima_analise: string | null
  ultima_importacao: ImportacaoRelatorio | null
  produtores: ProdutorRelatorio[]
  sem_analise: ProdutorRelatorio[]
  ranking_atencao: ProdutorRelatorio[]
  fora_padrao: GrupoForaPadrao[]
  importacoes: ImportacaoRelatorio[]
  evolucao_mensal: EvolucaoMensal[]
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

export const relatoriosApi = {
  resumo: () => getJson<RelatoriosResumo>('/resumo'),
}
