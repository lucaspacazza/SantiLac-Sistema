import { apiGet, apiPost, ensureCsrfToken } from './http'

export type AuthUser = {
  id: number
  nome: string
  usuario: string
  email: string | null
  niveis: string[]
  admin: boolean
}

export type AuthSession<TUser extends AuthUser | null = AuthUser | null> = {
  user: TUser
  session_lifetime_seconds?: number
}

export const authApi = {
  csrf: () => ensureCsrfToken(),
  me: () => apiGet<AuthSession>('/api/auth/me'),
  login: (login: string, password: string, remember = false) =>
    apiPost<AuthSession<AuthUser>>('/api/auth/login', { login, password, remember }),
  logout: () => apiPost<{ message: string }>('/api/auth/logout', {}),
}

