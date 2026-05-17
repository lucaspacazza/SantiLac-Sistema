import { ClipboardList, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BatchStatusBadge } from '../components/BatchStatusBadge'
import { Modal } from '../components/Modal'
import { industrialApi } from '../services/industrialApi'
import type { MilkEntry, ProductionBatch } from '../types/industrial'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type Props = {
  onStatus: (status: 'loading' | 'live' | 'error', text: string) => void
  onOpenBatch: (id: number) => void
}

export function ProducaoDiariaPage({ onStatus, onOpenBatch }: Props) {
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formDate, setFormDate] = useState(today())
  const [formLiters, setFormLiters] = useState(0)
  const [formMilkId, setFormMilkId] = useState('')
  const [formNotes, setFormNotes] = useState('')

  async function load() {
    onStatus('loading', 'Carregando lotes de produção...')
    try {
      const [batchResult, milkResult] = await Promise.all([
        industrialApi.batches.list(),
        industrialApi.milkEntries.list(),
      ])
      setBatches(batchResult.items)
      setMilkEntries(milkResult.items)
      onStatus('live', `${batchResult.items.length} lote(s) carregado(s).`)
    } catch (error) {
      setBatches([])
      onStatus('error', error instanceof Error ? error.message : 'Erro ao carregar lotes.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setFormDate(today())
    setFormLiters(0)
    setFormMilkId('')
    setFormNotes('')
    setFormOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const batch = await industrialApi.batches.create({
        batch_date: formDate,
        liters_processed: Number(formLiters),
        milk_entry_id: formMilkId ? Number(formMilkId) : undefined,
        notes: formNotes || undefined,
      })
      setFormOpen(false)
      await load()
      onOpenBatch(batch.id)
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao criar lote.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="module-grid">
      <div className="toolbar">
        <span style={{ flex: 1, color: 'var(--body)', fontSize: 13 }}>
          Lotes de produção diária com status, litragem e itens apontados.
        </span>
        <button className="btn primary" type="button" onClick={openCreate}>
          <Plus size={16} />
          Novo lote
        </button>
      </div>

      <section className="table-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Data</th>
                <th style={{ width: 130 }}>Código</th>
                <th style={{ width: 130 }}>Litragem</th>
                <th style={{ width: 110 }}>Status</th>
                <th>Observação</th>
                <th style={{ width: 80 }}>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                      <ClipboardList size={16} />
                      Nenhum lote de produção registrado.
                    </span>
                  </td>
                </tr>
              ) : batches.map((batch) => (
                <tr key={batch.id}>
                  <td><strong>{formatDate(batch.batch_date)}</strong></td>
                  <td>
                    <button
                      className="table-link"
                      type="button"
                      onClick={() => onOpenBatch(batch.id)}
                    >
                      {batch.batch_code}
                    </button>
                  </td>
                  <td>{batch.liters_processed.toLocaleString('pt-BR')} L</td>
                  <td><BatchStatusBadge status={batch.status} /></td>
                  <td>{batch.notes ?? '--'}</td>
                  <td>{formatDate(batch.created_at.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <Modal title="Novo lote de produção" onClose={() => setFormOpen(false)}>
          <form className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Data do lote
              </label>
              <input
                type="date"
                required
                style={{ width: '100%' }}
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
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
                value={formLiters}
                onChange={(e) => setFormLiters(Number(e.target.value))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Entrada de leite (opcional)
              </label>
              <select
                style={{ width: '100%', minHeight: 38, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', background: 'var(--input)', color: 'var(--text)', padding: '0 10px' }}
                value={formMilkId}
                onChange={(e) => setFormMilkId(e.target.value)}
              >
                <option value="">— sem vínculo —</option>
                {milkEntries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {formatDate(entry.entry_date)} — {entry.liters_received.toLocaleString('pt-BR')} L recebido
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Observação
              </label>
              <textarea
                style={{ width: '100%' }}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? 'Criando...' : 'Criar lote'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
