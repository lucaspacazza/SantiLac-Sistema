import type { AuthUser } from '../../../api/authApi'

const CACHED_USER_KEY = 'embalagem-cached-user'

export function readCachedPackagingUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(CACHED_USER_KEY)
    if (!raw) return null
    const user = JSON.parse(raw) as Partial<AuthUser>
    if (typeof user.id !== 'number' || typeof user.nome !== 'string' || typeof user.usuario !== 'string' || !Array.isArray(user.niveis)) {
      return null
    }
    return user as AuthUser
  } catch {
    return null
  }
}

export function writeCachedPackagingUser(user: AuthUser): void {
  window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user))
}

export function clearCachedPackagingUser(): void {
  window.localStorage.removeItem(CACHED_USER_KEY)
}
