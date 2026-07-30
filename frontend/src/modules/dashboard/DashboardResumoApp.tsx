import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  Factory,
  Fuel,
  Milk,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { MilkTrendChart } from './components/MilkTrendChart'
import { useDashboardOverview, type DataState } from './hooks/useDashboardOverview'
import './dashboard.css'

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const percentage = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortDateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

type AttentionItem = {
  label: string
  value: string
  detail: string
  href: string
}

export function DashboardResumoApp() {
  const dashboard = useDashboardOverview()
  const quality = dashboard.qualidade.data
  const stock = dashboard.estoque.data
  const shipping = dashboard.expedicao.data
  const fuel = dashboard.combustivel.data
  const production = dashboard.producao.data
  const pasteurizer = dashboard.pasteurizador.data
  const latestCollection = pasteurizer?.ultima_coleta ?? null
  const productionPending = production
    ? production.totais.ops_aguardando_formato + production.totais.rascunhos
    : null
  const qualityCoverage = quality?.produtores_ativos
    ? (quality.produtores_com_analise / quality.produtores_ativos) * 100
    : null
  const pasteurizerAgeHours = hoursSince(latestCollection?.coletado_em)
  const pasteurizerStale = pasteurizerAgeHours === null || pasteurizerAgeHours > 36
  const attention = buildAttentionItems({
    qualityWithoutAnalysis: quality?.produtores_sem_analise ?? null,
    lowStock: stock?.totais.abaixo_minimo ?? null,
    productionPending,
    fuelPercentage: fuel?.porcentagem ?? null,
    pasteurizerStatus: latestCollection?.status ?? null,
    pasteurizerAgeHours,
    pasteurizerAvailable: pasteurizer !== null,
  })
  const unavailable = [
    ['Leite', dashboard.leite.failed],
    ['Produtores', dashboard.produtores.failed],
    ['Qualidade', dashboard.qualidade.failed],
    ['Estoque', dashboard.estoque.failed],
    ['Expedição', dashboard.expedicao.failed],
    ['Combustível', dashboard.combustivel.failed],
    ['Produção', dashboard.producao.failed],
    ['Pasteurizador', dashboard.pasteurizador.failed],
  ].filter(([, failed]) => failed).map(([label]) => String(label))

  return (
    <div className="dashboard-module">
      <main className="dashboard-page" aria-labelledby="dashboard-title">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-eyebrow">Dashboard</span>
            <h1 id="dashboard-title">Visão geral</h1>
          </div>
          <div className="dashboard-header-actions">
            <div className="dashboard-reference">
              <strong>{capitalize(monthYear.format(new Date()))}</strong>
              <span>{dashboard.updatedAt ? `Atualizado às ${clock.format(dashboard.updatedAt)}` : 'Atualizando dados'}</span>
            </div>
            <button
              className="dashboard-refresh"
              type="button"
              onClick={dashboard.refresh}
              disabled={dashboard.refreshing}
              aria-label="Atualizar dashboard"
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span>Atualizar</span>
            </button>
          </div>
        </header>

        {unavailable.length > 0 ? (
          <div className="dashboard-source-warning" role="status">
            <AlertCircle size={16} aria-hidden="true" />
            <span>Dados indisponíveis: {unavailable.join(', ')}. As demais áreas continuam atualizadas.</span>
          </div>
        ) : null}

        <section className="dashboard-summary-grid" aria-label="Indicadores principais">
          <MetricCard className="is-primary" label="Leite recebido no mês" icon={Milk} href="#/coletas/inicio">
            <MetricValue
              state={dashboard.leite}
              value={dashboard.leite.data ? integer.format(dashboard.leite.data.litros_mes_atual) : null}
              suffix="L"
              prominent
            />
            <Trend value={dashboard.leite.data?.variacao_percentual ?? null} />
          </MetricCard>

          <MetricCard label="Produtores" icon={Users} href="#/produtores">
            <MetricValue
              state={dashboard.produtores}
              value={dashboard.produtores.data === null ? null : integer.format(dashboard.produtores.data)}
            />
            <span className="dashboard-metric-note">cadastrados e ativos</span>
          </MetricCard>

          <MetricCard label="Cobertura de análises" icon={ShieldCheck} href="#/inicio">
            <MetricValue
              state={dashboard.qualidade}
              value={qualityCoverage === null ? null : `${decimal.format(qualityCoverage)}%`}
            />
            <span className="dashboard-metric-note">
              {quality ? `${integer.format(quality.produtores_com_analise)} de ${integer.format(quality.produtores_ativos)} produtores` : '—'}
            </span>
          </MetricCard>

          <MetricCard label="Ordens abertas" icon={Truck} href="#/expedicao/ordens">
            <MetricValue
              state={dashboard.expedicao}
              value={shipping ? integer.format(shipping.totais.ordens_abertas) : null}
            />
            <span className="dashboard-metric-note">
              {shipping ? `${integer.format(shipping.totais.paletes)} paletes disponíveis` : '—'}
            </span>
          </MetricCard>
        </section>

        <section className="dashboard-main-grid">
          <article className="dashboard-panel dashboard-milk-panel">
            <PanelHeader
              title="Recebimento mensal"
              detail="Últimos 12 meses"
              action={<a href="#/coletas/inicio">Abrir leite <ChevronRight size={14} aria-hidden="true" /></a>}
            />
            <div className="dashboard-chart-summary">
              <div>
                <span>Mês atual</span>
                <strong>{dashboard.leite.data ? `${compact.format(dashboard.leite.data.litros_mes_atual)} L` : '—'}</strong>
              </div>
              <div>
                <span>Mês anterior</span>
                <strong>{dashboard.leite.data ? `${compact.format(dashboard.leite.data.litros_mes_anterior)} L` : '—'}</strong>
              </div>
            </div>
            {dashboard.leite.loading ? (
              <ChartSkeleton />
            ) : dashboard.leite.data ? (
              <MilkTrendChart data={dashboard.leite.data.serie_mensal} />
            ) : (
              <EmptyState text="Recebimento mensal indisponível" />
            )}
          </article>

          <article className="dashboard-panel dashboard-attention-panel">
            <PanelHeader title="Atenção agora" detail={`${attention.length} ${attention.length === 1 ? 'ponto' : 'pontos'}`} />
            <div className="dashboard-attention-list">
              {attention.length ? attention.slice(0, 5).map((item) => (
                <a className="dashboard-attention-item" href={item.href} key={`${item.label}-${item.detail}`}>
                  <span className="dashboard-attention-mark" aria-hidden="true" />
                  <span className="dashboard-attention-copy">
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    <span>{item.detail}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </a>
              )) : (
                <div className="dashboard-attention-empty">
                  <Check size={20} aria-hidden="true" />
                  <strong>Nenhuma pendência crítica</strong>
                  <span>Os módulos monitorados estão dentro do esperado.</span>
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="dashboard-lower-grid">
          <article className="dashboard-panel dashboard-operation-panel">
            <PanelHeader title="Operação" detail="Estado atual dos módulos" />
            <div className="dashboard-operation-list">
              <OperationRow
                icon={Factory}
                label="Produção"
                href="#/producao/inicio"
                state={dashboard.producao}
                value={productionPending === null ? null : `${integer.format(productionPending)} pendências`}
                detail={production ? `${integer.format(production.totais.formulacoes_queijo)} formulações de queijo` : null}
              />
              <OperationRow
                icon={Boxes}
                label="Estoque"
                href="#/estoque/inicio"
                state={dashboard.estoque}
                value={stock ? `${integer.format(stock.totais.abaixo_minimo)} itens críticos` : null}
                detail={stock ? `${integer.format(stock.totais.itens_ativos)} itens ativos` : null}
                progress={stock?.totais.itens_ativos ? (stock.totais.abaixo_minimo / stock.totais.itens_ativos) * 100 : 0}
              />
              <OperationRow
                icon={Fuel}
                label="Combustível"
                href="#/combustivel/inicio"
                state={dashboard.combustivel}
                value={fuel ? `${integer.format(fuel.estoque_atual_litros)} L` : null}
                detail={fuel ? `${integer.format(fuel.capacidade_litros)} L de capacidade` : null}
                progress={fuel?.porcentagem ?? 0}
              />
              <OperationRow
                icon={Thermometer}
                label="Pasteurizador"
                href="#/pasteurizador/inicio"
                state={dashboard.pasteurizador}
                value={latestCollection ? collectionStatus(latestCollection.status, pasteurizerStale) : null}
                detail={latestCollection?.coletado_em ? `Última coleta em ${formatDateTime(latestCollection.coletado_em)}` : 'Sem coleta registrada'}
              />
            </div>
          </article>

          <article className="dashboard-panel dashboard-shipping-panel">
            <PanelHeader
              title="Expedição"
              detail="Estoque disponível"
              action={<a href="#/expedicao">Abrir expedição <ChevronRight size={14} aria-hidden="true" /></a>}
            />
            {dashboard.expedicao.loading ? (
              <div className="dashboard-shipping-loading"><span /><span /><span /></div>
            ) : shipping ? (
              <>
                <div className="dashboard-shipping-totals">
                  <div><strong>{integer.format(shipping.totais.paletes)}</strong><span>paletes</span></div>
                  <div><strong>{integer.format(shipping.totais.caixas)}</strong><span>caixas</span></div>
                  <div><strong>{compact.format(shipping.totais.peso_total)} kg</strong><span>peso total</span></div>
                </div>
                <div className="dashboard-product-list">
                  {shipping.produtos.slice(0, 4).map((product) => (
                    <div className="dashboard-product-row" key={product.produto}>
                      <div><strong>{product.produto}</strong><span>{integer.format(product.paletes)} paletes</span></div>
                      <div className="dashboard-product-track" aria-hidden="true">
                        <span style={{ width: `${productShare(product.paletes, shipping.produtos)}%` }} />
                      </div>
                    </div>
                  ))}
                  {!shipping.produtos.length ? <EmptyState text="Nenhum produto no estoque de expedição" compact /> : null}
                </div>
              </>
            ) : (
              <EmptyState text="Expedição indisponível" />
            )}
          </article>
        </section>
      </main>
    </div>
  )
}

function MetricCard({ label, icon: Icon, href, className = '', children }: {
  label: string
  icon: LucideIcon
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <a className={`dashboard-metric-card ${className}`} href={href}>
      <header><span>{label}</span><Icon size={17} aria-hidden="true" /></header>
      <div className="dashboard-metric-body">{children}</div>
      <ChevronRight className="dashboard-metric-arrow" size={16} aria-hidden="true" />
    </a>
  )
}

function MetricValue<T>({ state, value, suffix, prominent = false }: {
  state: DataState<T>
  value: string | null
  suffix?: string
  prominent?: boolean
}) {
  if (state.loading) return <span className="dashboard-value-skeleton" aria-label="Carregando indicador" />
  return (
    <strong className={`dashboard-metric-value${prominent ? ' is-prominent' : ''}`}>
      {value ?? '—'}{value && suffix ? <small> {suffix}</small> : null}
    </strong>
  )
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="dashboard-metric-note">sem comparação com o mês anterior</span>
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="dashboard-trend">
      <Icon size={14} aria-hidden="true" />
      <strong>{percentage.format(value)}%</strong>
      <span>vs. mês anterior</span>
    </span>
  )
}

function PanelHeader({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <header className="dashboard-panel-header">
      <div><h2>{title}</h2><span>{detail}</span></div>
      {action ? <div className="dashboard-panel-action">{action}</div> : null}
    </header>
  )
}

function OperationRow<T>({ icon: Icon, label, href, state, value, detail, progress }: {
  icon: LucideIcon
  label: string
  href: string
  state: DataState<T>
  value: string | null
  detail: string | null
  progress?: number
}) {
  return (
    <a className="dashboard-operation-row" href={href}>
      <span className="dashboard-operation-icon"><Icon size={18} aria-hidden="true" /></span>
      <span className="dashboard-operation-copy">
        <small>{label}</small>
        {state.loading ? <span className="dashboard-row-skeleton" /> : <strong>{value ?? 'Indisponível'}</strong>}
        <span>{detail ?? '—'}</span>
        {progress !== undefined ? (
          <span className="dashboard-progress" aria-label={`${label}: ${decimal.format(clamp(progress, 0, 100))}%`}>
            <span style={{ width: `${clamp(progress, 0, 100)}%` }} />
          </span>
        ) : null}
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </a>
  )
}

function ChartSkeleton() {
  return <div className="dashboard-chart-skeleton" aria-label="Carregando evolução mensal"><span /><span /><span /><span /></div>
}

function EmptyState({ text, compact: isCompact = false }: { text: string; compact?: boolean }) {
  return <div className={`dashboard-empty${isCompact ? ' is-compact' : ''}`}>{text}</div>
}

function buildAttentionItems(input: {
  qualityWithoutAnalysis: number | null
  lowStock: number | null
  productionPending: number | null
  fuelPercentage: number | null
  pasteurizerStatus: 'rascunho' | 'processada' | 'erro' | null
  pasteurizerAgeHours: number | null
  pasteurizerAvailable: boolean
}): AttentionItem[] {
  const items: AttentionItem[] = []
  if (input.qualityWithoutAnalysis && input.qualityWithoutAnalysis > 0) items.push({
    label: 'Qualidade', value: `${integer.format(input.qualityWithoutAnalysis)} produtores`, detail: 'sem análise no período', href: '#/inicio',
  })
  if (input.lowStock && input.lowStock > 0) items.push({
    label: 'Estoque', value: `${integer.format(input.lowStock)} itens`, detail: 'abaixo do estoque mínimo', href: '#/estoque/inicio',
  })
  if (input.productionPending && input.productionPending > 0) items.push({
    label: 'Produção', value: `${integer.format(input.productionPending)} registros`, detail: 'aguardando conclusão', href: '#/producao/inicio',
  })
  if (input.fuelPercentage !== null && input.fuelPercentage < 25) items.push({
    label: 'Combustível', value: `${decimal.format(input.fuelPercentage)}%`, detail: 'nível abaixo de 25% do tanque', href: '#/combustivel/inicio',
  })
  if (input.pasteurizerAvailable && input.pasteurizerStatus === 'erro') items.push({
    label: 'Pasteurizador', value: 'Falha na coleta', detail: 'última importação terminou com erro', href: '#/pasteurizador/inicio',
  })
  if (input.pasteurizerAvailable && input.pasteurizerStatus !== 'erro' && (input.pasteurizerAgeHours === null || input.pasteurizerAgeHours > 36)) items.push({
    label: 'Pasteurizador', value: input.pasteurizerAgeHours === null ? 'Sem coleta' : ageLabel(input.pasteurizerAgeHours), detail: 'sem atualização recente', href: '#/pasteurizador/inicio',
  })
  return items
}

function productShare(value: number, products: Array<{ paletes: number }>) {
  const max = Math.max(...products.map((product) => product.paletes), 1)
  return clamp((value / max) * 100, 3, 100)
}

function hoursSince(value?: string | null) {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp)) return null
  return Math.max(0, (Date.now() - timestamp) / 3_600_000)
}

function ageLabel(hours: number) {
  if (hours < 48) return `${Math.round(hours)} h sem atualização`
  return `${Math.round(hours / 24)} dias sem atualização`
}

function collectionStatus(status: 'rascunho' | 'processada' | 'erro', stale: boolean) {
  if (status === 'erro') return 'Falha na última coleta'
  if (stale) return 'Atualização atrasada'
  return status === 'processada' ? 'Operando normalmente' : 'Coleta pendente'
}

function formatDateTime(value: string) {
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : shortDateTime.format(date)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
