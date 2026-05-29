export type Overview = {
  totais: {
    formulacoes_queijo: number
    soro_refrigerado: number
    formulacoes_creme: number
    producoes_creme: number
    rascunhos: number
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

export type FormulacaoInsumo = {
  id?: number
  tipo_insumo: 'fermento_mvd' | 'fermento_fast' | 'fermento' | 'cloreto' | 'corante' | 'coalho' | 'outro'
  nome_insumo?: string | null
  quantidade: number
  unidade: string
  lote_insumo?: string | null
}

export type FormulacaoQueijo = {
  id: number
  documento_codigo: string
  tipo_queijo: string
  data_formulacao: string
  silo: string | null
  lote_leite: string | null
  lote_queijo: string
  numero_queijomatic: string | null
  inicio_enchimento: string | null
  quantidade_leite: number | null
  temperatura_pasteurizacao: number | null
  fosfatase: 'negativo' | 'positivo' | 'nao_aplicavel' | null
  peroxidase: 'negativo' | 'positivo' | 'nao_aplicavel' | null
  gordura_inicial: number | null
  gordura_final: number | null
  acidez: number | null
  temperatura_coagulacao: number | null
  hora_coagulacao: string | null
  hora_corte: string | null
  temperatura_cozimento: number | null
  responsavel_id: number | null
  status: 'rascunho' | 'finalizada' | 'cancelada'
  observacoes: string | null
  insumos: FormulacaoInsumo[]
}

export type Paginated<T> = {
  items: T[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
}

export type FormulacaoQueijoPayload = Omit<FormulacaoQueijo, 'id' | 'documento_codigo' | 'responsavel_id' | 'status'>

export type StatusFicha = 'rascunho' | 'finalizada' | 'cancelada'

export type SoroRefrigerado = {
  id: number
  documento_codigo: string
  data_registro: string
  entrada_diaria_estoque: number | null
  estoque_total: number | null
  litragem_vendida: number | null
  sobra_estoque: number | null
  silo_armazenado: string | null
  responsavel: string | null
  status: StatusFicha
  observacoes: string | null
}

export type SoroRefrigeradoPayload = Omit<SoroRefrigerado, 'id' | 'documento_codigo' | 'status' | 'estoque_total' | 'sobra_estoque'>

export type EstoqueSoroResultado = {
  ficha: SoroRefrigerado
  estoque: {
    id: number
    nome: string
    unidade: string
    saldo_atual: number
  }
  movimentado: boolean
  movimentos: Array<{
    tipo: 'entrada' | 'saida'
    quantidade: number
    saldo_antes: number
    saldo_depois: number
  }>
}

export type FormulacaoCreme = {
  id: number
  documento_codigo: string
  responsavel_monitoramento: string | null
  mes: number | null
  ano: number | null
  tipo_creme: string | null
  data_fabricacao: string
  lote_creme_produzido: string
  gordura_inicial: number | null
  gordura_final: number | null
  acidez: number | null
  responsavel: string | null
  status: StatusFicha
  observacoes: string | null
}

export type FormulacaoCremePayload = Omit<FormulacaoCreme, 'id' | 'documento_codigo' | 'status'>

export type ProducaoCreme = {
  id: number
  documento_codigo: string
  responsavel_monitoramento: string | null
  mes: number | null
  ano: number | null
  tipo_creme: string | null
  data_fabricacao: string
  lote_creme_produzido: string
  quantidade_produzida_kg: number | null
  responsavel: string | null
  status: StatusFicha
  observacoes: string | null
}

export type ProducaoCremePayload = Omit<ProducaoCreme, 'id' | 'documento_codigo' | 'status'>

export type ExportFormat = 'docx' | 'pdf'
export type ExportacaoDownload = { arquivo: string }

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

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const match = disposition.match(/filename="?([^"]+)"?/i)

  return match?.[1] ?? fallback
}

async function download(path: string, fallback: string): Promise<ExportacaoDownload> {
  const response = await fetch(path, {
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, application/json',
    },
  })
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!response.ok || contentType.includes('application/json')) {
    const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null
    throw new Error(payload?.error?.message ?? 'Não foi possível exportar o documento.')
  }

  const blob = await response.blob()
  const arquivo = filenameFromDisposition(response.headers.get('Content-Disposition'), fallback)
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

