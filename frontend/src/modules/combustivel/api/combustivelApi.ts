import { apiGet, apiPost } from '../../../api/http'

export type CombustivelResumo = {
  capacidade_litros: number
  estoque_atual_litros: number
  porcentagem: number
  nivel_visual: number
  ultima_entrada: CombustivelMovimentacao | null
  ultima_saida: CombustivelMovimentacao | null
}

export type CombustivelMovimentacao = {
  id: number
  tipo: 'entrada' | 'saida'
  quantidade_litros: number
  motorista_nome: string | null
  caminhao_nome: string | null
  placa: string | null
  km: number | null
  observacao: string | null
  usuario_id: number | null
  usuario_responsavel: {
    id: number
    nome: string | null
  } | null
  data_hora: string
  created_at: string
  updated_at: string
}

export type CombustivelLog = {
  id: number
  acao: string
  descricao: string
  movimentacao_id: number | null
  usuario_responsavel: {
    id: number
    nome: string | null
  } | null
  created_at: string
}

export type CombustivelMotorista = {
  id: number
  nome: string
}

export type CombustivelCaminhao = {
  id: number
  identificacao: string
  placa: string
  nome: string
}

export type Paginated<T> = {
  items: T[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export type MovimentoRegistrado = {
  movimentacao: CombustivelMovimentacao
  resumo: CombustivelResumo
}

export const combustivelApi = {
  resumo: () => apiGet<CombustivelResumo>('/api/combustivel/resumo'),
  historico: (params: {
    tipo?: string
    dataInicial?: string
    dataFinal?: string
    motorista?: string
    page?: number
    perPage?: number
  } = {}) => {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 1))
    query.set('per_page', String(params.perPage ?? 50))
    if (params.tipo) query.set('tipo', params.tipo)
    if (params.dataInicial) query.set('data_inicial', params.dataInicial)
    if (params.dataFinal) query.set('data_final', params.dataFinal)
    if (params.motorista) query.set('motorista', params.motorista)

    return apiGet<Paginated<CombustivelMovimentacao>>(`/api/combustivel/historico?${query.toString()}`)
  },
  logs: () => apiGet<Paginated<CombustivelLog>>('/api/combustivel/logs?per_page=20'),
  motoristas: () => apiGet<Paginated<CombustivelMotorista>>('/api/combustivel/motoristas?per_page=200'),
  caminhoes: () => apiGet<Paginated<CombustivelCaminhao>>('/api/combustivel/caminhoes?per_page=200'),
  registrarEntrada: (payload: { quantidade_litros: number; observacao?: string }) =>
    apiPost<MovimentoRegistrado>('/api/combustivel/entrada', payload),
  registrarSaida: (payload: { quantidade_litros: number; motorista_nome: string; caminhao_id: number; km?: number; observacao?: string }) =>
    apiPost<MovimentoRegistrado>('/api/combustivel/saida', payload),
}
