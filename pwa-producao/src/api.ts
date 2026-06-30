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

export type FormulacaoQueijoCatalogos = {
  queijos: Array<{
    id: number
    slug: string
    nome: string
    codigo_balanca: string
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
  insumos: []
}

export type SoroRefrigeradoPayload = {
  data_registro: string
  entrada_diaria_estoque: number | null
  litragem_vendida: number | null
  silo_armazenado: string | null
  responsavel: string | null
}

let csrfToken: string | null = null

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

  const response = await fetch('/api/auth/csrf', {
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
  me: () => request<{ user: AuthUser | null }>('/api/auth/me'),
  login: (login: string, password: string, remember = true) =>
    postForm<{ user: AuthUser }>('/api/auth/login', { login, password, remember }),
}

export const producaoApi = {
  overview: () => request<Overview>('/api/producao/overview'),
  ordensProducao: (data: string) =>
    request<OrdemProducaoResumo[]>(`/api/producao/ordens-producao?data=${encodeURIComponent(data)}`),
  formulacaoQueijoCatalogos: () =>
    request<FormulacaoQueijoCatalogos>('/api/producao/formulacoes-queijo/catalogos'),
  salvarOrdemProducao: (payload: OrdemProducaoPayload) =>
    jsonMutation('/api/producao/ordens-producao', 'POST', payload),
  criarFormulacaoQueijo: (payload: FormulacaoQueijoPayload) =>
    jsonMutation<{ id: number }>('/api/producao/formulacoes-queijo', 'POST', payload),
  finalizarFormulacaoQueijo: (id: number) =>
    jsonMutation(`/api/producao/formulacoes-queijo/${id}/finalizar`, 'PATCH'),
  criarSoroRefrigerado: (payload: SoroRefrigeradoPayload) =>
    jsonMutation<{ id: number }>('/api/producao/soro-refrigerado', 'POST', payload),
  finalizarSoroRefrigerado: (id: number) =>
    jsonMutation(`/api/producao/soro-refrigerado/${id}/finalizar`, 'PATCH'),
}
