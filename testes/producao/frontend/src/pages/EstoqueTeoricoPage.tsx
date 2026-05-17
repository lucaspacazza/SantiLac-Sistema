import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Boxes } from 'lucide-react'
import { useEffect, useState } from 'react'
import { industrialApi } from '../services/industrialApi'
import type { StockItem, StockMovement } from '../types/industrial'

type Tab = 'saldo' | 'movimentos'

function formatDate(iso: string): string {
  if (!iso) return '--'
  const d = iso.slice(0, 10)
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const movementTypeLabels: Record<string, string> = {
  in: 'Entrada',
  out: 'Saída',
  adjustment: 'Ajuste',
  loss: 'Perda',
  return: 'Retorno',
  inventory_adjustment: 'Inv. físico',
}

type Props = {
  onStatus: (status: 'loading' | 'live' | 'error', text: string) => void
}

export function EstoqueTeoricoPage({ onStatus }: Props) {
  const [tab, setTab] = useState<Tab>('saldo')
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    onStatus('loading', 'Carregando estoque teórico...')
    try {
      const [stockResult, movResult] = await Promise.all([
        industrialApi.stock.balance(),
        industrialApi.stock.movements(),
      ])
      setStockItems(stockResult.items)
      setMovements(movResult.items)
      onStatus('live', `${stockResult.items.length} produto(s) no saldo teórico.`)
    } catch (error) {
      setStockItems([])
      setMovements([])
      onStatus('error', error instanceof Error ? error.message : 'Erro ao carregar estoque.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="module-grid">
      <div className="toolbar">
        <button
          className={`btn ${tab === 'saldo' ? 'primary' : 'secondary'}`}
          type="button"
          onClick={() => setTab('saldo')}
        >
          <Boxes size={16} />
          Saldo por produto
        </button>
        <button
          className={`btn ${tab === 'movimentos' ? 'primary' : 'secondary'}`}
          type="button"
          onClick={() => setTab('movimentos')}
        >
          <ArrowRightLeft size={16} />
          Movimentações
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--body)', fontSize: 14 }}>Carregando...</p>
      ) : tab === 'saldo' ? (
        <section className="table-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th style={{ width: 120 }}>Categoria</th>
                  <th style={{ width: 120 }}>Saldo (kg)</th>
                  <th style={{ width: 120 }}>Saldo (peças)</th>
                  <th style={{ width: 80 }}>Unidade</th>
                </tr>
              </thead>
              <tbody>
                {stockItems.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <span style={{ color: 'var(--muted)' }}>
                        Nenhum saldo teórico. Feche um lote de produção para gerar entradas.
                      </span>
                    </td>
                  </tr>
                ) : stockItems.map((item) => (
                  <tr key={item.product_id}>
                    <td><strong>{item.product?.name ?? `Produto #${item.product_id}`}</strong></td>
                    <td>{item.product?.category ?? '--'}</td>
                    <td>
                      <strong style={{ color: item.balance_kg > 0 ? 'var(--good)' : 'var(--muted)' }}>
                        {item.balance_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}
                      </strong>
                    </td>
                    <td>{item.balance_pieces.toLocaleString('pt-BR')}</td>
                    <td>{item.product?.unit ?? 'kg'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="table-card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Data</th>
                  <th style={{ width: 110 }}>Tipo</th>
                  <th style={{ width: 130 }}>Origem</th>
                  <th>Produto</th>
                  <th style={{ width: 110 }}>Quantidade (kg)</th>
                  <th style={{ width: 100 }}>Peças</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <span style={{ color: 'var(--muted)' }}>
                        Nenhuma movimentação registrada.
                      </span>
                    </td>
                  </tr>
                ) : movements.map((mov) => (
                  <tr key={mov.id}>
                    <td>{formatDate(mov.movement_date)}</td>
                    <td>
                      <MovTypeIcon type={mov.movement_type} />
                    </td>
                    <td style={{ color: 'var(--body)', fontSize: 12 }}>{mov.origin_type}</td>
                    <td><strong>{mov.product?.name ?? `#${mov.product_id}`}</strong></td>
                    <td>{mov.quantity_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                    <td>{mov.quantity_pieces.toLocaleString('pt-BR')}</td>
                    <td>{mov.notes ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}

function MovTypeIcon({ type }: { type: string }) {
  const icon = type === 'in'
    ? <ArrowDownToLine size={13} />
    : type === 'out'
      ? <ArrowUpFromLine size={13} />
      : <ArrowRightLeft size={13} />

  const cls = type === 'in' ? 'is-in' : type === 'out' ? 'is-out' : 'is-adjustment'

  return (
    <span className={`status-badge ${cls}`} style={{ fontSize: 11 }}>
      {icon}
      {movementTypeLabels[type] ?? type}
    </span>
  )
}
