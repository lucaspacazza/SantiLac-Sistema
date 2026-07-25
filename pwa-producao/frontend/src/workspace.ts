export type ProductionWorkspaceState = {
  version: 1
  userId: string
  updatedAt: number
  view: string
  date: string
  orderEditorOpen: boolean
  activeOrderId: number | null
  cheeseEditorOpen: boolean
  activeCheeseFormulaId: number | null
  scrollY: number
}

const STORAGE_PREFIX = 'santilac:pwa-producao:workspace:'

function storageKey(userId: string | number): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function saveWorkspaceState(
  userId: string | number,
  state: Omit<ProductionWorkspaceState, 'version' | 'userId' | 'updatedAt'>,
): void {
  const snapshot: ProductionWorkspaceState = {
    version: 1,
    userId: String(userId),
    updatedAt: Date.now(),
    ...state,
  }
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(snapshot))
  } catch {
    // The mounted workspace still survives behind the login screen.
  }
}

export function readWorkspaceState(userId: string | number): ProductionWorkspaceState | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? 'null') as ProductionWorkspaceState | null
    if (!parsed || parsed.version !== 1 || parsed.userId !== String(userId)) return null
    return {
      ...parsed,
      scrollY: Number.isFinite(parsed.scrollY) ? Math.max(0, parsed.scrollY) : 0,
    }
  } catch {
    return null
  }
}
