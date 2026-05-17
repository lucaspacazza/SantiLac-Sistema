import { ArrowLeft, Calculator, Lock, Package, Plus, Trash2, Unlock } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BatchStatusBadge } from '../components/BatchStatusBadge'
import { Modal } from '../components/Modal'
import { industrialApi } from '../services/industrialApi'
import type { IndustrialProduct, ProductionBatch } from '../types/industrial'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const PRODUCTION_TYPES = [
  { value: 'produced', label: 'Produzido' },
  { value: 'packed', label: 'Embalado' },
  { value: 'fractioned', label: 'Fracionado' },
  { value: 'returned', label: 'Retorno' },
  { value: 'loss', label: 'Perda' },
  { value: 'point', label: 'Pontas' },
  { value: 'adjustment', label: 'Ajuste' },
]

type Props = {
  batchId: number
  onStatus: (status: 'loading' | 'live' | 'error', text: string) => void
  onBack: () => void
}

export function LoteProducaoPage({ batchId, onStatus, onBack }: Props) {
  const [batch, setBatch] = useState<ProductionBatch | null>(null)
  const [products, setProducts] = useState<IndustrialProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [reopenFormOpen, setReopenFormOpen] = useState(false)
  const [operating, setOperating] = useState(false)
  const [itemProductId, setItemProductId] = useState('')
  const [itemType, setItemType] = useState('produced')
  const [itemPieces, setItemPieces] = useState(0)
  const [itemWeight, setItemWeight] = useState(0)
  const [itemNotes, setItemNotes] = useState('')
  const [reopenReason, setReopenReason] = useState('')

  const editable = batch?.status === 'draft' || batch?.status === 'reopened'

  async function load() {
    setLoading(true)
    onStatus('loading', 'Carregando lote...')
    try {
      const [batchResult, productsResult] = await Promise.all([
        industrialApi.batches.get(batchId),
        industrialApi.products.list({ active: true }),
      ])
      setBatch(batchResult)
      setProducts(productsResult.items)
      onStatus('live', `Lote ${batchResult.batch_code} carregado.`)
    } catch (error) {
      setBatch(null)
      onStatus('error', error instanceof Error ? error.message : 'Erro ao carregar lote.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [batchId])

  async function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!batch) return
    setOperating(true)
    try {
      await industrialApi.batches.addItem(batch.id, {
        product_id: Number(itemProductId),
        production_type: itemType,
        pieces_count: Number(itemPieces),
        weight_kg: Number(itemWeight),
        notes: itemNotes || undefined,
      })
      setItemFormOpen(false)
      setItemProductId('')
      setItemType('produced')
      setItemPieces(0)
      setItemWeight(0)
      setItemNotes('')
      await load()
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao adicionar item.')
    } finally {
      setOperating(false)
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!window.confirm('Remover este item do lote?')) return
    setOperating(true)
    try {
      await industrialApi.batches.deleteItem(itemId)
      await load()
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao remover item.')
    } finally {
      setOperating(false)
    }
  }

  async function handleRecalculate() {
    if (!batch) return
    setOperating(true)
    onStatus('loading', 'Recalculando...')
    try {
      const updated = await industrialApi.batches.recalculate(batch.id)
      setBatch(updated)
      onStatus('live', 'Recalculado com sucesso.')
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao recalcular.')
    } finally {
      setOperating(false)
    }
  }

  async function handleClose() {
    if (!batch) return
    if (!window.confirm('Fechar este lote? Isso gerará movimentações de estoque.')) return
    setOperating(true)
    onStatus('loading', 'Fechando lote...')
    try {
      const updated = await industrialApi.batches.close(batch.id)
      setBatch(updated)
      onStatus('live', 'Lote fechado. Estoque atualizado.')
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao fechar lote.')
    } finally {
      setOperating(false)
    }
  }

  async function handleReopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!batch || !reopenReason.trim()) return
    setOperating(true)
    onStatus('loading', 'Reabrindo lote...')
    try {
      const updated = await industrialApi.batches.reopen(batch.id, reopenReason.trim())
      setBatch(updated)
      setReopenFormOpen(false)
      setReopenReason('')
      onStatus('live', 'Lote reaberto. Movimentações de estoque removidas.')
    } catch (error) {
      onStatus('error', error instanceof Error ? error.message : 'Erro ao reabrir lote.')
    } finally {
      setOperating(false)
    }
  }

  if (loading) {
    return (
      <section className="detail-grid">
        <p style={{ color: 'var(--body)', fontSize: 14 }}>Carregando lote...</p>
      </section>
    )
  }

  if (!batch) {
    return (
      <section className="detail-grid">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>Lote não encontrado.</p>
      </section>
    )
  }

  const calc = batch.calculation
  const items = batch.items ?? []

  return (
    <section className="detail-grid">
      <div className="detail-title">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <span>Lote de produção</span>
          <h2>{batch.batch_code}</h2>
          <p>{formatDate(batch.batch_date)} — {batch.liters_processed.toLocaleString('pt-BR')} L</p>
        </div>
        <div className="detail-action" style={{ display: 'flex', gap: 8 }}>
          <BatchStatusBadge status={batch.status} />
          {editable && (
            <>
              <button
                className="btn secondary"
                type="button"
                disabled={operating}
                onClick={() => void handleRecalculate()}
              >
                <Calculator size={16} />
                Recalcular
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={operating || items.length === 0}
                onClick={() => void handleClose()}
              >
                <Lock size={16} />
                Fechar lote
              </button>
            </>
          )}
          {batch.status === 'closed' && (
            <button
              className="btn secondary"
              type="button"
              disabled={operating}
              onClick={() => setReopenFormOpen(true)}
            >
              <Unlock size={16} />
              Reabrir
            </button>
          )}
        </div>
      </div>

      {calc && (
        <div className="readonly-grid">
          <div className="readonly-card">
            <span>Total produzido</span>
            <strong>{calc.total_produced_kg.toLocaleString('pt-BR')} kg</strong>
          </div>
          <div className="readonly-card">
            <span>Rendimento (L/kg)</span>
            <strong>
              {calc.yield_liters_per_kg != null
                ? calc.yield_liters_per_kg.toFixed(4)
                : '—'}
            </strong>
          </div>
          <div className="readonly-card">
            <span>Rendimento (kg/L)</span>
            <strong>
              {calc.yield_kg_per_liter != null
                ? calc.yield_kg_per_liter.toFixed(6)
                : '—'}
            </strong>
          </div>
          <div className="readonly-card">
            <span>Peso médio/peça</span>
            <strong>
              {calc.average_piece_weight != null
                ? `${calc.average_piece_weight.toFixed(3)} kg`
                : '—'}
            </strong>
          </div>
        </div>
      )}

      <section className="panel">
        <div className="panel-title">
          <Package size={16} />
          <h2>Itens produzidos</h2>
          {editable && (
            <button
              className="btn primary"
              type="button"
              style={{ marginLeft: 'auto' }}
              onClick={() => setItemFormOpen(true)}
            >
              <Plus size={16} />
              Adicionar item
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="empty-copy">Nenhum item adicionado. Clique em "Adicionar item" para começar.</p>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 340 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ width: 110 }}>Tipo</th>
                  <th style={{ width: 90 }}>Peças</th>
                  <th style={{ width: 100 }}>Peso (kg)</th>
                  <th>Observação</th>
                  {editable && <th style={{ width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.product?.name ?? `Produto #${item.product_id}`}
                      </strong>
                    </td>
                    <td>
                      {PRODUCTION_TYPES.find((t) => t.value === item.production_type)?.label ?? item.production_type}
                    </td>
                    <td>{item.pieces_count.toLocaleString('pt-BR')}</td>
                    <td>{item.weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                    <td>{item.notes ?? '--'}</td>
                    {editable && (
                      <td>
                        <button
                          className="icon-btn"
                          type="button"
                          title="Remover item"
                          disabled={operating}
                          onClick={() => void handleDeleteItem(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {itemFormOpen && (
        <Modal title="Adicionar item ao lote" onClose={() => setItemFormOpen(false)}>
          <form className="form-grid" onSubmit={(e) => void handleAddItem(e)}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Produto
              </label>
              <select
                required
                style={{ width: '100%', minHeight: 38, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', background: 'var(--input)', color: 'var(--text)', padding: '0 10px' }}
                value={itemProductId}
                onChange={(e) => setItemProductId(e.target.value)}
              >
                <option value="">— selecione —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Tipo de apontamento
              </label>
              <select
                style={{ width: '100%', minHeight: 38, border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', background: 'var(--input)', color: 'var(--text)', padding: '0 10px' }}
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
              >
                {PRODUCTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Quantidade de peças
              </label>
              <input
                type="number"
                min="0"
                step="1"
                style={{ width: '100%' }}
                value={itemPieces}
                onChange={(e) => setItemPieces(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Peso (kg)
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                required
                style={{ width: '100%' }}
                value={itemWeight}
                onChange={(e) => setItemWeight(Number(e.target.value))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Observação
              </label>
              <textarea
                style={{ width: '100%' }}
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setItemFormOpen(false)}>
                Cancelar
              </button>
              <button className="btn primary" type="submit" disabled={operating || !itemProductId}>
                {operating ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {reopenFormOpen && (
        <Modal title="Reabrir lote" onClose={() => setReopenFormOpen(false)}>
          <form className="form-grid" onSubmit={(e) => void handleReopen(e)}>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: '0 0 10px', color: 'var(--body)', fontSize: 13 }}>
                Reabrir o lote remove as movimentações de estoque geradas no fechamento.
                Informe o motivo para registro de auditoria.
              </p>
              <label style={{ display: 'block', color: 'var(--body)', fontSize: 12, marginBottom: 4 }}>
                Motivo obrigatório
              </label>
              <textarea
                required
                style={{ width: '100%' }}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Descreva o motivo da reabertura..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setReopenFormOpen(false)}>
                Cancelar
              </button>
              <button className="btn danger" type="submit" disabled={operating || !reopenReason.trim()}>
                {operating ? 'Reabrindo...' : 'Confirmar reabertura'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
