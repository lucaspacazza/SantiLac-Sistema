import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  MapPin,
  Milk,
  Minus,
  Route,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { relatoriosApi } from '../../api/relatoriosApi'
import {
  qualidadeApi,
  type MilkMonthlyPoint,
  type MilkTrend,
  type ProducerDetailResponse,
  type ProducerTrend,
  type Produtor,
  type QualityIndicatorComparison,
  type QualityMonthlyPoint,
} from '../../api/qualidadeApi'
import { formatAnalysisMetric, normalizeAnalysisValue, resolveMetricStatus, type AnalysisMetricField } from '../../shared/analysisMetrics'
import { ExportFormatMenu, type ExportFormat } from '../../shared/ExportFormatMenu'
import { formatDate } from '../../shared/formatters'

type DetalheProdutorProps = {
  codigo: string
  produtorInicial: Produtor | null
  reloadKey: number
  onRefresh: () => void
  onBack: () => void
}

type MetricKey = 'ccs' | 'ufc' | 'gordura' | 'proteina' | 'lactose' | 'solidos_totais'

type MetricDefinition = {
  key: MetricKey
  label: string
  field: AnalysisMetricField
  unit: string
  favorable: string
}

const METRICS: MetricDefinition[] = [
  { key: 'ccs', label: 'CCS', field: 'CCS', unit: 'mil/mL', favorable: 'Quanto menor, melhor' },
  { key: 'ufc', label: 'UFC', field: 'UFC', unit: 'mil/mL', favorable: 'Quanto menor, melhor' },
  { key: 'gordura', label: 'Gordura', field: 'GORD', unit: '%', favorable: 'Meta mínima: 3,50%' },
  { key: 'proteina', label: 'Proteína', field: 'PROT', unit: '%', favorable: 'Meta mínima: 3,20%' },
  { key: 'lactose', label: 'Lactose', field: 'LACT', unit: '%', favorable: 'Meta mínima: 4,50%' },
  { key: 'solidos_totais', label: 'Sólidos totais', field: 'SOL', unit: '%', favorable: 'Meta mínima: 12,20%' },
]

const litersFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const sanitaryFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const decimalFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const compactNumberFormat = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export function DetalheProdutor({ codigo, produtorInicial, reloadKey, onRefresh, onBack }: DetalheProdutorProps) {
  const [detail, setDetail] = useState<ProducerDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ codigo: string; message: string } | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportRequestRef = useRef(0)
  const loadErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)

    void qualidadeApi.produtor(codigo)
      .then((response) => {
        if (!active) return
        setDetail(response)
      })
      .catch((error) => {
        if (!active) return
        setLoadError({
          codigo,
          message: error instanceof Error ? error.message : 'Não foi possível carregar o painel do produtor.',
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [codigo, reloadKey, retryKey])

  useEffect(() => {
    exportRequestRef.current += 1
    setExportingFormat(null)
    setExportMessage(null)
    setExportError(null)
  }, [codigo])

  const loadedDetail = detail?.produtor.codigo === codigo ? detail : null
  const matchingInitialProducer = produtorInicial?.codigo === codigo ? produtorInicial : null
  const currentLoadError = loadError?.codigo === codigo ? loadError.message : null
  const waitingForCurrentProducer = loading || (!loadedDetail && currentLoadError === null)
  const dashboard = loadedDetail?.dashboard ?? null
  const qualityIndicators = useMemo(
    () => Object.values(dashboard?.qualidade.indicadores ?? {}).sort((left, right) => statusPriority(left.situacao) - statusPriority(right.situacao)),
    [dashboard],
  )

  useEffect(() => {
    if (currentLoadError && !loadedDetail) {
      loadErrorRef.current?.focus()
    }
  }, [currentLoadError, loadedDetail])

  if (!loadedDetail && waitingForCurrentProducer) {
    return (
      <section
        className="detail-page producer-detail-loading"
        aria-label={matchingInitialProducer ? `Carregando painel de ${matchingInitialProducer.nome}` : 'Carregando painel do produtor'}
        aria-live="polite"
        aria-busy="true"
      >
        <div className="detail-loading-bar" />
        <div className="detail-loading-hero" />
        <div className="detail-loading-grid">
          <div /><div /><div /><div />
        </div>
      </section>
    )
  }

  if (!loadedDetail) {
    return (
      <section className="detail-page">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div ref={loadErrorRef} className="empty-state detail-load-error" role="alert" aria-live="assertive" tabIndex={-1}>
          <CircleAlert size={22} />
          <div>
            <strong>Não foi possível carregar o produtor</strong>
            <p>{currentLoadError ?? 'Não foi possível localizar os dados deste produtor.'}</p>
          </div>
          <button className="btn secondary" type="button" onClick={() => setRetryKey((current) => current + 1)}>
            Tentar novamente
          </button>
        </div>
      </section>
    )
  }

  const produtor = loadedDetail.produtor
  const analysis = loadedDetail.ultima_analise

  async function handleExport(format: ExportFormat) {
    if (!produtor) return

    const defaultMonth = analysis?.data ? toMonthYear(analysis.data.slice(0, 7)) : toMonthYear(currentMonthInSaoPaulo())
    const month = window.prompt('Mês de referência para exportação (MM/AAAA)', defaultMonth)
    if (month === null) return

    const normalizedMonth = monthYearToApi(month)
    if (!normalizedMonth) {
      setExportMessage(null)
      setExportError('Informe o mês no formato MM/AAAA.')
      return
    }

    setExportingFormat(format)
    setExportMessage(null)
    setExportError(null)
    const requestId = ++exportRequestRef.current

    try {
      const result = format === 'pdf'
        ? await relatoriosApi.exportarProdutorAnalisesPdf(produtor.codigo, normalizedMonth)
        : await relatoriosApi.exportarProdutorAnalises(produtor.codigo, normalizedMonth)
      if (requestId === exportRequestRef.current) {
        setExportMessage(`Download iniciado: ${result.arquivo}`)
      }
    } catch (error) {
      if (requestId === exportRequestRef.current) {
        setExportError(error instanceof Error ? error.message : 'Falha ao gerar exportação individual.')
      }
    } finally {
      if (requestId === exportRequestRef.current) {
        setExportingFormat(null)
      }
    }
  }

  const milkData = dashboard?.leite
  const qualityData = dashboard?.qualidade
  const periodCopy = qualityData?.periodo_atual && qualityData.comparados > 0
    ? `${formatPeriod(qualityData.periodo_atual)} comparado a ${formatPeriod(qualityData.periodo_anterior)}`
    : qualityData?.periodo_atual
      ? `Média de ${formatPeriod(qualityData.periodo_atual)}; sem mês anterior comparável`
      : 'Aguardando um segundo período para comparar'
  const milkReferenceCopy = milkData?.periodo_parcial && milkData.dia_comparacao && milkData.periodo_anterior
    ? `Até o dia ${milkData.dia_comparacao}; comparação com o mesmo intervalo de ${formatPeriod(milkData.periodo_anterior)}`
    : 'Total consolidado do mês de referência'

  return (
    <section className="detail-page producer-detail-page" aria-busy={loading}>
      <div className="detail-actions producer-detail-actions">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="producer-detail-primary-actions">
          <button className="btn secondary" type="button" onClick={onRefresh}>
            <RefreshCcw size={16} />
            Atualizar
          </button>
          <ExportFormatMenu isExporting={exportingFormat !== null} onExport={handleExport} />
        </div>
      </div>

      {(exportMessage || exportError || currentLoadError) && (
        <section className={`status-line ${exportError || currentLoadError ? 'is-error' : 'is-live'}`} aria-live="polite">
          <span className="status-dot" />
          <span>{exportError ?? currentLoadError ?? exportMessage}</span>
          {currentLoadError && (
            <button className="status-retry" type="button" onClick={() => setRetryKey((current) => current + 1)}>
              Tentar novamente
            </button>
          )}
        </section>
      )}

      <article className="producer-detail-hero">
        <div className="producer-detail-identity">
          <div className="producer-detail-title-row">
            <div>
              <span className="eyebrow">Produtor {produtor.codigo}</span>
              <h2>{produtor.nome}</h2>
            </div>
            <span className={`producer-status-badge ${produtor.ativo ? 'is-active' : 'is-inactive'}`}>
              <span />
              {produtor.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div className="producer-detail-meta">
            <span><MapPin size={15} />{produtor.cidade || 'Cidade não informada'}</span>
            <span><Route size={15} />{produtor.rota || 'Rota não informada'}</span>
            <span><CalendarDays size={15} />Última análise: {formatDate(analysis?.data)}</span>
          </div>
        </div>

        <div className={`producer-quality-callout is-${trendTone(qualityData?.situacao ?? 'sem_comparacao')}`}>
          <span>Evolução da qualidade</span>
          <strong>
            <TrendIcon status={qualityData?.situacao ?? 'sem_comparacao'} />
            {qualityTrendLabel(qualityData?.situacao ?? 'sem_comparacao')}
          </strong>
          <small>{periodCopy}</small>
        </div>
      </article>

      <section className="producer-kpi-grid" aria-label="Indicadores principais do produtor">
        <KpiCard
          icon={<Milk size={19} />}
          label={`${milkData?.periodo_parcial && milkData.dia_comparacao ? `Leite até o dia ${milkData.dia_comparacao} em` : 'Leite em'} ${formatPeriod(milkData?.periodo_atual)}`}
          value={milkData?.atual_litros !== null && milkData?.atual_litros !== undefined
            ? `${litersFormat.format(milkData.atual_litros)} L`
            : '--'}
          detail={milkData?.coletas_atual
            ? `${milkData.coletas_atual} coleta(s) em ${milkData.dias_coleta_atual} dia(s). ${milkReferenceCopy}`
            : 'Sem coletas no período'}
          footer={<MilkDelta data={milkData} />}
        />
        <KpiCard
          icon={<CheckCircle2 size={19} />}
          label="Qualidade no período"
          value={qualityTrendLabel(qualityData?.situacao ?? 'sem_comparacao')}
          detail={qualityData?.comparados ? `${qualityData.comparados} indicadores comparados` : 'Sem base mensal anterior'}
          footer={qualityData?.comparados ? (
            <span className="kpi-breakdown">
              <b className="is-positive">{qualityData.melhoraram} melhores</b>
              <b>{qualityData.estaveis} estáveis</b>
              <b className="is-negative">{qualityData.pioraram} piores</b>
            </span>
          ) : null}
        />
        <KpiCard
          icon={<FlaskConical size={19} />}
          label="Análises registradas"
          value={String(loadedDetail.resumo.total_analises)}
          detail={`Última em ${formatDate(loadedDetail.resumo.ultima_analise ?? analysis?.data)}`}
          footer={<span className="kpi-context">Histórico laboratorial consolidado</span>}
        />
        <KpiCard
          icon={<Activity size={19} />}
          label="Média por coleta"
          value={milkData?.media_por_coleta !== null && milkData?.media_por_coleta !== undefined
            ? `${litersFormat.format(milkData.media_por_coleta)} L`
            : '--'}
          detail={`Última coleta: ${formatDate(milkData?.ultima_coleta)}`}
          footer={<span className="kpi-context">Média do mês mais recente com dados</span>}
        />
      </section>

      <section className="producer-overview-grid">
        <article className="producer-panel producer-volume-panel">
          <PanelHeader
            eyebrow="Produção"
            title="Evolução mensal do leite"
            copy={milkData?.periodo_parcial
              ? `Volume consolidado das coletas válidas. O último ponto é parcial até o dia ${milkData.dia_comparacao}; somente a variação do KPI compara intervalos equivalentes.`
              : 'Volume consolidado das coletas válidas nos últimos 12 meses.'}
          />
          <MilkTrendChart
            points={milkData?.serie_mensal ?? []}
            partialPeriod={milkData?.periodo_parcial ? milkData.periodo_atual : null}
            partialDay={milkData?.dia_comparacao ?? null}
          />
        </article>

        <article className="producer-panel producer-diagnosis-panel">
          <PanelHeader
            eyebrow="Diagnóstico"
            title={qualityDiagnosisTitle(qualityData?.situacao ?? 'sem_comparacao')}
            copy={qualityDiagnosisCopy(qualityData)}
          />
          {qualityIndicators.length > 0 ? (
            <div className="quality-evidence-list">
              {qualityIndicators.map((indicator) => (
                <QualityEvidence key={indicator.codigo} indicator={indicator} />
              ))}
            </div>
          ) : (
            <EmptyPanel copy="São necessários dados no mês atual e no anterior para explicar a tendência." />
          )}
        </article>
      </section>

      <section className="producer-section-heading">
        <div>
          <span className="eyebrow">Indicadores de qualidade</span>
          <h2>Média mensal e direção da mudança</h2>
        </div>
        <p>As setas consideram a regra de cada indicador: CCS e UFC melhoram quando caem; composição melhora quando sobe.</p>
      </section>

      <section className="producer-metric-grid" aria-label="Comparação dos indicadores de qualidade">
        {METRICS.map((metric) => (
          <MetricComparisonCard
            key={metric.key}
            metric={metric}
            currentValue={qualityData?.media_atual?.[metric.key] ?? null}
            previousValue={qualityData?.media_anterior?.[metric.key] ?? null}
            comparison={qualityData?.indicadores[metric.key] ?? null}
            series={qualityData?.serie_mensal ?? []}
          />
        ))}
      </section>

      <article className="producer-panel producer-analysis-history">
        <PanelHeader
          eyebrow="Histórico laboratorial"
          title="Análises recentes"
          copy="Valores completos, do registro mais recente para o mais antigo."
        />
        {loadedDetail.analises_recentes.length ? (
          <div className="producer-analysis-table-wrap" role="region" aria-label="Tabela rolável de análises recentes" tabIndex={0}>
            <table className="data-table producer-analysis-table" aria-label="Análises recentes do produtor">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>CCS (mil/mL)</th>
                  <th>UFC (mil/mL)</th>
                  <th>Gordura (%)</th>
                  <th>Proteína (%)</th>
                  <th>Lactose (%)</th>
                  <th>Sólidos (%)</th>
                  <th>Temperatura (°C)</th>
                </tr>
              </thead>
              <tbody>
                {loadedDetail.analises_recentes.map((item, index) => (
                  <tr key={item.id ?? `${item.data}-${index}`}>
                    <td><strong>{formatDate(item.data)}</strong></td>
                    <AnalysisCell field="CCS" value={item.ccs} />
                    <AnalysisCell field="UFC" value={item.ufc} />
                    <AnalysisCell field="GORD" value={item.gordura} />
                    <AnalysisCell field="PROT" value={item.proteina} />
                    <AnalysisCell field="LACT" value={item.lactose} />
                    <AnalysisCell field="SOL" value={item.solidos_totais} />
                    <AnalysisCell field="TEMP" value={item.temperatura} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyPanel copy="Nenhuma análise foi registrada para este produtor." />
        )}
      </article>
    </section>
  )
}

function KpiCard({ icon, label, value, detail, footer }: { icon: ReactNode; label: string; value: string; detail: string; footer?: ReactNode }) {
  return (
    <article className="producer-kpi-card">
      <div className="producer-kpi-head">
        <span className="producer-kpi-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
      {footer && <div className="producer-kpi-footer">{footer}</div>}
    </article>
  )
}

function MilkDelta({ data }: { data: ProducerDetailResponse['dashboard']['leite'] | undefined }) {
  if (!data || data.tendencia === 'sem_comparacao' || data.variacao_litros === null) {
    return <span className="detail-trend-pill is-neutral"><CircleAlert size={13} />Sem comparação anterior</span>
  }

  return (
    <span className={`detail-trend-pill is-${trendTone(data.tendencia)}`}>
      <TrendIcon status={data.tendencia} />
      {formatSigned(data.variacao_litros, ' L')}
      {data.variacao_percentual !== null && ` (${formatSigned(data.variacao_percentual, '%')})`}
    </span>
  )
}

function PanelHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <header className="producer-panel-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </header>
  )
}

function MilkTrendChart({
  points,
  partialPeriod,
  partialDay,
}: {
  points: MilkMonthlyPoint[]
  partialPeriod: string | null
  partialDay: number | null
}) {
  const width = 760
  const height = 250
  const margin = { top: 18, right: 18, bottom: 42, left: 62 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom
  const actualValues = points.filter((point) => point.coletas > 0).map((point) => point.litros)

  if (actualValues.length === 0) {
    return <EmptyPanel copy="Nenhuma coleta disponível para montar a evolução mensal." />
  }

  const maxValue = Math.max(...actualValues, 1)
  const xFor = (index: number) => margin.left + (index / Math.max(points.length - 1, 1)) * chartWidth
  const yFor = (value: number) => margin.top + chartHeight - (value / maxValue) * chartHeight
  let path = ''
  let drawing = false

  points.forEach((point, index) => {
    if (point.coletas === 0) {
      drawing = false
      return
    }
    if (point.periodo === partialPeriod) {
      path += ` M ${xFor(index).toFixed(1)} ${yFor(point.litros).toFixed(1)}`
      drawing = false
      return
    }
    path += `${drawing ? ' L' : ' M'} ${xFor(index).toFixed(1)} ${yFor(point.litros).toFixed(1)}`
    drawing = true
  })

  return (
    <div className="producer-chart-wrap">
      <div
        className="producer-chart-scroll"
        role="region"
        tabIndex={0}
        aria-label="Gráfico rolável da evolução mensal do volume de leite"
      >
        <svg className="producer-volume-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="milk-chart-title milk-chart-description">
        <title id="milk-chart-title">Evolução mensal do volume de leite</title>
        <desc id="milk-chart-description">Série de até doze meses; meses sem coletas aparecem como lacunas.</desc>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = margin.top + chartHeight - ratio * chartHeight
          return (
            <g key={ratio}>
              <line className="chart-grid-line" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
              <text className="chart-axis-label" x={margin.left - 10} y={y + 4} textAnchor="end">
                {compactNumberFormat.format(maxValue * ratio)}
              </text>
            </g>
          )
        })}
        <path className="milk-chart-line" d={path.trim()} />
        {points.map((point, index) => point.coletas > 0 && (
          <circle
            className={`milk-chart-point ${point.periodo === partialPeriod ? 'is-partial' : ''}`}
            key={point.periodo}
            cx={xFor(index)}
            cy={yFor(point.litros)}
            r="4"
          >
            <title>{`${formatPeriod(point.periodo)}: ${litersFormat.format(point.litros)} litros em ${point.coletas} coleta(s)${point.periodo === partialPeriod ? `; parcial até o dia ${partialDay}` : ''}`}</title>
          </circle>
        ))}
        {points.map((point, index) => (index % 2 === 0 || index === points.length - 1) && (
          <text className="chart-axis-label chart-month-label" key={point.periodo} x={xFor(index)} y={height - 12} textAnchor="middle">
            {formatPeriodShort(point.periodo)}{point.periodo === partialPeriod ? '*' : ''}
          </text>
        ))}
        </svg>
      </div>
      <div className="producer-chart-legend">
        <span><i className="is-volume" />Volume registrado</span>
        <span>{partialPeriod ? `* mês parcial até o dia ${partialDay}; sem ligação ao mês fechado anterior` : 'Meses sem coletas são exibidos como lacunas'}</span>
      </div>
      <div className="producer-chart-data" aria-label="Dados mensais do volume de leite">
        <p>Dados mensais do volume de leite</p>
        <ul>
          {points.map((point) => (
            <li key={point.periodo}>
              {formatPeriod(point.periodo)}{point.periodo === partialPeriod ? `, parcial até o dia ${partialDay}` : ''}: {' '}
              {point.coletas > 0 ? `${litersFormat.format(point.litros)} litros em ${point.coletas} coleta(s)` : 'sem dados'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function QualityEvidence({ indicator }: { indicator: QualityIndicatorComparison }) {
  const direction = indicator.variacao > 0 ? 'subiu' : indicator.variacao < 0 ? 'caiu' : 'se manteve'
  const percent = indicator.variacao_percentual !== null ? ` ${Math.abs(indicator.variacao_percentual).toLocaleString('pt-BR')}%` : ''

  return (
    <div className="quality-evidence-row">
      <span className={`quality-evidence-icon is-${trendTone(indicator.situacao)}`}>
        <TrendIcon status={indicator.situacao} />
      </span>
      <div>
        <strong>{indicator.label}</strong>
        <p>{direction}{percent} em relação ao mês anterior</p>
      </div>
      <span className={`detail-trend-pill is-${trendTone(indicator.situacao)}`}>{qualityTrendLabel(indicator.situacao)}</span>
    </div>
  )
}

function MetricComparisonCard({
  metric,
  currentValue,
  previousValue,
  comparison,
  series,
}: {
  metric: MetricDefinition
  currentValue: number | null
  previousValue: number | null
  comparison: QualityIndicatorComparison | null
  series: QualityMonthlyPoint[]
}) {
  const status = comparison?.situacao ?? 'sem_comparacao'
  const metricStatus = resolveMetricStatus(metric.field, currentValue)

  return (
    <article className="producer-metric-card">
      <div className="producer-metric-head">
        <div>
          <span>{metric.label}</span>
          <strong className={`analysis-value is-${metricStatus}`}>
            {formatProducerMetric(metric.field, currentValue)}
            {currentValue !== null && <small>{metric.unit}</small>}
          </strong>
        </div>
        <span className={`metric-direction is-${trendTone(status)}`} title={qualityTrendLabel(status)}>
          <TrendIcon status={status} />
        </span>
      </div>
      <MetricSparkline points={series} metric={metric} status={status} />
      <div className="producer-metric-comparison">
        <span>Anterior <b>{formatProducerMetric(metric.field, previousValue)}{previousValue !== null ? ` ${metric.unit}` : ''}</b></span>
        <span className={`is-${trendTone(status)}`}>
          {comparison ? `${formatSignedMetric(comparison.variacao, metric.field)} ${metric.unit}` : 'Sem comparação'}
        </span>
      </div>
      <div className="producer-metric-footer">
        <span>{metric.favorable}</span>
        <b className={`is-${trendTone(status)}`}>{qualityTrendLabel(status)}</b>
      </div>
    </article>
  )
}

function MetricSparkline({ points, metric, status }: { points: QualityMonthlyPoint[]; metric: MetricDefinition; status: ProducerTrend }) {
  const width = 210
  const height = 52
  const values = points.map((point) => point[metric.key])
  const available = values.filter((value): value is number => value !== null)

  if (available.length === 0) {
    return <div className="metric-sparkline-empty"><span />Histórico insuficiente</div>
  }

  const min = Math.min(...available)
  const max = Math.max(...available)
  const range = Math.max(max - min, Math.abs(max) * 0.04, 1)
  const xFor = (index: number) => (index / Math.max(points.length - 1, 1)) * width
  const yFor = (value: number) => height - 5 - ((value - min) / range) * (height - 10)
  let path = ''
  let drawing = false

  values.forEach((value, index) => {
    if (value === null) {
      drawing = false
      return
    }
    path += `${drawing ? ' L' : ' M'} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`
    drawing = true
  })
  const accessibleSummary = points
    .map((point, index) => values[index] === null
      ? null
      : `${formatPeriod(point.periodo)}: ${formatProducerMetric(metric.field, values[index])} ${metric.unit}`)
    .filter((value): value is string => value !== null)
    .join('; ')

  return (
    <svg
      className={`metric-sparkline is-${trendTone(status)}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Histórico mensal de ${metric.label}. ${accessibleSummary}`}
    >
      <line x1="0" x2={width} y1={height - 5} y2={height - 5} />
      <path d={path.trim()} />
      {values.map((value, index) => value !== null && (
        <circle key={points[index].periodo} cx={xFor(index)} cy={yFor(value)} r="2.7" />
      ))}
    </svg>
  )
}

function AnalysisCell({ field, value }: { field: AnalysisMetricField; value: number | null }) {
  const status = resolveMetricStatus(field, value)
  return <td><span className={`analysis-value is-${status}`}>{formatProducerMetric(field, value)}</span></td>
}

function EmptyPanel({ copy }: { copy: string }) {
  return (
    <div className="producer-panel-empty">
      <CircleAlert size={18} />
      <span>{copy}</span>
    </div>
  )
}

function TrendIcon({ status }: { status: ProducerTrend | MilkTrend }) {
  const tone = trendTone(status)
  if (tone === 'positive') return <TrendingUp size={14} aria-hidden="true" />
  if (tone === 'negative') return <TrendingDown size={14} aria-hidden="true" />
  if (status === 'estavel') return <Minus size={14} aria-hidden="true" />
  return <CircleAlert size={14} aria-hidden="true" />
}

function trendTone(status: ProducerTrend | MilkTrend): 'positive' | 'negative' | 'neutral' {
  if (status === 'melhorou' || status === 'aumentou') return 'positive'
  if (status === 'piorou' || status === 'diminuiu') return 'negative'
  return 'neutral'
}

function qualityTrendLabel(status: ProducerTrend): string {
  return {
    melhorou: 'Melhorou',
    estavel: 'Manteve',
    piorou: 'Piorou',
    sem_comparacao: 'Sem comparação',
  }[status]
}

function qualityDiagnosisTitle(status: ProducerTrend): string {
  return {
    melhorou: 'A qualidade avançou',
    estavel: 'A qualidade se manteve',
    piorou: 'A qualidade exige atenção',
    sem_comparacao: 'Ainda não há base de comparação',
  }[status]
}

function qualityDiagnosisCopy(data: ProducerDetailResponse['dashboard']['qualidade'] | undefined): string {
  if (!data || data.situacao === 'sem_comparacao') {
    return 'O diagnóstico será liberado quando houver análises em dois meses consecutivos.'
  }

  const summary = `${data.melhoraram} indicador(es) melhoraram, ${data.estaveis} permaneceram estáveis e ${data.pioraram} pioraram.`
  return data.alerta_sanitario
    ? `Atenção: CCS ou UFC piorou no período. ${summary}`
    : summary
}

function statusPriority(status: ProducerTrend): number {
  return status === 'piorou' ? 0 : status === 'melhorou' ? 1 : status === 'estavel' ? 2 : 3
}

function formatSigned(value: number, suffix: string): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${decimalFormat.format(value)}${suffix}`
}

function formatSignedMetric(value: number, field: AnalysisMetricField): string {
  const sign = value > 0 ? '+' : ''
  if (field === 'CCS' || field === 'UFC') {
    return `${sign}${sanitaryFormat.format(value)}`
  }
  return `${sign}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatProducerMetric(field: AnalysisMetricField, value: number | null | undefined): string {
  if (value === null || value === undefined) return '--'
  if (field === 'CCS' || field === 'UFC') {
    const normalized = normalizeAnalysisValue(field, value)
    return normalized === null ? '--' : sanitaryFormat.format(normalized)
  }
  return formatAnalysisMetric(field, value)
}

function formatPeriod(value: string | null | undefined): string {
  if (!value) return 'período atual'
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function formatPeriodShort(value: string): string {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace('.', '')
}

function toMonthYear(value: string): string {
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

function currentMonthInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return year && month ? `${year}-${month}` : new Date().toISOString().slice(0, 7)
}

function monthYearToApi(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{4})$/)
  if (!match) return null

  const month = Number(match[1])
  if (month < 1 || month > 12) return null

  return `${match[2]}-${match[1]}`
}
