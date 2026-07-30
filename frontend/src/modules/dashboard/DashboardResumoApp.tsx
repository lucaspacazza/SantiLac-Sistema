import { useEffect, useState, type ReactNode } from 'react'
import { combustivelApi, type CombustivelResumo } from '../combustivel/api/combustivelApi'
import { estoqueApi, type Overview as EstoqueOverview } from '../estoque/api/estoqueApi'
import { expedicaoApi } from '../expedicao/api/expedicaoApi'
import { pasteurizadorApi, type Overview as PasteurizadorOverview } from '../pasteurizador/api/pasteurizadorApi'
import { producaoApi, type Overview as ProducaoOverview } from '../producao/api/producaoApi'
import { qualidadeApi, type Overview as QualidadeOverview } from '../qualidade/api/qualidadeApi'
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
const percentualSimples = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatarDataHora(valor?: string | null) {
  if (!valor) return undefined

  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? undefined : dataHora.format(data)
}

const agora = new Date()
const referenciaMensal = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
}).format(agora)
const referenciaCodigo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

export function DashboardResumoApp() {
  const [produtores, setProdutores] = useState<IndicadorState<number>>({ carregando: true, valor: null })
  const [leite, setLeite] = useState<IndicadorState<LeiteIndicador>>({ carregando: true, valor: null })
  const [qualidade, setQualidade] = useState<IndicadorState<QualidadeOverview>>({ carregando: true, valor: null })
  const [estoque, setEstoque] = useState<IndicadorState<EstoqueOverview>>({ carregando: true, valor: null })
  const [expedicao, setExpedicao] = useState<IndicadorState<Awaited<ReturnType<typeof expedicaoApi.resumo>>>>({ carregando: true, valor: null })
  const [combustivel, setCombustivel] = useState<IndicadorState<CombustivelResumo>>({ carregando: true, valor: null })
  const [producao, setProducao] = useState<IndicadorState<ProducaoOverview>>({ carregando: true, valor: null })
  const [pasteurizador, setPasteurizador] = useState<IndicadorState<PasteurizadorOverview>>({ carregando: true, valor: null })

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

    loadIndependent(qualidadeApi.overview(), setQualidade, controller.signal)
    loadIndependent(estoqueApi.overview(), setEstoque, controller.signal)
    loadIndependent(expedicaoApi.resumo(), setExpedicao, controller.signal)
    loadIndependent(combustivelApi.resumo(), setCombustivel, controller.signal)
    loadIndependent(producaoApi.overview(), setProducao, controller.signal)
    loadIndependent(pasteurizadorApi.overview(), setPasteurizador, controller.signal)

    return () => controller.abort()
  }, [])

  const variacao = leite.valor?.variacao_percentual ?? null
  const pendenciasProducao = producao.valor
    ? producao.valor.totais.ops_aguardando_formato + producao.valor.totais.rascunhos
    : null
  const ultimaColeta = pasteurizador.valor?.ultima_coleta ?? null
  const statusPasteurizador = ultimaColeta
    ? ultimaColeta.status === 'processada' ? 'Processada' : ultimaColeta.status === 'erro' ? 'Erro' : 'Pendente'
    : null

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

              <IndicadorCard label="Sem análise" loading={qualidade.carregando} loadingLabel="Carregando qualidade">
                <ValorIndicador valor={qualidade.valor?.produtores_sem_analise ?? null} detalhe="produtores" />
              </IndicadorCard>

              <IndicadorCard label="Estoque crítico" loading={estoque.carregando} loadingLabel="Carregando estoque">
                <ValorIndicador valor={estoque.valor?.totais.abaixo_minimo ?? null} detalhe="itens" />
              </IndicadorCard>

              <IndicadorCard label="Ordens abertas" loading={expedicao.carregando} loadingLabel="Carregando expedição">
                <ValorIndicador valor={expedicao.valor?.totais.ordens_abertas ?? null} detalhe="expedição" />
              </IndicadorCard>

              <IndicadorCard label="Combustível" loading={combustivel.carregando} loadingLabel="Carregando combustível">
                <ValorIndicador
                  valor={combustivel.valor?.estoque_atual_litros ?? null}
                  unidade="L"
                  detalhe={combustivel.valor ? `${percentualSimples.format(combustivel.valor.porcentagem)}% do tanque` : undefined}
                />
              </IndicadorCard>

              <IndicadorCard label="Pendências de produção" loading={producao.carregando} loadingLabel="Carregando produção">
                <ValorIndicador valor={pendenciasProducao} detalhe="registros" />
              </IndicadorCard>

              <IndicadorCard label="Pasteurizador" loading={pasteurizador.carregando} loadingLabel="Carregando pasteurizador">
                <ValorIndicador
                  valor={statusPasteurizador}
                  detalhe={formatarDataHora(ultimaColeta?.coletado_em)}
                  textual
                />
              </IndicadorCard>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function loadIndependent<T>(
  request: Promise<T>,
  setState: (state: IndicadorState<T>) => void,
  signal: AbortSignal,
) {
  void request
    .then((valor) => {
      if (!signal.aborted) setState({ carregando: false, valor })
    })
    .catch(() => {
      if (!signal.aborted) setState({ carregando: false, valor: null })
    })
}

function ValorIndicador({ valor, unidade, detalhe, textual = false }: {
  valor: number | string | null
  unidade?: string
  detalhe?: string
  textual?: boolean
}) {
  const valorFormatado = typeof valor === 'number' ? numero.format(valor) : valor ?? '—'

  return (
    <div className="dashboard-indicator-metric">
      <strong className={`dashboard-indicator-value${textual ? ' is-textual' : ''}`}>
        {valorFormatado}
        {valor !== null && unidade ? <small className="dashboard-indicator-unit"> {unidade}</small> : null}
      </strong>
      {detalhe ? <span className="dashboard-indicator-detail">{detalhe}</span> : null}
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
