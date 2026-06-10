import { apiGet } from '../../../api/http'

export function cadastrosBuildUrl(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path, window.location.origin)
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value?.trim()) url.searchParams.set(key, value.trim())
  })
  return `${url.pathname}${url.search}`
}

export async function cadastrosGetJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  return apiGet<T>(cadastrosBuildUrl(path, params))
}