export const producaoApi = {
  overview: () => request<Overview>('/api/producao/overview'),
  formulacoesQueijo: (q = '', page = 1, perPage = 10) =>
    request<Paginated<FormulacaoQueijo>>(`/api/producao/formulacoes-queijo?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}`),
  formulacaoQueijo: (id: number) => request<FormulacaoQueijo>(`/api/producao/formulacoes-queijo/${id}`),
  criarFormulacaoQueijo: (payload: FormulacaoQueijoPayload) =>
    request<FormulacaoQueijo>('/api/producao/formulacoes-queijo', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  atualizarFormulacaoQueijo: (id: number, payload: FormulacaoQueijoPayload) =>
    request<FormulacaoQueijo>(`/api/producao/formulacoes-queijo/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  finalizarFormulacaoQueijo: (id: number) =>
    request<FormulacaoQueijo>(`/api/producao/formulacoes-queijo/${id}/finalizar`, {
      method: 'PATCH',
    }),
  exportarFormulacaoQueijo: (id: number, formato: ExportFormat) =>
    download(`/api/producao/formulacoes-queijo/${id}/exportar${formato === 'pdf' ? '/pdf' : ''}`, `formulacao-queijo-${id}.${formato}`),
  soroRefrigerado: (q = '', page = 1, perPage = 10) =>
    request<Paginated<SoroRefrigerado>>(`/api/producao/soro-refrigerado?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}`),
  soroRefrigeradoItem: (id: number) => request<SoroRefrigerado>(`/api/producao/soro-refrigerado/${id}`),
  criarSoroRefrigerado: (payload: SoroRefrigeradoPayload) =>
    request<SoroRefrigerado>('/api/producao/soro-refrigerado', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  atualizarSoroRefrigerado: (id: number, payload: SoroRefrigeradoPayload) =>
    request<SoroRefrigerado>(`/api/producao/soro-refrigerado/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  finalizarSoroRefrigerado: (id: number) =>
    request<SoroRefrigerado>(`/api/producao/soro-refrigerado/${id}/finalizar`, {
      method: 'PATCH',
    }),
  controlarEstoqueSoroRefrigerado: (id: number) =>
    request<EstoqueSoroResultado>(`/api/producao/soro-refrigerado/${id}/estoque`, {
      method: 'POST',
    }),
  exportarSoroRefrigerado: (id: number, formato: ExportFormat) =>
    download(`/api/producao/soro-refrigerado/${id}/exportar${formato === 'pdf' ? '/pdf' : ''}`, `soro-refrigerado-${id}.${formato}`),
  formulacoesCreme: (q = '', page = 1, perPage = 10) =>
    request<Paginated<FormulacaoCreme>>(`/api/producao/formulacoes-creme?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}`),
  formulacaoCreme: (id: number) => request<FormulacaoCreme>(`/api/producao/formulacoes-creme/${id}`),
  criarFormulacaoCreme: (payload: FormulacaoCremePayload) =>
    request<FormulacaoCreme>('/api/producao/formulacoes-creme', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  atualizarFormulacaoCreme: (id: number, payload: FormulacaoCremePayload) =>
    request<FormulacaoCreme>(`/api/producao/formulacoes-creme/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  finalizarFormulacaoCreme: (id: number) =>
    request<FormulacaoCreme>(`/api/producao/formulacoes-creme/${id}/finalizar`, {
      method: 'PATCH',
    }),
  exportarFormulacaoCreme: (id: number, formato: ExportFormat) =>
    download(`/api/producao/formulacoes-creme/${id}/exportar${formato === 'pdf' ? '/pdf' : ''}`, `formulacao-creme-${id}.${formato}`),
  producoesCreme: (q = '', page = 1, perPage = 10) =>
    request<Paginated<ProducaoCreme>>(`/api/producao/producoes-creme?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}`),
  producaoCreme: (id: number) => request<ProducaoCreme>(`/api/producao/producoes-creme/${id}`),
  criarProducaoCreme: (payload: ProducaoCremePayload) =>
    request<ProducaoCreme>('/api/producao/producoes-creme', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  atualizarProducaoCreme: (id: number, payload: ProducaoCremePayload) =>
    request<ProducaoCreme>(`/api/producao/producoes-creme/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  finalizarProducaoCreme: (id: number) =>
    request<ProducaoCreme>(`/api/producao/producoes-creme/${id}/finalizar`, {
      method: 'PATCH',
    }),
  exportarProducaoCreme: (id: number, formato: ExportFormat) =>
    download(`/api/producao/producoes-creme/${id}/exportar${formato === 'pdf' ? '/pdf' : ''}`, `producao-creme-${id}.${formato}`),
}
