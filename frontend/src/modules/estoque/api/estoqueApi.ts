import { apiGet, apiPatch, apiPost } from '../../../api/http'

export type EstoqueItem = {
  id: number
  codigo: string | null
  nome: string
  categoria: string
  descricao: string | null
  unidade: string
  estoque_minimo: number
  saldo_atual: number
  saldo_total: number
  abaixo_minimo: boolean
  ativo: boolean
}

export type Movimento = {
  id: number
  tipo: 'entrada' | 'saida' | 'ajuste'
  item_id: number
  item_nome: string
  unidade: string
  quantidade: number
  saldo_antes: number
  saldo_depois: number
  data_movimento: string
  documento: string | null
  motivo: string | null
  observacao: string | null
}

export type EstoqueItemDetalhe = EstoqueItem & {
  movimentos: Movimento[]
}

export type Overview = {
  totais: {
    itens: number
    itens_ativos: number
    movimentos_mes: number
    abaixo_minimo: number
  }
  alertas: {
    baixo_estoque: EstoqueItem[]
  }
}

export type Paginated<T> = {
  items: T[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export const estoqueApi = {
  overview: () => apiGet<Overview>('/api/estoque/overview'),
  categorias: () => apiGet<string[]>('/api/estoque/categorias'),
  itens: (q = '') => apiGet<Paginated<EstoqueItem>>(`/api/estoque/itens?per_page=100&q=${encodeURIComponent(q)}`),
  item: (id: number) => apiGet<EstoqueItemDetalhe>(`/api/estoque/itens/${id}`),
  movimentos: () => apiGet<Paginated<Movimento>>('/api/estoque/movimentos?per_page=50'),
  criarItem: (payload: {
    codigo?: string
    nome: string
    categoria: string
    descricao?: string
    unidade: string
    saldo_atual: number
    estoque_minimo: number
  }) => apiPost<EstoqueItem>('/api/estoque/itens', payload),
  atualizarItem: (id: number, payload: {
    codigo?: string
    nome: string
    categoria: string
    descricao?: string
    unidade: string
    estoque_minimo: number
    ativo: boolean
  }) => apiPatch<EstoqueItemDetalhe>(`/api/estoque/itens/${id}`, payload),
  registrarMovimento: (payload: {
    tipo: 'entrada' | 'saida' | 'ajuste'
    item_id: number
    quantidade: number
    data_movimento: string
    documento?: string
    motivo?: string
    observacao?: string
  }) => apiPost<Movimento>('/api/estoque/movimentos', payload),
}
