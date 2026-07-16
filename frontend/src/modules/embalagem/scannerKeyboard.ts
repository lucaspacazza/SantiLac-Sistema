import type { FocusEvent, PointerEvent } from 'react'

type ScannerInputMode = 'text' | 'numeric' | 'decimal'

export function openScannerKeyboard(event: PointerEvent<HTMLInputElement>, inputMode: ScannerInputMode) {
  const input = event.currentTarget
  input.inputMode = inputMode

  if (document.activeElement !== input) return

  input.dataset.scannerKeyboardReopening = 'true'
  input.blur()
  window.setTimeout(() => {
    delete input.dataset.scannerKeyboardReopening
    input.focus({ preventScroll: true })
  }, 0)
}

export function closeScannerKeyboard(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget
  if (input.dataset.scannerKeyboardReopening === 'true') return

  input.inputMode = 'none'
}
