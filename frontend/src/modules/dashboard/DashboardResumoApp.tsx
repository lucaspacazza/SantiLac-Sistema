import { useEffect, useState, type ReactNode } from 'react'
import { leiteIndicadorApi, type LeiteIndicador } from './api/leiteIndicadorApi'
import { produtoresIndicadorApi } from './api/produtoresIndicadorApi'
import './dashboard.css'

type IndicadorState<T> = {
  carregando: boolean
  valor: T | null
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const percentual = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})
const agora = new Date()
const referenciaMensal = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
}).format(agora)
const referenciaCodigo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

export function DashboardResumoApp() {
  const [produtores, setProdutores] = useState<IndicadorState<number>>({ carregando: true, valor: null })
  const [leite, setLeite] = useState<IndicadorState<LeiteIndicador>>({ carregando: true, valor: null })

  useEffect(() => {
    const controller = new AbortController()

    void produtoresIndicadorApi.buscar({ signal: controller.signal })
      .then((resultado) => setProdutores({ carregando: false, valor: resultado.total }))
      .catch(() => {
        if (!controller.signal.aborted) setProdutores({ carregando: false, valor: null })
      })

    void leiteIndicadorApi.buscar({ signal: controller.signal })
      .then((resultado) => setLeite({ carregando: false, valor: resultado }))
      .catch(() => {
        if (!controller.signal.aborted) setLeite({ carregando: false, valor: null })
      })

    return () => controller.abort()
  }, [])

  const variacao = leite.valor?.variacao_percentual ?? null
  return (
    <div className="dashboard-module">
      <section className="dashboard-page" aria-labelledby="dashboard-title">
        <header className="dashboard-page-head">
          <h1 id="dashboard-title">Dashboard</h1>
          <time dateTime={referenciaCodigo}>{referenciaMensal}</time>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-section" aria-labelledby="dashboard-overview-title">
            <header className="dashboard-section-head">
              <h2 id="dashboard-overview-title">Visão geral</h2>
            </header>

            <div className="dashboard-grid">
              <IndicadorCard label="Produtores" loading={produtores.carregando} loadingLabel="Carregando produtores">
                <div className="dashboard-indicator-metric">
                  <strong className="dashboard-indicator-value">
                    {produtores.valor === null ? '—' : numero.format(produtores.valor)}
                  </strong>
                </div>
              </IndicadorCard>

              <IndicadorCard label="Leite recebido" loading={leite.carregando} loadingLabel="Carregando leite recebido">
                <div className="dashboard-indicator-metric">
                  <strong className="dashboard-indicator-value">
                    {leite.valor === null ? '—' : numero.format(leite.valor.litros_mes_atual)}
                    {leite.valor !== null && <small className="dashboard-indicator-unit"> L</small>}
                  </strong>
                  <span
                    className="dashboard-indicator-change"
                    aria-label={variacao === null ? 'Comparativo indisponível' : `${percentual.format(variacao)} por cento em relação ao mês anterior`}
                  >
                    {variacao === null ? '—' : `${percentual.format(variacao)}%`}
                    <small> mês anterior</small>
                  </span>
                </div>
              </IndicadorCard>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function IndicadorCard({ label, loading, loadingLabel, children }: {
  label: string
  loading: boolean
  loadingLabel: string
  children: ReactNode
}) {
  return (
    <article className="dashboard-indicator dashboard-grid-item-kpi">
      <span className="dashboard-indicator-label">{label}</span>
      {loading
        ? <span className="dashboard-indicator-skeleton" aria-label={loadingLabel} />
        : children}
    </article>
  )
}
