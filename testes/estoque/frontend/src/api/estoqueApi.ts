export type EstoqueItem = {
  id: number
  codigo: string | null
  nome: string
  categoria: string
  descricao: string | null
  foto_path: string | null
  foto_url: string | null
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? 'Não foi possível concluir a operação.')
  }

  return payload.data as T
}

export const estoqueApi = {
  overview: () => request<Overview>('/api/estoque/overview'),
  categorias: () => request<string[]>('/api/estoque/categorias'),
  itens: (q = '') => request<Paginated<EstoqueItem>>(`/api/estoque/itens?per_page=100&q=${encodeURIComponent(q)}`),
  item: (id: number) => request<EstoqueItemDetalhe>(`/api/estoque/itens/${id}`),
  movimentos: () => request<Paginated<Movimento>>('/api/estoque/movimentos?per_page=50'),
  criarItem: (payload: {
    codigo?: string
    nome: string
    categoria: string
    descricao?: string
    unidade: string
    saldo_atual: number
    estoque_minimo: number
  }) =>
    request<EstoqueItem>('/api/estoque/itens', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  atualizarItem: (id: number, payload: {
    codigo?: string
    nome: string
    categoria: string
    descricao?: string
    unidade: string
    estoque_minimo: number
    ativo: boolean
  }) =>
    request<EstoqueItemDetalhe>(`/api/estoque/itens/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  importarFotoItem: (id: number, foto: File) => {
    const form = new FormData()
    form.append('foto', foto)

    return request<EstoqueItemDetalhe>(`/api/estoque/itens/${id}/foto`, {
      method: 'POST',
      body: form,
    })
  },
  registrarMovimento: (payload: {
    tipo: 'entrada' | 'saida' | 'ajuste'
    item_id: number
    quantidade: number
    data_movimento: string
    documento?: string
    motivo?: string
    observacao?: string
  }) =>
    request<Movimento>('/api/estoque/movimentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
