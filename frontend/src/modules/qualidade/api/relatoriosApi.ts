import { apiDownload, apiGet } from '../../../api/http'
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

export const relatoriosApi = {
  resumo: () => apiGet<RelatoriosResumo>(`${API_BASE}/resumo`),
  exportarProdutoresAnalises: (mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores-analises`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: 'qualidade_produtores_analises.xlsx',
    errorMessage: 'Falha ao gerar planilha',
  }),
  exportarProdutoresAnalisesPdf: (mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores-analises/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: 'qualidade_produtores_analises.pdf',
    errorMessage: 'Falha ao gerar PDF',
  }),
  exportarProdutorAnalises: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores/${encodeURIComponent(codigo)}/analises`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: `qualidade_produtor_${codigo}_analises.xlsx`,
    errorMessage: 'Falha ao gerar planilha individual do produtor',
  }),
  exportarProdutorAnalisesPdf: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/produtores/${encodeURIComponent(codigo)}/analises/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: `qualidade_produtor_${codigo}_analises.pdf`,
    errorMessage: 'Falha ao gerar PDF individual do produtor',
  }),
  exportarForaPadrao: (mes: string) => apiDownload(`${API_BASE}/exportacoes/fora-padrao`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: 'qualidade_fora_padrao.xlsx',
    errorMessage: 'Falha ao gerar planilha de fora do padrão',
  }),
  exportarForaPadraoPdf: (mes: string) => apiDownload(`${API_BASE}/exportacoes/fora-padrao/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: 'qualidade_fora_padrao.pdf',
    errorMessage: 'Falha ao gerar PDF de fora do padrão',
  }),
  exportarIndicadorForaPadrao: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/fora-padrao/${encodeURIComponent(codigo)}`, { mes }, {
    accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    fallback: `qualidade_fora_padrao_${codigo}.xlsx`,
    errorMessage: 'Falha ao gerar planilha do indicador',
  }),
  exportarIndicadorForaPadraoPdf: (codigo: string, mes: string) => apiDownload(`${API_BASE}/exportacoes/fora-padrao/${encodeURIComponent(codigo)}/pdf`, { mes }, {
    accept: 'application/pdf, application/json',
    fallback: `qualidade_fora_padrao_${codigo}.pdf`,
    errorMessage: 'Falha ao gerar PDF do indicador',
  }),
}
