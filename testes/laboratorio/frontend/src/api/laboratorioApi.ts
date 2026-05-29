export type Overview = {
  totais: {
    cronogramas: number
    agua_filagem: number
    itens_previstos: number
    itens_atrasados: number
  }
  submodulos: Array<{
    codigo: string
    nome: string
    documento: string
    descricao: string | null
    rota_preenchimento: string
    rota_listagem: string
    status: string
  }>
}

export type CronogramaItem = {
  id?: number
  produto: string
  matriz: 'queijo' | 'creme' | 'soro' | 'agua' | 'outro'
  mes: number
  tipo_analise: 'fisico_quimica' | 'microbiologica' | 'fisico_quimica_microbiologica'
  ate_dia: number
  laboratorio_destino?: string | null
  status: 'prevista' | 'coletada' | 'enviada' | 'laudo_recebido' | 'cancelada'
  observacoes?: string | null
}

export type Cronograma = {
  id: number
  documento_codigo: string
  documento_revisao: string | null
  ano: number
  titulo: string
  responsavel_tecnico_id: number | null
  status: 'rascunho' | 'ativo' | 'encerrado' | 'cancelado'
  observacoes: string | null
  itens: CronogramaItem[]
}

export type Paginated<T> = {
  items: T[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export type AguaFilagem = {
  id: number
  documento_codigo: string
  data_monitoramento: string
  sequencia: number | null
  hora: string | null
  acidez: number | null
  gordura: number | null
  ph: number | null
  responsavel: string | null
  status: 'rascunho' | 'finalizada' | 'cancelada'
  observacoes: string | null
}

export type AguaFilagemPayload = Omit<AguaFilagem, 'id' | 'documento_codigo' | 'status'>

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? 'Não foi possível concluir a operação.')
  }

  return payload.data as T
}

export const laboratorioApi = {
  overview: () => request<Overview>('/api/laboratorio/overview'),
  cronogramas: (ano = '') => request<Paginated<Cronograma>>(`/api/laboratorio/cronogramas?per_page=100&ano=${encodeURIComponent(ano)}`),
  criarCronograma: (payload: Omit<Cronograma, 'id' | 'documento_codigo' | 'responsavel_tecnico_id' | 'status'> & { status?: Cronograma['status'] }) =>
    request<Cronograma>('/api/laboratorio/cronogramas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  aguaFilagem: (q = '', page = 1, perPage = 10) =>
    request<Paginated<AguaFilagem>>(`/api/laboratorio/agua-filagem?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}`),
  aguaFilagemItem: (id: number) => request<AguaFilagem>(`/api/laboratorio/agua-filagem/${id}`),
  criarAguaFilagem: (payload: AguaFilagemPayload) =>
    request<AguaFilagem>('/api/laboratorio/agua-filagem', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  atualizarAguaFilagem: (id: number, payload: AguaFilagemPayload) =>
    request<AguaFilagem>(`/api/laboratorio/agua-filagem/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  finalizarAguaFilagem: (id: number) =>
    request<AguaFilagem>(`/api/laboratorio/agua-filagem/${id}/finalizar`, {
      method: 'PATCH',
    }),
}
