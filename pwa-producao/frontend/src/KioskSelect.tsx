import { useEffect, useId, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'

export type KioskSelectOption = {
  value: string
  label: string
}

export function KioskSelect({
  name,
  value,
  defaultValue = '',
  options,
  placeholder = 'Selecionar',
  ariaLabel,
  required = false,
  onChange,
}: {
  name?: string
  value?: string
  defaultValue?: string
  options: KioskSelectOption[]
  placeholder?: string
  ariaLabel: string
  required?: boolean
  onChange?: (value: string) => void
}) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const currentValueRef = useRef('')
  const titleId = useId()
  const currentValue = value ?? internalValue
  const selected = options.find((option) => option.value === currentValue)
  currentValueRef.current = currentValue

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }))
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    const form = inputRef.current?.form
    if (!required || !form) return

    const validateRequiredChoice = (event: SubmitEvent) => {
      if (currentValueRef.current !== '') return
      event.preventDefault()
      event.stopPropagation()
      setInvalid(true)
      showSelect()
    }

    form.addEventListener('submit', validateRequiredChoice)
    return () => form.removeEventListener('submit', validateRequiredChoice)
  }, [required])

  function dismissSoftKeyboard() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
    const nativeKeyboard = (window as Window & {
      SantiLacKeyboard?: { dismiss?: () => void }
    }).SantiLacKeyboard
    nativeKeyboard?.dismiss?.()
  }

  function showSelect() {
    if (open) return
    flushSync(() => setOpen(true))
    dismissSoftKeyboard()
  }

  function openSelect(event: React.SyntheticEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    showSelect()
  }

  function applyValue(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue)
    onChange?.(nextValue)
  }

  function choose(nextValue: string) {
    flushSync(() => {
      applyValue(nextValue)
      setInvalid(false)
      setOpen(false)
    })
    window.requestAnimationFrame(() => {
      inputRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
      inputRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  return (
    <span className="kiosk-select">
      <input
        ref={inputRef}
        type="hidden"
        name={name}
        value={currentValue}
        readOnly
        onInput={(event) => applyValue(event.currentTarget.value)}
      />
      <button
        className={`kiosk-select-trigger ${selected ? 'has-value' : ''} ${invalid ? 'is-invalid' : ''}`}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required}
        aria-invalid={invalid}
        onTouchStart={openSelect}
        onPointerDown={openSelect}
        onClick={openSelect}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && createPortal(
        <div className="kiosk-select-backdrop" onPointerDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false)
        }}>
          <section ref={dialogRef} className="kiosk-select-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
            <header>
              <div><span>Selecionar</span><h2 id={titleId}>{ariaLabel}</h2></div>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)}><X size={20} /></button>
            </header>
            <div className="kiosk-select-options" role="listbox" aria-label={ariaLabel}>
              {!required && (
                <button type="button" role="option" aria-selected={currentValue === ''} onClick={() => choose('')}>
                  <span>{placeholder}</span>{currentValue === '' && <Check size={19} />}
                </button>
              )}
              {options.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === currentValue}
                  className={option.value === currentValue ? 'is-selected' : ''}
                  key={option.value}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>{option.value === currentValue && <Check size={19} />}
                </button>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </span>
  )
}
