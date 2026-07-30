import { useEffect, useState } from 'react'
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
  signDisplay: 'always',
})

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
  const classeVariacao = variacao === null || variacao === 0
    ? 'is-neutral'
    : variacao > 0 ? 'is-positive' : 'is-negative'

  return (
    <section className="dashboard-page" aria-label="Dashboard">
      <div className="dashboard-indicators" aria-label="Indicadores">
        <article className="dashboard-indicator">
          <span className="dashboard-indicator-label">Produtores</span>
          {produtores.carregando ? (
            <span className="dashboard-indicator-skeleton" aria-label="Carregando produtores" />
          ) : (
            <strong className="dashboard-indicator-value">
              {produtores.valor === null ? '—' : numero.format(produtores.valor)}
            </strong>
          )}
        </article>

        <article className="dashboard-indicator">
          <span className="dashboard-indicator-label">Leite recebido no mês</span>
          {leite.carregando ? (
            <span className="dashboard-indicator-skeleton" aria-label="Carregando evolução do leite" />
          ) : (
            <div className="dashboard-indicator-metric">
              <strong className="dashboard-indicator-value">
                {leite.valor === null ? '—' : numero.format(leite.valor.litros_mes_atual)}
                {leite.valor !== null && <small className="dashboard-indicator-unit"> L</small>}
              </strong>
              <span
                className={`dashboard-indicator-change ${classeVariacao}`}
                aria-label={variacao === null ? 'Comparativo indisponível' : `${percentual.format(variacao)} por cento em relação ao mês anterior`}
              >
                {variacao === null ? '—' : `${percentual.format(variacao)}%`}
              </span>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
