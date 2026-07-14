import { apiDownload, apiGet } from '../../../api/http'
import type { Analise } from './qualidadeApi'

export type PendenciaQualidade = { codigo: string; label: string; valor: number | null; referencia: string; unidade: string | null; gravidade: number }
export type ProdutorRelatorio = {
  codigo: string; nome: string; cidade: string; rota: string; cpf_cnpj?: string | null; ativo: boolean; novo: boolean
  data_cadastro?: string | null; data_inativacao?: string | null; ultima_analise: Analise | null
  status_qualidade: 'dentro_padrao' | 'fora_padrao' | 'sem_analise'; total_pendencias: number; pendencias: PendenciaQualidade[]
}
export type GrupoForaPadrao = {
  codigo: string; label: string; total: number; media: number | null
  pior: { codigo: string; nome: string; cidade: string; rota: string; data: string | null; valor: number | null; referencia: string; unidade: string | null; gravidade: number } | null
  items: Array<{ codigo: string; nome: string; cidade: string; rota: string; data: string | null; valor: number | null; referencia: string; unidade: string | null; gravidade: number }>
}

export type RelatoriosFiltros = {
  data_inicio: string
  data_fim: string
  rota?: string
  cidade?: string
}

export type ProdutorPrioridade = {
  codigo: string
  nome: string
  cidade: string
  rota: string
  data_analise: string | null
  status: 'critico' | 'fora_padrao' | 'sem_analise' | string
  total_desvios: number
  indicadores_fora_padrao: string[]
}

export type RelatoriosResumoV2 = {
  contexto: {
    periodo: { inicio: string; fim: string; label: string }
    gerado_em: string
  }
  filtros: { rota: string | null; cidade: string | null }
  executivo: {
    total_produtores: number
    produtores_analisados: number
    cobertura_percentual: number
    conformes: number
    conformidade_percentual: number
    total_analises: number
    media_analises_por_produtor: number
    criticos: number
  }
  tendencia: Array<{
    periodo: string
    total_analises: number
    produtores_analisados: number
    conformes: number
    conformidade_percentual: number
  }>
  indicadores: Array<{
    codigo: string
    label: string
    unidade: string | null
    total_avaliados: number
    fora_padrao: number
    prevalencia_percentual: number
  }>
  prioridades: {
    criticos: ProdutorPrioridade[]
    fora_padrao: ProdutorPrioridade[]
    sem_analise: ProdutorPrioridade[]
  }
  rotas: Array<{
    rota: string
    total_produtores: number
    produtores_analisados: number
    cobertura_percentual: number
    conformes: number
    conformidade_percentual: number
    criticos: number
  }>
  opcoes: { rotas: string[]; cidades: string[] }
}

const API_BASE = '/api/qualidade/relatorios'

function queryString(filters: RelatoriosFiltros): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  return params.toString()
}

export const relatoriosApi = {
  resumo: (filters: RelatoriosFiltros) => apiGet<RelatoriosResumoV2>(`${API_BASE}/v2/resumo?${queryString(filters)}`),
  exportarProdutoresAnalises: (mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores-analises`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json', fallback: 'qualidade_produtores_analises.xlsx', errorMessage: 'Falha ao gerar planilha',
  }),
  exportarProdutoresAnalisesPdf: (mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores-analises/pdf`, { mes }, {
    accept: 'application/pdf, application/json', fallback: 'qualidade_produtores_analises.pdf', errorMessage: 'Falha ao gerar PDF',
  }),
  exportarProdutorAnalises: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores/${encodeURIComponent(codigo)}/analises`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json', fallback: `qualidade_produtor_${codigo}_analises.xlsx`, errorMessage: 'Falha ao gerar planilha individual do produtor',
  }),
  exportarProdutorAnalisesPdf: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores/${encodeURIComponent(codigo)}/analises/pdf`, { mes }, {
    accept: 'application/pdf, application/json', fallback: `qualidade_produtor_${codigo}_analises.pdf`, errorMessage: 'Falha ao gerar PDF individual do produtor',
  }),
  exportarIndicadorForaPadrao: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/fora-padrao/${encodeURIComponent(codigo)}`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json', fallback: `qualidade_fora_padrao_${codigo}.xlsx`, errorMessage: 'Falha ao gerar planilha do indicador',
  }),
  exportarIndicadorForaPadraoPdf: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/fora-padrao/${encodeURIComponent(codigo)}/pdf`, { mes }, {
    accept: 'application/pdf, application/json', fallback: `qualidade_fora_padrao_${codigo}.pdf`, errorMessage: 'Falha ao gerar PDF do indicador',
  }),
}
