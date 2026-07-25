type SystemWorkspaceState = {
  version: 1
  hash: string
  scrollByHash: Record<string, number>
}

const STORAGE_PREFIX = 'santilac:system:workspace:'

function storageKey(userId: string | number): string {
  return `${STORAGE_PREFIX}${userId}`
}

function validHash(hash: string): boolean {
  return hash.startsWith('#/') && hash.length <= 300
}

function readWorkspace(userId: string | number): SystemWorkspaceState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    if (validHash(raw)) return { version: 1, hash: raw, scrollByHash: {} }
    const parsed = JSON.parse(raw) as SystemWorkspaceState
    if (parsed.version !== 1 || !validHash(parsed.hash) || typeof parsed.scrollByHash !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function rememberSystemWorkspace(
  userId: string | number,
  hash = window.location.hash,
  scrollY = window.scrollY,
): void {
  if (!validHash(hash)) return
  const previous = readWorkspace(userId)
  const state: SystemWorkspaceState = {
    version: 1,
    hash,
    scrollByHash: {
      ...previous?.scrollByHash,
      [hash]: Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0,
    },
  }
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    // The current URL still preserves the route when storage is unavailable.
  }
}

export function restoreSystemWorkspace(
  userId: string | number,
  currentHash = window.location.hash,
  preferSaved = false,
): string {
  const saved = readWorkspace(userId)?.hash ?? ''
  if (preferSaved) return validHash(saved) ? saved : '#/sistema'
  if (validHash(currentHash) && currentHash !== '#/sistema') return currentHash
  if (validHash(saved)) return saved
  return validHash(currentHash) ? currentHash : '#/sistema'
}

export function restoreSystemScroll(userId: string | number, hash = window.location.hash): number {
  const saved = readWorkspace(userId)?.scrollByHash[hash]
  return Number.isFinite(saved) ? Math.max(0, saved as number) : 0
}
