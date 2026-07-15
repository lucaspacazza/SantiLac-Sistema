type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    message?: string
  }
  message?: string
  errors?: Record<string, string[]>
}

export type AuthUser = {
  id: number
  nome: string
  usuario: string
  email: string | null
  niveis: string[]
  admin: boolean
}

export type Overview = {
  totais: {
    formulacoes_queijo: number
    soro_refrigerado: number
    formulacoes_creme: number
    producoes_creme: number
    ops_aguardando_formato: number
    rascunhos: number
  }
}

export type OrdemProducaoResumo = {
  id: number
  codigo_ordem: string
  data: string | null
  tipo_queijo: string
  lote_queijo: string | null
  origem: string
  status: 'rascunho' | 'aguardando_formato' | 'finalizada' | 'cancelada' | null
  pendencia_formato: boolean
}

export type OrdemProducaoDetalhe = {
  id: number
  codigo_ordem: string
  data: string | null
  manual: boolean
  origem: string
  status: 'rascunho' | 'aguardando_formato' | 'finalizada' | 'cancelada'
  pendencia_formato: boolean
  total_formulacoes: number
  campos: Array<{ rotulo: string; valor: string }>
  formulacoes: Array<{
    id: number
    codigo_formulacao: string
    tipo_queijo: string
    lote_queijo: string | null
    quantidade_leite: number
    status: string
  }>
}

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
    tipo_insumo: 'fermento_mvd' | 'fermento_fast' | 'fermento' | 'cloreto' | 'corante' | 'coalho' | 'outro'
    unidade: string
  }>
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

export type OrdemProducaoPayload = {
  data: string
  codigo_ordem?: string | null
  campos: Array<{ rotulo: string; valor: string }>
}

export type FormulacaoQueijoPayload = {
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
  insumos: Array<{
    tipo_insumo: 'fermento_mvd' | 'fermento_fast' | 'fermento' | 'cloreto' | 'corante' | 'coalho' | 'outro'
    nome_insumo: string | null
    quantidade: number
    unidade: string
    lote_insumo: string | null
  }>
}

export type FormulacaoQueijo = FormulacaoQueijoPayload & {
  id: number
  codigo_formulacao: string
  status: 'rascunho' | 'finalizada' | 'cancelada'
}

export type FormulacoesQueijoPage = {
  items: FormulacaoQueijo[]
  pagination: { current_page: number; per_page: number; total: number }
}

export type SoroRefrigeradoPayload = {
  data_registro: string
  entrada_diaria_estoque: number | null
  litragem_vendida: number | null
  silo_armazenado: string | null
  responsavel: string | null
}

export type FormulacaoCremePayload = {
  data_fabricacao: string
  lote_creme_produzido: string
  tipo_creme: string
  mes: number | null
  ano: number | null
  gordura_inicial: number | null
  gordura_final: number | null
  acidez: number | null
  responsavel_monitoramento: string | null
  responsavel: string | null
}

export type ProducaoCremePayload = {
  data_fabricacao: string
  lote_creme_produzido: string
  tipo_creme: string
  mes: number | null
  ano: number | null
  quantidade_produzida_kg: number | null
  responsavel_monitoramento: string | null
  responsavel: string | null
}

let csrfToken: string | null = null
const API_BASE = '/api/fabrica'

function errorMessage<T>(payload: ApiResponse<T> | null, fallback: string): string {
  const validation = Object.values(payload?.errors ?? {})[0]?.[0]

  return payload?.error?.message ?? validation ?? payload?.message ?? fallback
}

function toFormBody(payload: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams()

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0')
      return
    }
    params.set(key, String(value))
  })

  return params
}

async function csrf(): Promise<string> {
  if (csrfToken) return csrfToken

  const response = await fetch(`${API_BASE}/auth/csrf`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<{ token: string }> | null

  if (!response.ok || !payload?.data?.token) {
    throw new Error('Não foi possível iniciar a sessão.')
  }

  csrfToken = payload.data.token
  return csrfToken
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(errorMessage(payload, 'Não foi possível concluir a operação.'))
  }

  return payload.data
}

