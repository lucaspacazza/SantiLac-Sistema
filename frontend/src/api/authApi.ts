import { apiGet, apiPost, ensureCsrfToken } from './http'

export type AuthUser = {
  id: number
  nome: string
  email: string
  niveis: string[]
}

export const authApi = {
  csrf: () => ensureCsrfToken(),
  me: () => apiGet<{ user: AuthUser | null }>('/api/auth/me'),
  login: (email: string, password: string, remember = false) =>
    apiPost<{ user: AuthUser }>('/api/auth/login', { email, password, remember }),
  logout: () => apiPost<{ message: string }>('/api/auth/logout', {}),
}
