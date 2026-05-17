import { Edit2, Milk, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { industrialApi } from '../services/industrialApi'
import type { MilkEntry } from '../types/industrial'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type FormPayload = {
  entry_date: string
  liters_received: number
  liters_processed: number
  liters_to_cream: number
  liters_surplus: number
  notes: string
}

const emptyForm: FormPayload = {
  entry_date: today(),
  liters_received: 0,
  liters_processed: 0,
  liters_to_cream: 0,
  liters_surplus: 0,
  notes: '',
}

type Props = {
  onStatus: (status: 'loading' | 'live' | 'error', text: string) => void
}

export function RecebimentoLeitePage({ onStatus }: Props) {
  const [entries, setEntries] = useState<MilkEntry[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MilkEntry | null>(null)
  const [form, setForm] = useState<FormPayload>(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    onStatus('loading', 'Carregando entradas de leite...')
    try {
      const result = await industrialApi.milkEntries.list()
      setEntries(result.items)
      onStatus('live', `${result.items.length} entrada(s) carregada(s).`)
    } catch (error) {
      setEntries([])
      onStatus('error', error instanceof Error ? error.message : 'Erro ao carregar entradas.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditTarget(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(entry: MilkEntry) {
    setEditTarget(entry)
    setForm({
      entry_date: entry.entry_date,
      liters_received: entry.liters_received,
      liters_processed: entry.liters_processed,
      liters_to_cream: entry.liters_to_cream,
      liters_surplus: entry.liters_surplus,
      notes: entry.notes ?? '',
    })
    setFormOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        entry_date: form.entry_date,
        liters_received: Number(form.liters_received),
        liters_processed: Number(form.liters_processed),
        liters_to_cream: Number(form.liters_to_cream),
        liters_surplus: Number(form.liters_surplus),
        notes: form.notes || undefined,
      }
      if (editTarget) {
        await industrialApi.milkEntries.update(editTarget.id, payload)
      } else {
        await industrialApi.milkEntries.create(payload)
      }
      setFormOpen(false)
      await load()
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="module-grid">
      <div className="toolbar">
        <span style={{ flex: 1, color: 'var(--body)', fontSize: 13 }}>
          Entradas de leite recebidas e processadas por dia.
        </span>
        <button className="btn primary" type="button" onClick={openCreate}>
          <Plus size={16} />
          Nova entrada
        </button>
      </div>

      <section className="table-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Data</th>
                <th style={{ width: 120 }}>Recebido (L)</th>
                <th style={{ width: 120 }}>Processado (L)</th>
                <th style={{ width: 110 }}>Creme (L)</th>
                <th style={{ width: 100 }}>Sobra (L)</th>
                <th style={{ width: 120 }}>Saldo (L)</th>
                <th>Observação</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                      <Milk size={16} />
                      Nenhuma entrada de leite registrada.
                    </span>
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{formatDate(entry.entry_date)}</strong></td>
                  <td>{entry.liters_received.toLocaleString('pt-BR')}</td>
                  <td>{entry.liters_processed.toLocaleString('pt-BR')}</td>
                  <td>{entry.liters_to_cream.toLocaleString('pt-BR')}</td>
                  <td>{entry.liters_surplus.toLocaleString('pt-BR')}</td>
                  <td>
                    <strong style={{ color: entry.milk_balance >= 0 ? 'var(--good)' : 'var(--danger)' }}>
                      {entry.milk_balance.toLocaleString('pt-BR')}
                    </strong>
                  </td>
                  <td>{entry.notes ?? '--'}</td>
                  <td>
                    <button
                      className="icon-btn"
                      type="button"
                      title="Editar"
                      onClick={() => openEdit(entry)}
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <Modal
          title={editTarget ? 'Editar entrada de leite' : 'Nova entrada de leite'}
          onClose={() => setFormOpen(false)}
        >
          <form className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Data
              </label>
              <input
                type="date"
                required
                style={{ width: '100%' }}
                value={form.entry_date}
                onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Litros recebidos
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                required
                style={{ width: '100%' }}
                value={form.liters_received}
                onChange={(e) => setForm((f) => ({ ...f, liters_received: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Litros processados
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                required
                style={{ width: '100%' }}
                value={form.liters_processed}
                onChange={(e) => setForm((f) => ({ ...f, liters_processed: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Litros para creme
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                style={{ width: '100%' }}
                value={form.liters_to_cream}
                onChange={(e) => setForm((f) => ({ ...f, liters_to_cream: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Sobra de leite (L)
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                style={{ width: '100%' }}
                value={form.liters_surplus}
                onChange={(e) => setForm((f) => ({ ...f, liters_surplus: Number(e.target.value) }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Observação
              </label>
              <textarea
                style={{ width: '100%' }}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </button>
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
