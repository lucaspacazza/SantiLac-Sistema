import { apiGet, apiPost, ensureCsrfToken } from './http'

export type AuthUser = {
  id: number
  nome: string
  usuario: string
  email: string | null
  niveis: string[]
  admin: boolean
}

export const authApi = {
  csrf: () => ensureCsrfToken(),
  me: () => apiGet<{ user: AuthUser | null }>('/api/auth/me'),
  login: (login: string, password: string, remember = false) =>
    apiPost<{ user: AuthUser }>('/api/auth/login', { login, password, remember }),
  logout: () => apiPost<{ message: string }>('/api/auth/logout', {}),
}
