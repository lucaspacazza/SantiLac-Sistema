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
  fora_padrao: Array<{
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
  }>
  importacoes: ImportacaoRelatorio[]
  evolucao_mensal: EvolucaoMensal[]
}

export type GrupoForaPadrao = RelatoriosResumo['fora_padrao'][number]

export type ExportacaoDownload = {
  arquivo: string
}

const API_BASE = '/api/qualidade/relatorios'

type ApiResponse<T> = {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

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

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const match = disposition.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? fallback
}

async function postDownload(
  path: string,
  body: Record<string, unknown>,
  options: { accept: string; fallback: string; errorMessage: string },
): Promise<ExportacaoDownload> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: options.accept,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.ok || contentType.includes('application/json')) {
    const json = contentType.includes('application/json') ? await response.json().catch(() => null) : null
    throw new Error(json?.error?.message ?? options.errorMessage)
  }

  const blob = await response.blob()
  const arquivo = filenameFromDisposition(response.headers.get('Content-Disposition'), options.fallback)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)

  return { arquivo }
}

export const relatoriosApi = {
  resumo: () => getJson<RelatoriosResumo>('/resumo'),
  exportarProdutoresAnalises: (mes: string) => postDownload('/exportacoes/produtores-analises', { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: 'qualidade_produtores_analises.xlsx',
    errorMessage: 'Falha ao gerar planilha',
  }),
  exportarProdutoresAnalisesPdf: (mes: string) => postDownload('/exportacoes/produtores-analises/pdf', { mes }, {
    accept: 'application/pdf, application/json',
    fallback: 'qualidade_produtores_analises.pdf',
    errorMessage: 'Falha ao gerar PDF',
  }),
  exportarProdutorAnalises: (codigo: string, mes: string) => postDownload(`/exportacoes/produtores/${encodeURIComponent(codigo)}/analises`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: `qualidade_produtor_${codigo}_analises.xlsx`,
    errorMessage: 'Falha ao gerar planilha individual do produtor',
  }),
  exportarProdutorAnalisesPdf: (codigo: string, mes: string) => postDownload(`/exportacoes/produtores/${encodeURIComponent(codigo)}/analises/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: `qualidade_produtor_${codigo}_analises.pdf`,
    errorMessage: 'Falha ao gerar PDF individual do produtor',
  }),
  exportarForaPadrao: (mes: string) => postDownload('/exportacoes/fora-padrao', { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: 'qualidade_fora_padrao.xlsx',
    errorMessage: 'Falha ao gerar planilha de fora do padrão',
  }),
  exportarForaPadraoPdf: (mes: string) => postDownload('/exportacoes/fora-padrao/pdf', { mes }, {
    accept: 'application/pdf, application/json',
    fallback: 'qualidade_fora_padrao.pdf',
    errorMessage: 'Falha ao gerar PDF de fora do padrão',
  }),
  exportarIndicadorForaPadrao: (codigo: string, mes: string) => postDownload(`/exportacoes/fora-padrao/${encodeURIComponent(codigo)}`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: `qualidade_fora_padrao_${codigo}.xlsx`,
    errorMessage: 'Falha ao gerar planilha do indicador',
  }),
  exportarIndicadorForaPadraoPdf: (codigo: string, mes: string) => postDownload(`/exportacoes/fora-padrao/${encodeURIComponent(codigo)}/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: `qualidade_fora_padrao_${codigo}.pdf`,
    errorMessage: 'Falha ao gerar PDF do indicador',
  }),
}
