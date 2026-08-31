export type TouchPoint = {
  x: number
  y: number
}

const TAP_MOVEMENT_TOLERANCE_PX = 10

export function movedBeyondTapThreshold(start: TouchPoint, current: TouchPoint): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > TAP_MOVEMENT_TOLERANCE_PX
}

export function dismissSoftKeyboard(): void {
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement) activeElement.blur()

  const nativeKeyboard = (window as Window & {
    SantiLacKeyboard?: { dismiss?: () => void }
  }).SantiLacKeyboard
  nativeKeyboard?.dismiss?.()
}
