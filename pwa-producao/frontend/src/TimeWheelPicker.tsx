import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Clock3, X } from 'lucide-react'
import { formatTimeValue, normalizeTimeValue, parseTimeValue, wheelIndexFromScroll } from './dateTime'
import { DRAFT_RESTORED_EVENT, draftFieldValue, type FormDraft } from './drafts'

const ITEM_HEIGHT = 52
const hours = Array.from({ length: 24 }, (_, index) => index)
const minutes = Array.from({ length: 60 }, (_, index) => index)

export function TimeWheelInput({ name, label, defaultValue = '' }: {
  name: string
  label: string
  defaultValue?: string
}) {
  const [value, setValue] = useState(() => normalizeTimeValue(defaultValue))
  const [open, setOpen] = useState(false)
  const [draftHour, setDraftHour] = useState(0)
  const [draftMinute, setDraftMinute] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(normalizeTimeValue(defaultValue))
  }, [defaultValue])

  useEffect(() => {
    const restore = (event: Event) => {
      const draft = (event as CustomEvent<{ draft: FormDraft }>).detail?.draft
      const restoredValue = draftFieldValue(draft, name)
      if (restoredValue !== undefined) setValue(normalizeTimeValue(restoredValue))
    }
    window.addEventListener(DRAFT_RESTORED_EVENT, restore)
    return () => window.removeEventListener(DRAFT_RESTORED_EVENT, restore)
  }, [name])

  function dismissSoftKeyboard() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()
  }

  function openPicker() {
    dismissSoftKeyboard()
    const parsed = parseTimeValue(value)
    setDraftHour(parsed.hour)
    setDraftMinute(parsed.minute)
    setOpen(true)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    openPicker()
  }

  function commitValue(nextValue: string) {
    setValue(nextValue)
    window.requestAnimationFrame(() => {
      inputRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
      inputRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function confirm() {
    commitValue(formatTimeValue(draftHour, draftMinute))
    setOpen(false)
  }

  function clear() {
    commitValue('')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dismissSoftKeyboard()
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true })
    })

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <input ref={inputRef} name={name} type="hidden" value={value} readOnly />
      <button className={`time-wheel-trigger ${value ? 'has-value' : ''}`} type="button" inputMode="none" onPointerDown={handlePointerDown} aria-haspopup="dialog">
        <Clock3 size={19} aria-hidden="true" />
        <span>{value || 'Selecionar horário'}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && createPortal(
        <div className="time-wheel-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false)
        }}>
          <section ref={dialogRef} className="time-wheel-dialog" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
            <header className="time-wheel-header">
              <div><span>Horário</span><h2>{label}</h2></div>
              <strong>{formatTimeValue(draftHour, draftMinute)}</strong>
            </header>

            <div className="time-wheel-body">
              <div className="time-wheel-selection" aria-hidden="true" />
              <WheelColumn label="Horas" values={hours} selected={draftHour} onChange={setDraftHour} />
              <span className="time-wheel-separator" aria-hidden="true">:</span>
              <WheelColumn label="Minutos" values={minutes} selected={draftMinute} onChange={setDraftMinute} />
            </div>

            <footer className="time-wheel-actions">
              <button type="button" className="time-wheel-clear" onClick={clear}>Limpar</button>
              <button type="button" className="time-wheel-cancel" onClick={() => setOpen(false)}><X size={18} />Cancelar</button>
              <button type="button" className="time-wheel-confirm" onClick={confirm}><Check size={18} />Confirmar</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}

function WheelColumn({ label, values, selected, onChange }: {
  label: string
  values: number[]
  selected: number
  onChange: (value: number) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const initialIndexRef = useRef(Math.max(0, values.indexOf(selected)))
  const lastCommittedIndexRef = useRef(initialIndexRef.current)
  const scrollCommitRef = useRef<number | null>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: initialIndexRef.current * ITEM_HEIGHT, behavior: 'instant' as ScrollBehavior })
  }, [])

  useEffect(() => () => {
    if (scrollCommitRef.current !== null) window.clearTimeout(scrollCommitRef.current)
  }, [])

  function commitScrolledValue() {
    scrollCommitRef.current = null
    const list = listRef.current
    if (!list) return

    const index = wheelIndexFromScroll(list.scrollTop, ITEM_HEIGHT, values.length)
    if (index === lastCommittedIndexRef.current) return

    lastCommittedIndexRef.current = index
    onChange(values[index])
  }

  function scheduleScrollCommit() {
    if (scrollCommitRef.current !== null) window.clearTimeout(scrollCommitRef.current)
    scrollCommitRef.current = window.setTimeout(commitScrolledValue, 120)
  }

  function select(index: number, value: number) {
    if (index !== lastCommittedIndexRef.current) {
      lastCommittedIndexRef.current = index
      onChange(value)
    }
    listRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
  }

  return (
    <div className="time-wheel-column-wrap">
      <span>{label}</span>
      <div className="time-wheel-column" ref={listRef} role="listbox" aria-label={label} onScroll={scheduleScrollCommit}>
        <div className="time-wheel-spacer" aria-hidden="true" />
        {values.map((item, index) => (
          <button
            type="button"
            role="option"
            aria-selected={item === selected}
            className={item === selected ? 'is-selected' : ''}
            key={item}
            onClick={() => select(index, item)}
          >
            {String(item).padStart(2, '0')}
          </button>
        ))}
        <div className="time-wheel-spacer" aria-hidden="true" />
      </div>
    </div>
  )
}
