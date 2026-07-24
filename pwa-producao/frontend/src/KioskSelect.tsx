import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const selectRef = useRef<HTMLSelectElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const currentValue = value ?? internalValue
  const selected = options.find((option) => option.value === currentValue)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dismissSoftKeyboard()
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

  function dismissSoftKeyboard() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
  }

  function openSelect(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    dismissSoftKeyboard()
    setOpen(true)
  }

  function applyValue(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue)
    onChange?.(nextValue)
  }

  function choose(nextValue: string) {
    applyValue(nextValue)
    setOpen(false)
    window.requestAnimationFrame(() => {
      selectRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
      selectRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  return (
    <span className="kiosk-select">
      <select
        ref={selectRef}
        className="kiosk-select-native"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={currentValue}
        required={required}
        onChange={(event) => applyValue(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button
        className={`kiosk-select-trigger ${selected ? 'has-value' : ''}`}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onPointerDown={openSelect}
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
