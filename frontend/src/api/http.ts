let csrfToken: string | null = null
export const AUTH_EXPIRED_EVENT = 'santilac:auth-expired'
export const SESSION_ACTIVITY_EVENT = 'santilac:session-activity'
export const MUTATION_SUCCEEDED_EVENT = 'santilac:mutation-succeeded'

function announceExpiredSession(response: Response): void {
  if (response.status === 401 || response.status === 419) {
    csrfToken = null
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { status: response.status } }))
  }
}

function announceSuccessfulMutation(path: string): void {
  window.dispatchEvent(new CustomEvent(MUTATION_SUCCEEDED_EVENT, { detail: { path } }))
}

function announceSessionActivity(response: Response): void {
  if (response.ok) {
    window.dispatchEvent(new CustomEvent(SESSION_ACTIVITY_EVENT))
  }
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  message?: string
  errors?: Record<string, string[]>
}

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken

  const response = await fetch('/api/auth/csrf', {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
    },
  })
  announceExpiredSession(response)

  if (!response.ok) {
    throw new Error('Não foi possível iniciar a sessão.')
  }

  const json = (await response.json()) as ApiResponse<{ token: string }>
  if (!json.data?.token) {
    throw new Error('Não foi possível iniciar a sessão.')
  }

  announceSessionActivity(response)
  csrfToken = json.data.token
  return csrfToken
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
    },
  })

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null
  announceExpiredSession(response)
  if (!response.ok || !json?.success || json.data === undefined) {
    throw new Error(apiErrorMessage(json, `HTTP ${response.status}`))
  }

  announceSessionActivity(response)
  return json.data
}

export async function apiPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetchWithCsrf(path, 'POST', payload)

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null
  announceExpiredSession(response)
  if (!response.ok || !json?.success || json.data === undefined) {
    throw new Error(apiErrorMessage(json, 'Falha ao processar solicitação.'))
  }

  announceSessionActivity(response)
  announceSuccessfulMutation(path)
  return json.data
}

export async function apiPatch<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetchWithCsrf(path, 'PATCH', payload)

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null
  announceExpiredSession(response)
  if (!response.ok || !json?.success || json.data === undefined) {
    throw new Error(apiErrorMessage(json, 'Falha ao processar solicitação.'))
  }

  announceSessionActivity(response)
  announceSuccessfulMutation(path)
  return json.data
}

async function fetchWithCsrf(path: string, method: 'POST' | 'PATCH', payload: Record<string, unknown>, retry = true): Promise<Response> {
  const token = await ensureCsrfToken()
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-TOKEN': token,
    },
    body: toFormBody(payload),
  })

  if (response.status === 419 && retry) {
    csrfToken = null
    return fetchWithCsrf(path, method, payload, false)
  }

  return response
}

export async function apiPostFile<T>(path: string, field: string, file: File): Promise<T> {
  const token = await ensureCsrfToken()
  const formData = new FormData()
  formData.append(field, file)

  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
    headers: {
      Accept: 'application/json',
      'X-CSRF-TOKEN': token,
    },
  })

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null
  announceExpiredSession(response)
  if (!response.ok || !json?.success || json.data === undefined) {
    throw new Error(apiErrorMessage(json, 'Falha ao enviar arquivo.'))
  }

  announceSessionActivity(response)
  announceSuccessfulMutation(path)
  return json.data
}

export async function apiDownload(
  path: string,
  payload: Record<string, unknown>,
  options: { accept: string; fallback: string; errorMessage: string },
): Promise<{ arquivo: string }> {
  const token = await ensureCsrfToken()
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: options.accept,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-TOKEN': token,
    },
    body: toFormBody(payload),
  })

  if (!response.ok) {
    announceExpiredSession(response)
    const json = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
    throw new Error(apiErrorMessage(json, options.errorMessage))
  }

  const blob = await response.blob()
  const arquivo = filenameFromDisposition(response.headers.get('Content-Disposition'), options.fallback)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = arquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)

  announceSessionActivity(response)
  announceSuccessfulMutation(path)
  return { arquivo }
}

function apiErrorMessage<T>(json: ApiResponse<T> | null, fallback: string): string {
  if (json?.error?.message) {
    return json.error.message
  }

  const validationMessage = Object.values(json?.errors ?? {})[0]?.[0]
  if (validationMessage) {
    return validationMessage
  }

  return json?.message ?? fallback
}

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1].replace(/"/g, ''))
  }

  const match = disposition.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? fallback
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
