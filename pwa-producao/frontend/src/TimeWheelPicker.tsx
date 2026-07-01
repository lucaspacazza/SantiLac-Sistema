import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Clock3, X } from 'lucide-react'
import { formatTimeValue, parseTimeValue } from './dateTime'

const ITEM_HEIGHT = 52
const hours = Array.from({ length: 24 }, (_, index) => index)
const minutes = Array.from({ length: 60 }, (_, index) => index)

export function TimeWheelInput({ name, label, defaultValue = '' }: {
  name: string
  label: string
  defaultValue?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [draftHour, setDraftHour] = useState(0)
  const [draftMinute, setDraftMinute] = useState(0)

  function openPicker() {
    const parsed = parseTimeValue(value)
    setDraftHour(parsed.hour)
    setDraftMinute(parsed.minute)
    setOpen(true)
  }

  function confirm() {
    setValue(formatTimeValue(draftHour, draftMinute))
    setOpen(false)
  }

  function clear() {
    setValue('')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <input name={name} type="hidden" value={value} readOnly />
      <button className={`time-wheel-trigger ${value ? 'has-value' : ''}`} type="button" onClick={openPicker} aria-haspopup="dialog">
        <Clock3 size={19} aria-hidden="true" />
        <span>{value || 'Selecionar horário'}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && createPortal(
        <div className="time-wheel-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false)
        }}>
          <section className="time-wheel-dialog" role="dialog" aria-modal="true" aria-label={label}>
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
  const frameRef = useRef<number | null>(null)
  const selectedIndex = useMemo(() => Math.max(0, values.indexOf(selected)), [selected, values])

  useEffect(() => {
    listRef.current?.scrollTo({ top: selectedIndex * ITEM_HEIGHT, behavior: 'instant' as ScrollBehavior })
  }, [selectedIndex])

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  function updateFromScroll() {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const list = listRef.current
      if (!list) return
      const index = Math.max(0, Math.min(values.length - 1, Math.round(list.scrollTop / ITEM_HEIGHT)))
      onChange(values[index])
    })
  }

  function select(index: number, value: number) {
    onChange(value)
    listRef.current?.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
  }

  return (
    <div className="time-wheel-column-wrap">
      <span>{label}</span>
      <div className="time-wheel-column" ref={listRef} role="listbox" aria-label={label} onScroll={updateFromScroll}>
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