async function postForm<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const token = await csrf()
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-TOKEN': token,
    },
    body: toFormBody(payload),
  })
  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !json?.success || json.data === undefined) {
    throw new Error(errorMessage(json, 'Não foi possível concluir a operação.'))
  }

  return json.data
}

async function jsonMutation<T>(path: string, method: 'POST' | 'PATCH', payload?: unknown): Promise<T> {
  const token = await csrf()

  return request<T>(path, {
    method,
    headers: { 'X-CSRF-TOKEN': token },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
}

export const authApi = {
  csrf,
  me: () => request<{ user: AuthUser | null }>(`${API_BASE}/auth/me`),
  login: (login: string, password: string, remember = true) =>
    postForm<{ user: AuthUser }>(`${API_BASE}/auth/login`, { login, password, remember }),
}

export const producaoApi = {
  overview: () => request<Overview>(`${API_BASE}/producao/overview`),
  ordensProducao: (data: string) =>
    request<OrdemProducaoResumo[]>(`${API_BASE}/producao/ordens-producao?data=${encodeURIComponent(data)}`),
  ordensProducaoAbertas: () =>
    request<OrdemProducaoResumo[]>(`${API_BASE}/producao/ordens-producao?status=abertas`),
  ordemProducao: (id: number) =>
    request<OrdemProducaoDetalhe>(`${API_BASE}/producao/ordens-producao/${id}`),
  ordensProducaoCatalogos: () =>
    request<OrdemProducaoCatalogos>(`${API_BASE}/producao/ordens-producao/catalogos`),
  formulacaoQueijoCatalogos: () =>
    request<FormulacaoQueijoCatalogos>(`${API_BASE}/producao/formulacoes-queijo/catalogos`),
  formulacoesQueijoAbertas: () =>
    request<FormulacoesQueijoPage>(`${API_BASE}/producao/formulacoes-queijo?status=rascunho&per_page=100`),
  salvarOrdemProducao: (payload: OrdemProducaoPayload) =>
    jsonMutation<OrdemProducaoDetalhe>(`${API_BASE}/producao/ordens-producao`, 'POST', payload),
  finalizarOrdemProducao: (id: number) =>
    jsonMutation<OrdemProducaoDetalhe>(`${API_BASE}/producao/ordens-producao/${id}/finalizar`, 'PATCH'),
  criarFormulacaoQueijo: (payload: FormulacaoQueijoPayload) =>
    jsonMutation<FormulacaoQueijo>(`${API_BASE}/producao/formulacoes-queijo`, 'POST', payload),
  atualizarFormulacaoQueijo: (id: number, payload: FormulacaoQueijoPayload) =>
    jsonMutation<FormulacaoQueijo>(`${API_BASE}/producao/formulacoes-queijo/${id}`, 'PATCH', payload),
  finalizarFormulacaoQueijo: (id: number) =>
    jsonMutation(`${API_BASE}/producao/formulacoes-queijo/${id}/finalizar`, 'PATCH'),
  criarSoroRefrigerado: (payload: SoroRefrigeradoPayload) =>
    jsonMutation<{ id: number }>(`${API_BASE}/producao/soro-refrigerado`, 'POST', payload),
  finalizarSoroRefrigerado: (id: number) =>
    jsonMutation(`${API_BASE}/producao/soro-refrigerado/${id}/finalizar`, 'PATCH'),
  criarFormulacaoCreme: (payload: FormulacaoCremePayload) =>
    jsonMutation<{ id: number }>(`${API_BASE}/producao/formulacoes-creme`, 'POST', payload),
  finalizarFormulacaoCreme: (id: number) =>
    jsonMutation(`${API_BASE}/producao/formulacoes-creme/${id}/finalizar`, 'PATCH'),
  criarProducaoCreme: (payload: ProducaoCremePayload) =>
    jsonMutation<{ id: number }>(`${API_BASE}/producao/producoes-creme`, 'POST', payload),
  finalizarProducaoCreme: (id: number) =>
    jsonMutation(`${API_BASE}/producao/producoes-creme/${id}/finalizar`, 'PATCH'),
}
