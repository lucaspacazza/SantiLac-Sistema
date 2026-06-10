export type Overview = {
  totais: {
    formulacoes_queijo: number
    soro_refrigerado: number
    formulacoes_creme: number
    producoes_creme: number
    ops_aguardando_formato: number
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
  codigo_formulacao: string
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

export type FormulacaoQueijoPayload = Omit<FormulacaoQueijo, 'id' | 'codigo_formulacao' | 'documento_codigo' | 'responsavel_id' | 'status'>

export type FormulacaoQueijoCatalogos = {
  queijos: Array<{
    id: number
    slug: string
    nome: string
    codigo_balanca: string
  }>
  insumos: Array<{
    id: number
    nome: string
    tipo_insumo: FormulacaoInsumo['tipo_insumo']
    unidade: string
  }>
}

export type StatusFicha = 'rascunho' | 'aguardando_formato' | 'finalizada' | 'cancelada'

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
}

export type SoroRefrigeradoPayload = Omit<SoroRefrigerado, 'id' | 'documento_codigo' | 'status' | 'estoque_total' | 'sobra_estoque'>

export type EstoqueSoroResumo = {
  estoque: {
    id: number
    nome: string
    unidade: string
    saldo_atual: number
  } | null
  ultima_entrada: {
    quantidade: number
    data_movimento: string
    saldo_depois: number
    documento: string | null
  } | null
  movimentos: Array<{
    id: number
    tipo: 'entrada' | 'saida' | 'ajuste'
    quantidade: number
    saldo_antes: number
    saldo_depois: number
    data_movimento: string
    documento: string | null
    motivo: string | null
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
}

export type ProducaoCremePayload = Omit<ProducaoCreme, 'id' | 'documento_codigo' | 'status'>

export type OrdemProducao = {
  id: number | null
  codigo_ordem: string | null
  data: string | null
  manual: boolean
  origem: string
  status: StatusFicha | null
  pendencia_formato: boolean
  total_formulacoes: number
  campos: Array<{
    rotulo: string
    valor: string
  }>
  formulacoes: Array<{
    id: number
    codigo_formulacao: string
    tipo_queijo: string
    lote_queijo: string
    quantidade_leite: number
    status: string
  }>
}

export type OrdemProducaoResumo = {
  id: number
  codigo_ordem: string
  data: string | null
  tipo_queijo: string
  lote_queijo: string | null
  origem: string
  status: StatusFicha | null
  pendencia_formato: boolean
}

export type OrdemProducaoPayload = {
  data: string
  codigo_ordem?: string | null
  campos: Array<{
    rotulo: string
    valor: string
  }>
  observacoes?: string | null
}

export type OrdemProducaoCatalogos = {
  queijos: Array<{
    id: number
    nome: string
    slug: string
    codigo_balanca: string
    op_rotulo: string | null
    precisa_formato: boolean
  }>
  insumos: Array<{
    id: number
    nome: string
    unidade: string
    op_rotulo: string
  }>
}

export type ExportFormat = 'docx' | 'pdf'
export type OrdemExportFormat = 'xlsx' | 'pdf'
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
      Accept: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf, application/json',
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
  ordensProducao: (data = '') =>
    request<OrdemProducaoResumo[]>(`/api/producao/ordens-producao?data=${encodeURIComponent(data)}`),
  ordemProducao: (id: number) => request<OrdemProducao>(`/api/producao/ordens-producao/${id}`),
  ordemProducaoCatalogos: () => request<OrdemProducaoCatalogos>('/api/producao/ordens-producao/catalogos'),
  salvarOrdemProducao: (payload: OrdemProducaoPayload) =>
    request<OrdemProducao>('/api/producao/ordens-producao', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  definirFormatoOrdemProducao: (id: number, formato: 'f1' | 'f4' | 'f6') =>
    request<OrdemProducao>(`/api/producao/ordens-producao/${id}/definir-formato`, {
      method: 'PATCH',
      body: JSON.stringify({ formato }),
    }),
  exportarOrdensProducaoDia: (data: string, formato: OrdemExportFormat) =>
    download(`/api/producao/ordens-producao/exportar/${formato}?data=${encodeURIComponent(data)}`, `ordens-producao-${data}.${formato}`),
  exportarOrdemProducao: (id: number, formato: OrdemExportFormat) =>
    download(`/api/producao/ordens-producao/${id}/exportar/${formato}`, `ordem-producao-${id}.${formato}`),
  formulacoesQueijo: (q = '', page = 1, perPage = 10, data = '') =>
    request<Paginated<FormulacaoQueijo>>(`/api/producao/formulacoes-queijo?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}&data=${encodeURIComponent(data)}`),
  formulacaoQueijoCatalogos: () => request<FormulacaoQueijoCatalogos>('/api/producao/formulacoes-queijo/catalogos'),
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
  gerarOpFormulacaoQueijo: (id: number) =>
    request<OrdemProducao>(`/api/producao/formulacoes-queijo/${id}/gerar-op`, {
      method: 'POST',
    }),
  cancelarFormulacaoQueijo: (id: number) =>
    request<FormulacaoQueijo>(`/api/producao/formulacoes-queijo/${id}/cancelar`, {
      method: 'PATCH',
    }),
  exportarFormulacaoQueijo: (id: number, formato: ExportFormat) =>
    download(`/api/producao/formulacoes-queijo/${id}/exportar${formato === 'pdf' ? '/pdf' : ''}`, `formulacao-queijo-${id}.${formato}`),
  soroRefrigerado: (q = '', page = 1, perPage = 10) =>
    request<Paginated<SoroRefrigerado>>(`/api/producao/soro-refrigerado?per_page=${perPage}&page=${page}&q=${encodeURIComponent(q)}`),
  estoqueSoroRefrigerado: () => request<EstoqueSoroResumo>('/api/producao/soro-refrigerado/estoque'),
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
  cancelarSoroRefrigerado: (id: number) =>
    request<SoroRefrigerado>(`/api/producao/soro-refrigerado/${id}/cancelar`, {
      method: 'PATCH',
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
  cancelarFormulacaoCreme: (id: number) =>
    request<FormulacaoCreme>(`/api/producao/formulacoes-creme/${id}/cancelar`, {
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
  cancelarProducaoCreme: (id: number) =>
    request<ProducaoCreme>(`/api/producao/producoes-creme/${id}/cancelar`, {
      method: 'PATCH',
    }),
  exportarProducaoCreme: (id: number, formato: ExportFormat) =>
    download(`/api/producao/producoes-creme/${id}/exportar${formato === 'pdf' ? '/pdf' : ''}`, `producao-creme-${id}.${formato}`),
}
