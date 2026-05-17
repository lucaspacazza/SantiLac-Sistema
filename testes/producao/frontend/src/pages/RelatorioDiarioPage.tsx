import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BatchStatusBadge } from '../components/BatchStatusBadge'
import { industrialApi } from '../services/industrialApi'
import type { DailyReportBatch } from '../types/industrial'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function monthStart(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

type Props = {
  onStatus: (status: 'loading' | 'live' | 'error', text: string) => void
}

export function RelatorioDiarioPage({ onStatus }: Props) {
  const [batches, setBatches] = useState<DailyReportBatch[]>([])
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    onStatus('loading', 'Carregando relatório...')
    try {
      const result = await industrialApi.reports.dailyProduction({
        date_from: dateFrom,
        date_to: dateTo,
      })
      setBatches(result.items)
      onStatus('live', `${result.items.length} lote(s) no período.`)
    } catch (error) {
      setBatches([])
      onStatus('error', error instanceof Error ? error.message : 'Erro ao carregar relatório.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const totalKg = batches.reduce((sum, b) => sum + (b.total_produced_kg ?? 0), 0)
  const totalLiters = batches.reduce((sum, b) => sum + b.liters_processed, 0)
  const avgYield = totalKg > 0 && totalLiters > 0
    ? (totalLiters / totalKg).toFixed(4)
    : null

  return (
    <section className="module-grid">
      <div className="date-filter">
        <label>De</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <label>até</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <button className="btn secondary" type="button" onClick={() => void load()}>
          Filtrar
        </button>
      </div>

      {!loading && batches.length > 0 && (
        <div className="report-summary">
          <div className="kpi-card">
            <span>Lotes no período</span>
            <strong>{batches.length}</strong>
            <small>lotes</small>
          </div>
          <div className="kpi-card">
            <span>Total produzido</span>
            <strong>{totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg</strong>
            <small>soma dos lotes fechados</small>
          </div>
          <div className="kpi-card">
            <span>Rendimento médio</span>
            <strong>{avgYield != null ? `${avgYield} L/kg` : '—'}</strong>
            <small>leite / queijo</small>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--body)', fontSize: 14 }}>Carregando...</p>
      ) : batches.length === 0 ? (
        <section className="panel detail-empty">
          <div className="panel-title">
            <BarChart3 size={16} />
            <h2>Sem dados no período</h2>
          </div>
          <p className="empty-copy">
            Nenhum lote encontrado entre {formatDate(dateFrom)} e {formatDate(dateTo)}.
          </p>
        </section>
      ) : (
        <section className="table-card">
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 380px)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th style={{ width: 100 }}>Data</th>
                  <th style={{ width: 140 }}>Código</th>
                  <th style={{ width: 120 }}>Litragem</th>
                  <th style={{ width: 130 }}>Produzido (kg)</th>
                  <th style={{ width: 130 }}>Rendimento L/kg</th>
                  <th style={{ width: 110 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <>
                    <tr key={batch.id}>
                      <td>
                        {batch.items && batch.items.length > 0 && (
                          <button
                            className="icon-btn"
                            type="button"
                            title="Expandir itens"
                            style={{ width: 24, minHeight: 24 }}
                            onClick={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
                          >
                            {expandedId === batch.id
                              ? <ChevronDown size={13} />
                              : <ChevronRight size={13} />}
                          </button>
                        )}
                      </td>
                      <td><strong>{formatDate(batch.batch_date)}</strong></td>
                      <td>{batch.batch_code}</td>
                      <td>{batch.liters_processed.toLocaleString('pt-BR')} L</td>
                      <td>
                        {batch.total_produced_kg != null
                          ? batch.total_produced_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })
                          : '—'}
                      </td>
                      <td>
                        {batch.yield_liters_per_kg != null
                          ? batch.yield_liters_per_kg.toFixed(4)
                          : '—'}
                      </td>
                      <td>
                        <BatchStatusBadge
                          status={batch.status as 'draft' | 'closed' | 'reopened' | 'cancelled'}
                        />
                      </td>
                    </tr>
                    {expandedId === batch.id && batch.items && batch.items.length > 0 && (
                      batch.items.map((item) => (
                        <tr key={`item-${item.id}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td></td>
                          <td></td>
                          <td style={{ paddingLeft: 20, color: 'var(--muted)', fontSize: 12 }}>
                            {item.product?.name ?? `#${item.product_id}`}
                          </td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{item.production_type}</td>
                          <td style={{ color: 'var(--body)', fontSize: 12 }}>
                            {item.weight_kg.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
                          </td>
                          <td style={{ color: 'var(--body)', fontSize: 12 }}>
                            {item.pieces_count > 0 ? `${item.pieces_count} peças` : '—'}
                          </td>
                          <td></td>
                        </tr>
                      ))
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
