import { useId, useState } from 'react'
import type {
  ChangeEvent,
  ClipboardEvent,
  InputHTMLAttributes,
  InputEvent as ReactInputEvent,
  KeyboardEvent,
} from 'react'

const POINT_WARNING = 'Não use ponto. Digite somente números e vírgula.'

export function NoDotNumberInput({ onChange, onKeyDown, onBeforeInput, onPaste, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const warningId = useId()
  const [warningVisible, setWarningVisible] = useState(false)
  const [invalid, setInvalid] = useState(false)

  function showBlockedPoint() {
    setWarningVisible(true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === '.') {
      event.preventDefault()
      showBlockedPoint()
    }
    onKeyDown?.(event)
  }

  function handleBeforeInput(event: ReactInputEvent<HTMLInputElement>) {
    const insertedText = event.data ?? ''
    if (insertedText.includes('.')) {
      event.preventDefault()
      showBlockedPoint()
    }
    onBeforeInput?.(event)
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    if (event.clipboardData.getData('text').includes('.')) {
      event.preventDefault()
      showBlockedPoint()
    }
    onPaste?.(event)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const hasPoint = event.currentTarget.value.includes('.')
    event.currentTarget.setCustomValidity(hasPoint ? POINT_WARNING : '')
    setInvalid(hasPoint)
    setWarningVisible(hasPoint)
    onChange?.(event)
  }

  return (
    <span className="no-dot-number-control">
      <input
        {...props}
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        aria-describedby={warningVisible ? warningId : props['aria-describedby']}
        onBeforeInput={handleBeforeInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />
      {warningVisible && <small id={warningId} className="number-input-warning" role="alert">{POINT_WARNING}</small>}
    </span>
  )
}
