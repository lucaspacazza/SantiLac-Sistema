import { apiDownload, apiGet, apiPatch, apiPost } from '../../../api/http'

export type PaleteEstoque = {
  id: number
  numero: number
  produto: string
  lote: string
  codigo_ordem: string
  data_fabricacao: string
  data_validade: string
  caixas: number
  peso_total: number
  status: string
  expedicao_status: 'estoque' | 'reservado' | 'expedido'
  etiqueta_token: string
  etiqueta_status: string
  ordem_expedicao: string | null
  ordem_status: string | null
}

export type OrdemPalete = {
  id: number
  numero: number
  produto: string
  lote: string
  caixas: number
  peso_total: number
  etiqueta_token: string
  status_carregamento: 'reservado' | 'carregado'
  escaneado_em: string
  operador_conferencia?: string
}

export type OrdemExpedicao = {
  id: number
  codigo: string
  cliente: string
  destino: string
  data_prevista: string | null
  placa: string | null
  motorista: string | null
  observacoes: string | null
  status: 'rascunho' | 'lancada' | 'carregando' | 'concluida' | 'cancelada'
  paletes_total: number
  caixas_total: number
  peso_total: number
  criada_em: string | null
  lancada_em: string | null
  iniciada_em: string | null
  concluida_em: string | null
  cancelada_em: string | null
  paletes?: OrdemPalete[]
  produtos?: Array<{ produto: string; paletes: number; carregados: number; peso_total: number }>
  operadores?: {
    criado_por?: string | null
    lancado_por?: string | null
    iniciado_por?: string | null
    concluido_por?: string | null
    cancelado_por?: string | null
  }
}

export type OrdemPayload = {
  cliente: string
  destino: string
  data_prevista: string
  placa: string
  motorista: string
  observacoes: string
  paletes: number[]
}

type Resumo = {
  totais: {
    paletes: number
    caixas: number
    peso_total: number
    reservados: number
    ordens_abertas: number
  }
  produtos: Array<{ produto: string; paletes: number; caixas: number; peso_total: number }>
  ordens_recentes: OrdemExpedicao[]
}

export const expedicaoApi = {
  resumo: () => apiGet<Resumo>('/api/expedicao/resumo'),
  estoque: (params: { busca?: string; produto?: string; disponivel?: boolean } = {}) =>
    apiGet<{ itens: PaleteEstoque[]; produtos: string[] }>(`/api/expedicao/estoque${queryString(params)}`),
  palete: (id: number) => apiGet<PaleteEstoque & {
    lotes: Array<{ lote: string; codigo_ordem: string; data_fabricacao: string; data_validade: string; caixas: number; peso_total: number }>
    caixas: Array<{ id: number; sequencia: number; codigo_barra: string; peso: number; lote: string; codigo_ordem: string; registrada_em: string }>
  }>(`/api/expedicao/estoque/paletes/${id}`),
  ordens: (params: { busca?: string; status?: string } = {}) =>
    apiGet<{ itens: OrdemExpedicao[] }>(`/api/expedicao/ordens${queryString(params)}`),
  ordem: (id: number) => apiGet<OrdemExpedicao>(`/api/expedicao/ordens/${id}`),
  criar: (payload: OrdemPayload) => apiPost<OrdemExpedicao>('/api/expedicao/ordens', serializarOrdem(payload)),
  atualizar: (id: number, payload: OrdemPayload) => apiPatch<OrdemExpedicao>(`/api/expedicao/ordens/${id}`, serializarOrdem(payload)),
  lancar: (id: number) => apiPost<OrdemExpedicao>(`/api/expedicao/ordens/${id}/lancar`, {}),
  cancelar: (id: number) => apiPost<OrdemExpedicao>(`/api/expedicao/ordens/${id}/cancelar`, {}),
  relatorio: (params: { inicio?: string; fim?: string; status?: string }) =>
    apiGet<{ itens: RelatorioItem[] }>(`/api/expedicao/relatorios${queryString(params)}`),
  exportar: (formato: 'xlsx' | 'pdf', params: { inicio?: string; fim?: string; status?: string }) =>
    apiDownload(`/api/expedicao/relatorios/exportar/${formato}`, params, {
      accept: formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fallback: `expedicao.${formato}`,
      errorMessage: 'Não foi possível exportar o relatório.',
    }),
}

export type RelatorioItem = {
  ordem: string
  cliente: string
  destino: string
  data_prevista: string
  placa: string
  motorista: string
  status: string
  criada_em: string
  concluida_em: string
  palete: number | null
  qr_code: string
  produto: string
  caixas: number
  peso_total: number
  conferencia: string
  operador_inicio: string
  operador_fim: string
  operador_conferencia: string
}

function serializarOrdem(payload: OrdemPayload): Record<string, unknown> {
  return { ...payload, paletes: JSON.stringify(payload.paletes) }
}

function queryString(params: Record<string, string | boolean | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const value = query.toString()
  return value ? `?${value}` : ''
}
