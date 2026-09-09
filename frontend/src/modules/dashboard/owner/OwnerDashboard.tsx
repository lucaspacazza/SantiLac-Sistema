import {
  AlertTriangle,
  Box,
  Boxes,
  Clock3,
  Download,
  Droplets,
  Expand,
  Factory,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  List,
  Maximize2,
  Moon,
  PieChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  Truck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { useDashboardOverview } from '../hooks/useDashboardOverview'
import { BarChart, compact, DonutChart, formatNumber, LineChart, Sparkline } from './Charts'
import { dashboardPeriod, downloadCsv, filterLots, normalizeProductName, sumBy } from './model'
import './owner-dashboard.css'

type Dashboard = ReturnType<typeof useDashboardOverview>
type Lot = NonNullable<Dashboard['producao']['data']>['lotes'][number]
type Product = NonNullable<Dashboard['producao']['data']>['products'][number]
type ModalState = { title: string; body: ReactNode } | null
type Period = 7 | 14 | 30
type LotState = 'all' | 'open' | Lot['state']

const states: Record<Lot['state'], string> = {
  closed: 'Embalagem encerrada',
  packing: 'Em embalagem',
  waiting: 'Aguardando embalagem',
  format: 'Aguardando formato',
}

const fallbackTones = ['var(--owner-green)', 'var(--owner-amber)', 'var(--owner-blue)', 'var(--owner-purple)', 'var(--owner-cyan)']

export function OwnerDashboard({ dashboard }: { dashboard: Dashboard }) {
  const [period, setPeriod] = useState<Period>(7)
  const [selectedProduct, setSelectedProduct] = useState('all')
  const [activeSection, setActiveSection] = useState('overview')
  const [shipmentFilter, setShipmentFilter] = useState<'all' | 'pending'>('all')
  const [lotState, setLotState] = useState<LotState>('all')
  const [lotSearch, setLotSearch] = useState('')
  const [lotDate, setLotDate] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const milk = dashboard.leite.data
  const production = dashboard.producao.data
  const quality = dashboard.qualidade.data?.quality
  const inventory = dashboard.estoque.data?.inventory ?? []
  const shipping = dashboard.expedicao.data
  const fuel = dashboard.combustivel.data
  const pasteurizer = dashboard.pasteurizador.data
  const unavailable = [
    { label: 'leite', failed: dashboard.leite.failed },
    { label: 'produção', failed: dashboard.producao.failed },
    { label: 'qualidade', failed: dashboard.qualidade.failed },
    { label: 'estoque', failed: dashboard.estoque.failed },
    { label: 'expedição', failed: dashboard.expedicao.failed },
    { label: 'combustível', failed: dashboard.combustivel.failed },
    { label: 'pasteurizador', failed: dashboard.pasteurizador.failed },
  ].filter((source) => source.failed).map((source) => source.label)
  const products = useMemo(() => (production?.products ?? []).map((product) => ({ ...product, name: normalizeProductName(product.name), short: normalizeProductName(product.short) })), [production])
  const allDays = useMemo(() => mergeDays(milk?.serie_diaria ?? [], production?.days ?? [], shipping?.dispatchedDays ?? []), [milk, production, shipping])
  const scoped = useMemo(() => dashboardPeriod(allDays, production?.lotes ?? [], period, selectedProduct), [allDays, period, production, selectedProduct])
  const lots = scoped.lots
  const closed = lots.filter((lot) => lot.state === 'closed')
  const open = lots.filter((lot) => lot.state !== 'closed')
  const scopedProducts = products.filter((product) => selectedProduct === 'all' || product.id === selectedProduct)
  const totalCollected = sumBy(scoped.days, (day) => day.collected)
  const previousCollected = sumBy(scoped.days, (day) => day.previousCollected)
  const milkApplied = sumBy(lots, (lot) => lot.milk)
  const finalWeight = sumBy(closed, (lot) => lot.weight)
  const closedMilk = sumBy(closed, (lot) => lot.milk)
  const consolidatedYield = finalWeight > 0 ? closedMilk / finalWeight : null
  const coverage = lots.length ? closed.length / lots.length * 100 : 0
  const growth = previousCollected > 0 ? (totalCollected / previousCollected - 1) * 100 : null
  const dispatched = sumBy(scoped.days, (day) => day.dispatchedKg)
  const physicalStock = sumBy(shipping?.productStock ?? [], (stock) => stock.available)
  const reservedStock = sumBy(shipping?.productStock ?? [], (stock) => stock.reserved)
  const expiringStock = sumBy(shipping?.productStock ?? [], (stock) => stock.expiringKg)
  const lowInventory = inventory.filter((item) => item.min > 0 && item.stock <= item.min)
  const latestDay = scoped.days.at(-1)
  const pagedLots = useMemo(() => filterLots(lots, products, { state: lotState, date: lotDate, search: lotSearch }), [lotDate, lotSearch, lotState, lots, products])
  const pageCount = Math.max(1, Math.ceil(pagedLots.length / 8))
  const visibleLots = pagedLots.slice((Math.min(page, pageCount) - 1) * 8, Math.min(page, pageCount) * 8)

  useEffect(() => setPage(1), [lotState, lotSearch, lotDate, selectedProduct, period])
  useEffect(() => {
    const root = rootRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]) setActiveSection(visible[0].target.id)
    }, { rootMargin: '-10% 0px -60% 0px' })
    root.querySelectorAll<HTMLElement>('.owner-section[id]').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3_500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const go = (section: string) => rootRef.current?.querySelector(`#${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const inspectLots = (state: LotState = 'all', date: string | null = null) => {
    setLotState(state)
    setLotDate(date)
    setLotSearch('')
    go('lotes')
  }
  const showLot = (lot: Lot) => {
    const product = products.find((item) => item.id === lot.productId)
    setModal({ title: `${lot.id} · ${product?.name ?? 'Produto'}`, body: <>
      <p>Produção de <strong>{formatDate(lot.date)}</strong>. {states[lot.state]}.</p>
      <DetailGrid values={[
        ['LEITE APLICADO', `${formatNumber(lot.milk)} L`],
        ['PESO FINAL', lot.weight === null ? 'Aguardando' : `${formatNumber(lot.weight)} kg`],
        ['RENDIMENTO', lot.weight ? `${formatNumber(lot.milk / lot.weight, 2)} L/kg` : '—'],
        ['CAIXAS REGISTRADAS', formatNumber(lot.boxes)],
        ['PESO JÁ REGISTRADO', `${formatNumber(lot.partialWeight)} kg`],
        ['ENCERRAMENTO', lot.closedAt ? formatDateTime(lot.closedAt) : '—'],
      ]}/>
      <div className="owner-detail-note">{lot.state === 'closed' ? 'O rendimento usa o leite e o peso final deste mesmo lote.' : 'O peso registrado ainda é parcial; o lote permanece fora do rendimento consolidado até o encerramento.'}</div>
    </> })
  }
  const showRoute = (route: NonNullable<typeof milk>['rotas'][number]) => setModal({ title: route.nome, body: <>
    <p>{route.motorista || 'Motorista não informado'} · última coleta registrada</p>
    <DetailGrid values={[
      ['VOLUME COLETADO', `${formatNumber(route.litros)} L`],
      ['PRODUTORES', formatNumber(route.produtores)],
      ['TEMPERATURA MÉDIA', route.temperatura_media === null ? '—' : `${formatNumber(route.temperatura_media, 1)} °C`],
      ['IDENTIFICADOR', route.id],
    ]}/>
  </> })
  const exportSummary = () => {
    downloadCsv('santilac-indicadores.csv', [
      ['DADOS REAIS DO SISTEMA'],
      ['Período', scoped.days[0]?.date, scoped.days.at(-1)?.date],
      ['Produto', selectedProduct === 'all' ? 'Todos os queijos' : products.find((item) => item.id === selectedProduct)?.name],
      ['Indicador', 'Valor', 'Unidade'],
      ['Leite coletado', totalCollected, 'L'], ['Leite aplicado', milkApplied, 'L'], ['Peso final', finalWeight, 'kg'],
      ['Lotes fechados', closed.length, 'lotes'], ['Lotes pendentes', open.length, 'lotes'], ['Peso expedido', dispatched, 'kg'],
    ])
    setToast('Indicadores exportados em CSV.')
  }
  const exportLots = () => {
    downloadCsv('santilac-lotes.csv', [['DADOS REAIS DO SISTEMA'], ['OP', 'Produto', 'Produção', 'Leite L', 'Peso final kg', 'L/kg', 'Situação', 'Encerramento'], ...pagedLots.map((lot) => [lot.id, products.find((item) => item.id === lot.productId)?.name, lot.date, lot.milk, lot.weight, lot.weight ? formatNumber(lot.milk / lot.weight, 2) : '', states[lot.state], lot.closedAt])])
    setToast('Lotes exportados em CSV.')
  }

  return <div className="owner-dashboard" ref={rootRef}>
    <a className="owner-skip" href="#overview" onClick={(event) => { event.preventDefault(); go('overview') }}>Ir para os indicadores</a>
    <OwnerSidebar active={activeSection} onGo={go} onToggleTheme={() => {
      document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'
      window.localStorage.setItem('santilac-theme', document.documentElement.dataset.theme)
    }}/>
    <main className="owner-main">
      <header className="owner-topbar">
        <div className="owner-breadcrumb">Santi&apos;Lac <span>/</span> <strong>Painel executivo</strong></div>
        <div className="owner-topbar-right"><span className="owner-demo-label">DADOS DO SISTEMA</span><span className="owner-snapshot"><i className="owner-live-dot"/>{dashboard.updatedAt ? `Atualizado em ${dashboard.updatedAt.toLocaleString('pt-BR')}` : 'Atualizando dados...'}</span><button className="owner-icon-btn" type="button" aria-label="Atualizar dados" title="Atualizar dados" disabled={dashboard.refreshing} onClick={dashboard.refresh}><RefreshCw size={15}/></button><button className="owner-icon-btn" type="button" aria-label="Alternar tela cheia" onClick={() => void toggleFullscreen(rootRef.current, setToast)}><Expand size={15}/></button></div>
      </header>
      <div className="owner-page">
        {unavailable.length ? <div className="owner-source-warning" role="status"><AlertTriangle size={15}/><span>Dados indisponíveis: {unavailable.join(', ')}. Os demais indicadores continuam usando as fontes disponíveis.</span></div> : null}
        <section id="overview" className="owner-section">
          <div className="owner-page-heading"><div><span className="owner-eyebrow">VISÃO COMPLETA DO NEGÓCIO</span><h1>Cada litro. Cada lote. Cada resultado<span>.</span></h1><p>A fábrica inteira no seu primeiro olhar da manhã.</p></div><button className="owner-btn" type="button" onClick={exportSummary}><Download size={14}/>Exportar indicadores</button></div>
          <div className="owner-filterbar">
            <div className="owner-period-buttons" role="group" aria-label="Período dos indicadores">{([7, 14, 30] as Period[]).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value} dias</button>)}</div>
            <span className="owner-period-label">{scoped.days.length ? `${formatDate(scoped.days[0].date)} — ${formatDate(scoped.days.at(-1)?.date ?? '')}` : 'Sem dados no período'}</span><i className="owner-filter-divider"/>
            <label htmlFor="owner-product-filter">Produção</label><select id="owner-product-filter" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}><option value="all">Todos os queijos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
            <button className="owner-text-btn owner-filter-reset" type="button" onClick={() => { setPeriod(7); setSelectedProduct('all'); setLotDate(null); setLotState('all'); setLotSearch('') }}>Limpar filtros</button>
          </div>
          <div className="owner-morning-brief"><Sparkles size={17}/><p>{latestDay ? <>No último dia registrado, <strong>{formatNumber(latestDay.collected)} L foram coletados</strong>. A fábrica tem <strong>{(production?.lotes ?? []).filter((lot) => lot.state !== 'closed').length} lotes sem peso final</strong> e <strong>{lowInventory.length} insumos abaixo do mínimo</strong>.</> : 'Aguardando os primeiros registros do período.'}</p><button className="owner-text-btn" type="button" onClick={() => go('producao')}>Acompanhar produção ↗</button></div>
          <div className="owner-kpi-grid">
            <Kpi label="Litragem coletada" value={milk ? compact(totalCollected) : '—'} unit="L" caption="Todas as rotas · coleta no campo" note={!milk ? 'Fonte indisponível' : growth === null ? 'Sem base anterior' : `${growth >= 0 ? '↗' : '↘'} ${formatNumber(Math.abs(growth), 1)}% vs. período anterior`} values={scoped.days.map((day) => day.collected)} color="var(--owner-blue)" icon={<Droplets/>} onClick={() => setModal({ title: 'Litragem coletada', body: <DetailGrid values={[["COLETADO NO PERÍODO", milk ? `${formatNumber(totalCollected)} L` : '—'], ["MÉDIA DIÁRIA", milk ? `${formatNumber(totalCollected / Math.max(1, scoped.days.length))} L` : '—'], ["PERÍODO ANTERIOR", milk ? `${formatNumber(previousCollected)} L` : '—']]}/> })}/>
            <Kpi label="Leite aplicado em queijo" value={production ? compact(milkApplied) : '—'} unit="L" caption="Segue o filtro de produto" note={production ? `${lots.length} lotes no período` : 'Fonte indisponível'} values={scoped.days.map((day) => sumBy(lots.filter((lot) => lot.date === day.date), (lot) => lot.milk))} color="var(--owner-cyan)" icon={<Factory/>} onClick={() => go('producao')}/>
            <Kpi label="Produção com peso final" value={production ? compact(finalWeight) : '—'} unit="kg" caption="Por data de produção · sem peso parcial" note={production ? `${closed.length} de ${lots.length} lotes encerrados` : 'Fonte indisponível'} values={scoped.days.map((day) => sumBy(closed.filter((lot) => lot.date === day.date), (lot) => lot.weight))} color="var(--owner-green)" icon={<Box/>} onClick={() => go('producao')}/>
            <Kpi label="Rendimento consolidado" value={consolidatedYield === null ? '—' : formatNumber(consolidatedYield, 2)} unit="L/kg" caption="Somente lotes encerrados" note={`${formatNumber(coverage)}% dos lotes com embalagem encerrada`} values={scoped.days.map((day) => dayYield(closed.filter((lot) => lot.date === day.date)))} color="var(--owner-amber)" icon={<Gauge/>} onClick={() => setModal({ title: 'Como o rendimento é apurado', body: <><DetailGrid values={[["LITROS DOS LOTES FECHADOS", `${formatNumber(closedMilk)} L`], ["PESO DOS MESMOS LOTES", `${formatNumber(finalWeight)} kg`], ["LITROS ÷ PESO", consolidatedYield === null ? '—' : `${formatNumber(consolidatedYield, 2)} L/kg`]]}/><p>Lotes abertos ficam fora dos dois lados da divisão até o encerramento da embalagem.</p></> })}/>
            <Kpi label="Volume expedido" value={shipping ? compact(dispatched) : '—'} unit="kg" caption="Carregamentos concluídos no período" note={shipping ? `${shipping.shipments.filter((item) => item.status === 'Concluída' && scoped.days.some((day) => day.date === item.date)).length} carregamentos` : 'Fonte indisponível'} values={scoped.days.map((day) => day.dispatchedKg)} color="var(--owner-blue)" icon={<Truck/>} onClick={() => go('estoque')}/>
            <Kpi label="Estoque físico" value={shipping ? compact(physicalStock) : '—'} unit="kg" caption="Posição atual · todos os produtos" note={shipping ? `${formatNumber(reservedStock)} kg reservados` : 'Fonte indisponível'} values={(shipping?.productStock ?? []).map((item) => item.available)} color="var(--owner-purple)" icon={<Boxes/>} onClick={() => go('estoque')}/>
          </div>
          <div className="owner-grid owner-overview-charts">
            <Card title="Leite coletado" eyebrow="A ORIGEM DE TUDO" subtitle="Volume diário e referência do período anterior" chip="LITROS / DIA" chipTone="blue"><ChartSummary values={[[`${formatNumber(totalCollected)} L`, growth === null ? 'Sem comparação' : `${growth >= 0 ? '↗' : '↘'} ${formatNumber(Math.abs(growth), 1)}%`], [`Média de ${formatNumber(totalCollected / Math.max(1, scoped.days.length))} L/dia`, '']]}/><div className="owner-chart owner-large"><LineChart labels={scoped.days.map((day) => shortDate(day.date))} series={[{ name: 'Período anterior', values: scoped.days.map((day) => day.previousCollected), color: 'var(--owner-muted)' }, { name: 'Leite coletado', values: scoped.days.map((day) => day.collected), color: 'var(--owner-blue)' }]} format={(value) => `${compact(value)} L`}/></div><CardFooter><Legend items={[['var(--owner-blue)', 'Coleta realizada'], ['var(--owner-muted)', 'Período anterior']]}/></CardFooter></Card>
            <Card title="Produção por dia de origem" eyebrow="TRANSFORMAÇÃO INDUSTRIAL" subtitle="Kg finais dos lotes com embalagem encerrada" chip="KG / DIA" chipTone="green"><ChartSummary values={[[`${formatNumber(finalWeight)} kg`, `${closed.length} lotes fechados`], [`${open.length} pendentes`, '']]}/><div className="owner-chart owner-large"><BarChart labels={scoped.days.map((day) => shortDate(day.date))} series={scopedProducts.map((product, index) => ({ name: product.short, values: scoped.days.map((day) => sumBy(closed.filter((lot) => lot.date === day.date && lot.productId === product.id), (lot) => lot.weight)), color: productColor(product, index) }))} stacked format={(value) => `${compact(value)} kg`}/></div><CardFooter><Legend items={scopedProducts.map((product, index) => [productColor(product, index), product.short])}/></CardFooter></Card>
          </div>
        </section>

        <section id="captacao" className="owner-section"><SectionTitle number="01" title="Captação & matéria-prima" description="O leite antes de virar produto" scope="Período selecionado · todas as rotas"/><div className="owner-grid owner-cols-3">
          <Card title="Do campo à produção" subtitle="Aplicação registrada dos litros no período" icon={<Droplets/>}><DonutChart items={[{ name: 'Aplicado em queijo', value: milkApplied, color: 'var(--owner-blue)' }, { name: 'Outros destinos / saldo', value: Math.max(0, totalCollected - milkApplied), color: 'var(--owner-cyan)' }]} center={compact(totalCollected)} unit="L"/><CardFooter>Baseada somente nos registros de coleta e formulação</CardFooter></Card>
          <Card title="Desempenho das rotas" subtitle="Última coleta registrada · clique para detalhar" chip={milk ? `${milk.rotas.length} ROTAS` : 'SEM DADOS'}><div className="owner-rank-list">{milk?.rotas.length ? milk.rotas.map((route, index, routes) => <button className="owner-rank-row" type="button" key={route.id} onClick={() => showRoute(route)}><div className="owner-rank-title"><span><i>0{index + 1}</i> {route.nome}</span><strong>{formatNumber(route.litros)} L</strong></div><Progress value={route.litros} max={Math.max(...routes.map((item) => item.litros), 1)} color={fallbackTones[index % fallbackTones.length]}/></button>) : <Empty>{milk ? 'Nenhuma rota encontrada na última coleta.' : 'Dados de rota indisponíveis.'}</Empty>}</div><CardFooter><span>{milk ? `${sumBy(milk.rotas, (route) => route.produtores)} produtores atendidos` : '—'}</span></CardFooter></Card>
          <Card title="Qualidade da matéria-prima" subtitle="Últimas análises registradas" chip={quality ? `${formatNumber(quality.conformity, 1)}% CONFORMIDADE` : 'SEM DADOS'} chipTone="green"><div className="owner-quality-metrics">{[['Gordura', quality?.fat, '%'], ['Proteína', quality?.protein, '%'], ['Sólidos totais', quality?.solids, '%'], ['CCS', quality?.ccs, 'mil cél./mL'], ['CBT', quality?.cbt, 'mil UFC/mL'], ['Analisados', quality?.analyzed, 'produtores']].map(([label, value, unit]) => <div className="owner-quality-metric" key={String(label)}><strong>{value == null ? '—' : formatNumber(Number(value), typeof value === 'number' && !Number.isInteger(value) ? 2 : 0)} {value == null ? null : <small>{unit}</small>}</strong><span>{label}</span></div>)}</div><div className="owner-quality-strip"><span><i className="owner-live-dot"/> {quality ? `${Math.max(0, quality.analyzed - quality.issues.length)} produtores sem ocorrência entre os analisados` : 'Análises indisponíveis'}</span></div><CardFooter>{quality ? `${quality.missing} produtores ainda sem análise` : '—'}</CardFooter></Card>
        </div></section>

        <section id="producao" className="owner-section"><SectionTitle number="02" title="Produção & eficiência" description="O resultado respeita o tempo do lote" action={<button type="button" className="owner-text-btn" onClick={() => setModal({ title: 'Como o rendimento é apurado', body: <p>O rendimento ponderado soma o leite e o peso final dos mesmos lotes encerrados.</p> })}>Entenda o rendimento ⓘ</button>}/><div className="owner-flow-strip">{(['format', 'waiting', 'packing', 'closed'] as Lot['state'][]).map((state, index) => { const rows = lots.filter((lot) => lot.state === state); return <button type="button" className="owner-flow-step" key={state} onClick={() => inspectLots(state)}><span><i className={`owner-dot ${state === 'closed' ? 'is-green' : state === 'packing' ? 'is-amber' : ''}`}/>{states[state]} <small>0{index + 1} ↗</small></span><strong>{rows.length}</strong><small> lotes</small><p>{formatNumber(sumBy(rows, (lot) => lot.milk))} L {state === 'closed' ? 'consolidados' : 'aplicados · peso pendente'}</p></button> })}</div>
          <div className="owner-grid owner-production-detail">
            <Card title="Rendimento por produto" subtitle="Litros por kg final · mesma base de lotes fechados" chip="L/KG"><div className="owner-yield-list">{scopedProducts.map((product, index) => { const rows = closed.filter((lot) => lot.productId === product.id); const weight = sumBy(rows, (lot) => lot.weight); const value = weight ? sumBy(rows, (lot) => lot.milk) / weight : null; return <div className="owner-yield-row" key={product.id}><div className="owner-rank-title"><span>{product.name}</span><strong>{value === null ? '—' : formatNumber(value, 2)} <i>L/kg</i></strong></div><Progress value={value ?? 0} max={14} color={productColor(product, index)}/><div className="owner-yield-note"><span>{rows.length} lotes · {formatNumber(weight)} kg</span><span>Sem referência cadastrada</span></div></div> })}</div><CardFooter><Legend items={[['var(--owner-green)', 'Apurado']]}/><span>Menos L/kg = mais kg por litro</span></CardFooter></Card>
            <Card title="Composição da produção" subtitle="Somente peso final · período selecionado" icon={<PieChart/>}><DonutChart items={scopedProducts.map((product, index) => ({ name: product.short, value: sumBy(closed.filter((lot) => lot.productId === product.id), (lot) => lot.weight), color: productColor(product, index) }))} center={compact(finalWeight)} unit="kg"/><CardFooter><span>{scopedProducts.length} produtos</span><span>{closed.length} lotes na composição</span></CardFooter></Card>
            <Card title="Creme & soro" subtitle="Complementares · todas as linhas" chip="SUBPRODUTOS" chipTone="purple"><div className="owner-byproduct-values"><div><span>CREME PRODUZIDO</span><strong>{compact(sumBy(scoped.days, (day) => day.creamKg))} <i>kg</i></strong></div><div><span>SORO REGISTRADO</span><strong>{compact(sumBy(scoped.days, (day) => day.wheyLiters))} <i>L</i></strong></div></div><div className="owner-chart owner-small"><LineChart labels={scoped.days.map((day) => shortDate(day.date))} series={[{ name: 'Creme', values: scoped.days.map((day) => day.creamKg), color: 'var(--owner-purple)' }]} format={(value) => `${formatNumber(value)} kg`}/></div><CardFooter>Evolução do creme em kg/dia</CardFooter></Card>
          </div>
          <Card title="Mapa de fechamento da produção" subtitle="Cada coluna é um dia de produção. Fechar depois atualiza o dia de origem." action={<Legend items={[['var(--owner-green)', 'Fechado'], ['var(--owner-amber)', 'Parcial'], ['var(--owner-muted)', 'Aguardando']]}/>}><div className="owner-closure-map">{scoped.days.map((day) => { const rows = lots.filter((lot) => lot.date === day.date); const closedRows = rows.filter((lot) => lot.state === 'closed'); const percentage = rows.length ? closedRows.length / rows.length * 100 : 0; const weight = sumBy(closedRows, (lot) => lot.weight); return <button type="button" className={`owner-closure-day ${percentage === 100 ? '' : percentage ? 'is-partial' : 'is-empty'}`} key={day.date} onClick={() => inspectLots('all', day.date)}><span>{shortDate(day.date)} <i>{closedRows.length}/{rows.length}</i></span><strong>{weight ? formatNumber(weight) : '—'} <i>kg</i></strong><small>{percentage === 100 ? 'Fechamento completo' : percentage ? 'Resultado parcial' : 'Aguardando peso'}</small><Progress value={percentage} max={100} color={percentage === 100 ? 'var(--owner-green)' : 'var(--owner-amber)'}/></button> })}</div><CardFooter><span>{scoped.days.filter((day) => { const rows = lots.filter((lot) => lot.date === day.date); return rows.length > 0 && rows.every((lot) => lot.state === 'closed') }).length} dias totalmente fechados</span><button type="button" className="owner-text-btn" onClick={() => inspectLots('open')}>Inspecionar lotes abertos ↗</button></CardFooter></Card>
        </section>

        <section id="qualidade" className="owner-section"><SectionTitle number="03" title="Qualidade & controle de processo" description="Os detalhes que protegem o resultado" scope="Últimos registros disponíveis"/><div className="owner-grid owner-quality-grid">
          <Card title="Histórico do pasteurizador" subtitle="Últimas 24 horas registradas pelo equipamento" chip={pasteurizer?.temperatureMetrics?.updatedAt ? `ATUALIZADO ${formatDateTime(pasteurizer.temperatureMetrics.updatedAt)}` : 'SEM REGISTRO'} chipTone="amber"><div className="owner-process-metrics">{[['ÚLTIMA AMOSTRA', pasteurizer?.temperatures.at(-1)?.value], ['MÍNIMA', pasteurizer?.temperatureMetrics?.min], ['MÉDIA', pasteurizer?.temperatureMetrics?.avg], ['MÁXIMA', pasteurizer?.temperatureMetrics?.max]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value == null ? '—' : formatNumber(Number(value), 1)} <i>°C</i></strong></div>)}</div><div className="owner-chart owner-medium"><LineChart labels={(pasteurizer?.temperatures ?? []).map((item) => item.hour)} series={[{ name: 'Temperatura', values: (pasteurizer?.temperatures ?? []).map((item) => item.value), color: 'var(--owner-amber)' }]} format={(value) => `${formatNumber(value, 1)} °C`}/></div><CardFooter><Legend items={[['var(--owner-amber)', 'Temperatura registrada']]}/><span>Dados reais · conforme a última sincronização</span></CardFooter></Card>
          <Card title="Ocorrências de qualidade" subtitle="Produtores que merecem acompanhamento" chip={`${quality?.issues.length ?? 0} OCORRÊNCIAS`} chipTone="red"><div className="owner-issue-list">{quality?.issues.length ? quality.issues.map((issue, index) => <div className="owner-issue-row" key={`${issue.producer}-${index}`}><span>0{index + 1}</span><div><strong>{issue.producer}</strong><p>{issue.route}</p><p>{issue.issue}</p></div><i>{issue.value}</i></div>) : <Empty>Nenhuma ocorrência encontrada no período.</Empty>}</div><CardFooter>Ocorrências das análises · sem bloqueio automático de lote</CardFooter></Card>
        </div></section>

        <section id="estoque" className="owner-section"><SectionTitle number="04" title="Estoque & expedição" description="Produto pronto, compromissos e abastecimento" scope="Posição atual · todos os produtos"/><div className="owner-grid owner-stock-grid">
          <Card title="Estoque de produto acabado" subtitle="Disponível e reservado por produto" chip="KG" chipTone="blue"><div className="owner-chart owner-medium"><BarChart labels={(shipping?.productStock ?? []).map((stock) => normalizeProductName(stock.product))} series={[{ name: 'Livre de reserva', values: (shipping?.productStock ?? []).map((stock) => Math.max(0, stock.available - stock.reserved)), color: 'var(--owner-blue)' }, { name: 'Reservado', values: (shipping?.productStock ?? []).map((stock) => stock.reserved), color: 'var(--owner-purple)' }]} stacked format={(value) => `${compact(value)} kg`}/></div><CardFooter><Legend items={[['var(--owner-blue)', 'Livre de reserva'], ['var(--owner-purple)', 'Reservado']]}/><span>{formatNumber(physicalStock)} kg físicos</span></CardFooter></Card>
          <Card title="Insumos essenciais" subtitle="Saldo atual e estoque mínimo cadastrado" chip={dashboard.estoque.data ? `${lowInventory.length} ABAIXO DO MÍNIMO` : 'SEM DADOS'} chipTone="amber"><div className="owner-inventory-list">{inventory.length ? inventory.map((item) => { const max = item.max && item.max > 0 ? item.max : Math.max(item.stock, item.min, 1) * 1.25; return <div className="owner-inventory-row" key={item.name}><div className="owner-rank-title"><span>{normalizeProductName(item.name)}</span><strong className={item.stock <= item.min ? 'is-amber' : ''}>{formatNumber(item.stock)} {item.unit}</strong></div><Progress value={item.stock} max={max} marker={item.min / max * 100} color={item.stock <= item.min ? 'var(--owner-amber)' : 'var(--owner-green)'}/><p>Mín. {formatNumber(item.min)} {item.unit}{item.stock < item.min ? ` · Repor ${formatNumber(item.min - item.stock)} ${item.unit}` : ''}</p></div>}) : <Empty>{dashboard.estoque.data ? 'Nenhum insumo ativo cadastrado.' : 'Dados de insumos indisponíveis.'}</Empty>}</div></Card>
          <Card title="Saúde do estoque" subtitle="Validade, permanência e combustível" icon={<ShieldCheck/>}><div className="owner-health-stat"><span>Validade em até 7 dias</span><strong className="is-amber">{shipping ? formatNumber(expiringStock) : '—'} {shipping ? <i>kg</i> : null}</strong><p>Priorizar giro dos lotes com menor validade</p></div><div className="owner-health-stat"><span>Permanência média ponderada</span><strong>{shipping ? formatNumber(weightedAging(shipping.productStock), 1) : '—'} {shipping ? <i>dias</i> : null}</strong><p>Considerando o peso físico de cada produto</p></div><div className="owner-health-stat"><span>Combustível disponível</span><strong>{fuel ? formatNumber(fuel.estoque_atual_litros) : '—'} {fuel ? <i>L</i> : null}</strong>{fuel ? <><Progress value={fuel.estoque_atual_litros} max={fuel.capacidade_litros || 1} color="var(--owner-amber)"/><p>{formatNumber(fuel.porcentagem)}% de {formatNumber(fuel.capacidade_litros)} L de capacidade</p></> : <p>Dados de combustível indisponíveis.</p>}</div></Card>
        </div>
          <Card title="Agenda de expedição" subtitle="Carregamentos recentes e programados" action={<div className="owner-segmented"><button type="button" aria-pressed={shipmentFilter === 'all'} onClick={() => setShipmentFilter('all')}>Todos</button><button type="button" aria-pressed={shipmentFilter === 'pending'} onClick={() => setShipmentFilter('pending')}>Pendentes</button></div>}><div className="owner-table-scroll"><table><thead><tr><th>Carregamento</th><th>Cliente / destino</th><th>Data</th><th className="owner-num">Peso</th><th>Carregado</th><th>Situação</th><th/></tr></thead><tbody>{(shipping?.shipments ?? []).filter((item) => shipmentFilter === 'all' || item.status !== 'Concluída').map((shipment) => <tr key={shipment.id}><td><strong>{shipment.id}</strong></td><td><strong>{shipment.client}</strong><small>{shipment.destination}</small></td><td>{formatDate(shipment.date)}</td><td className="owner-num">{formatNumber(shipment.kg)} kg</td><td><div className="owner-loading-cell"><Progress value={shipment.progress} max={100} color={shipment.status === 'Concluída' ? 'var(--owner-green)' : 'var(--owner-blue)'}/><span>{formatNumber(shipment.progress)}%</span></div></td><td><Badge state={shipment.status}/></td><td><button type="button" className="owner-text-btn" aria-label={`Detalhes de ${shipment.id}`} onClick={() => setModal({ title: `${shipment.id} · ${shipment.client}`, body: <><p>{shipment.destination} · {formatDate(shipment.date)}</p><DetailGrid values={[["PESO DA CARGA", `${formatNumber(shipment.kg)} kg`], ["PROGRESSO", `${formatNumber(shipment.progress)}%`], ["SITUAÇÃO", shipment.status]]}/></> })}>↗</button></td></tr>)}</tbody></table></div></Card>
        </section>

        <section id="lotes" className="owner-section"><SectionTitle number="05" title="Rastreabilidade da produção" description="Do indicador até o lote que o compõe" action={<button type="button" className="owner-text-btn" onClick={exportLots}><Download size={13}/> Exportar lotes</button>}/><Card><div className="owner-lot-toolbar"><label className="owner-search-box"><Search size={13}/><input type="search" placeholder="Buscar OP ou produto…" aria-label="Buscar ordem ou produto" value={lotSearch} onChange={(event) => setLotSearch(event.target.value)}/></label><select aria-label="Situação dos lotes" value={lotState} onChange={(event) => setLotState(event.target.value as LotState)}><option value="all">Todas as situações</option><option value="open">Todos os abertos</option><option value="closed">Embalagem encerrada</option><option value="packing">Em embalagem</option><option value="waiting">Aguardando embalagem</option><option value="format">Aguardando formato</option></select>{lotDate ? <button type="button" className="owner-text-btn" onClick={() => setLotDate(null)}>Limpar dia {formatDate(lotDate)}</button> : null}<span>{pagedLots.length} lotes encontrados</span></div><div className="owner-table-scroll"><table><thead><tr><th>Ordem / lote</th><th>Produto</th><th>Produção</th><th className="owner-num">Leite aplicado</th><th className="owner-num">Peso final</th><th className="owner-num">L/kg</th><th>Situação</th><th>Embalagem encerrada</th><th/></tr></thead><tbody>{visibleLots.length ? visibleLots.map((lot) => <tr key={lot.id}><td><button type="button" className="owner-table-link" onClick={() => showLot(lot)}>{lot.id}</button></td><td>{products.find((item) => item.id === lot.productId)?.name ?? lot.productId}</td><td>{formatDate(lot.date)}</td><td className="owner-num">{formatNumber(lot.milk)} L</td><td className="owner-num">{lot.weight === null ? '—' : `${formatNumber(lot.weight)} kg`}</td><td className="owner-num">{lot.weight ? formatNumber(lot.milk / lot.weight, 2) : '—'}</td><td><LotBadge state={lot.state}/></td><td>{lot.closedAt ? formatDateTime(lot.closedAt) : '—'}</td><td><button type="button" className="owner-text-btn" aria-label={`Detalhes de ${lot.id}`} onClick={() => showLot(lot)}>↗</button></td></tr>) : <tr><td colSpan={9}><Empty>Nenhum lote encontrado para estes filtros.</Empty></td></tr>}</tbody></table></div><div className="owner-pagination"><span>Peso pendente é excluído do rendimento.</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>←</button><span>Página {Math.min(page, pageCount)} de {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>→</button></div></div></Card></section>

        <div className="owner-grid owner-closing-grid"><Card title="Últimos movimentos" subtitle="Linha do tempo dos dados operacionais" icon={<Clock3/>}><div className="owner-events">{buildEvents({ milk, production, quality, shipping, fuel, pasteurizer }).map((event) => <div className="owner-event" key={event.title}><i className={`is-${event.tone}`}/><div><time>{event.time}</time><strong>{event.title}</strong><p>{event.detail}</p></div></div>)}</div></Card><Card title="Leitura da diretoria" subtitle="Os principais pontos do período selecionado" chip="RESUMO EXECUTIVO" chipTone="green"><div className="owner-executive-notes"><ExecutiveNote number="01">A coleta média foi de <strong>{formatNumber(totalCollected / Math.max(1, scoped.days.length))} L/dia</strong>{growth === null ? '.' : `, ${formatNumber(Math.abs(growth), 1)}% ${growth >= 0 ? 'acima' : 'abaixo'} do período anterior.`}</ExecutiveNote><ExecutiveNote number="02"><strong>{formatNumber(coverage)}% dos lotes selecionados estão fechados.</strong> {open.length} ainda não entram no rendimento.</ExecutiveNote><ExecutiveNote number="03"><strong>{formatNumber(Math.max(0, physicalStock - reservedStock))} kg livres de reserva</strong> e {formatNumber(expiringStock)} kg com validade em até 7 dias.</ExecutiveNote></div></Card></div>
        <footer className="owner-page-footer"><span>Santi&apos;Lac <b>Inteligência da operação</b></span><span>Dados reais conforme os registros do sistema</span><button type="button" className="owner-text-btn" onClick={() => go('overview')}>Voltar ao topo ↑</button></footer>
      </div>
    </main>
    {modal ? <div className="owner-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><div className="owner-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-dialog-title"><header><div><span className="owner-eyebrow">DETALHAMENTO · DADOS DO SISTEMA</span><h2 id="owner-dialog-title">{modal.title}</h2></div><button type="button" className="owner-icon-btn" aria-label="Fechar detalhes" onClick={() => setModal(null)}><X size={16}/></button></header><div>{modal.body}</div></div></div> : null}
    {toast ? <div className="owner-toast" role="status">{toast}</div> : null}
  </div>
}

function OwnerSidebar({ active, onGo, onToggleTheme }: { active: string; onGo: (section: string) => void; onToggleTheme: () => void }) {
  const links = [
    ['overview', 'Visão geral', LayoutDashboard], ['captacao', 'Captação de leite', Droplets], ['producao', 'Produção e rendimento', Factory],
    ['qualidade', 'Qualidade e processo', FlaskConical], ['estoque', 'Estoque e expedição', Box], ['lotes', 'Todos os lotes', List],
  ] as const
  return <aside className="owner-sidebar"><button type="button" className="owner-brand" onClick={() => onGo('overview')}><img src="/assets/img/logo.png" alt="Santi'Lac"/><span>INTELIGÊNCIA DA OPERAÇÃO</span></button><div className="owner-nav-label">GESTÃO EXECUTIVA</div><nav aria-label="Seções da dashboard">{links.map(([section, label, Icon]) => <button type="button" key={section} className={active === section ? 'is-active' : ''} aria-current={active === section ? 'location' : undefined} onClick={() => onGo(section)}><Icon/><span>{label}</span></button>)}</nav><div className="owner-side-insight"><i className="owner-live-dot"/><strong>Da coleta ao resultado.</strong><p>Volume, eficiência e rastreabilidade.<br/>Uma visão de toda a fábrica.</p><span className="owner-demo-label">DADOS DO SISTEMA</span></div><div className="owner-sidebar-bottom"><div className="owner-profile"><span>SL</span><div><strong>Diretoria</strong><small>Santi&apos;Lac · Gestão industrial</small></div><button type="button" className="owner-icon-btn" aria-label="Alternar tema" onClick={onToggleTheme}>{document.documentElement.dataset.theme === 'light' ? <Moon size={14}/> : <Sun size={14}/>}</button></div></div></aside>
}

function Kpi({ label, value, unit, note, caption, values, color, icon, onClick }: { label: string; value: string; unit: string; note: string; caption: string; values: Array<number | null>; color: string; icon: ReactNode; onClick: () => void }) {
  return <button type="button" className="owner-kpi" onClick={onClick}><div className="owner-kpi-top"><span>{label}</span>{icon}</div><div className="owner-kpi-middle"><strong>{value} {value === '—' ? null : <i>{unit}</i>}</strong><Sparkline values={values} color={color}/></div><div className="owner-kpi-note">{note}</div><div className="owner-kpi-caption">{caption}</div></button>
}

function Card({ title, subtitle, eyebrow, chip, chipTone = '', icon, action, children }: { title?: string; subtitle?: string; eyebrow?: string; chip?: string; chipTone?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <article className="owner-card">{title ? <header className="owner-card-head"><div>{eyebrow ? <span className="owner-eyebrow">{eyebrow}</span> : null}<h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action ?? (chip ? <span className={`owner-chip ${chipTone}`}>{chip}</span> : icon ? <span className="owner-muted">{icon}</span> : null)}</header> : null}{children}</article>
}

function SectionTitle({ number, title, description, scope, action }: { number: string; title: string; description: string; scope?: string; action?: ReactNode }) { return <div className="owner-section-title"><span>{number}</span><h2>{title}</h2><p>{description}</p>{action ?? (scope ? <small>{scope}</small> : null)}</div> }
function CardFooter({ children }: { children: ReactNode }) { return <div className="owner-card-footer">{children}</div> }
function Legend({ items }: { items: Array<[string, string]> }) { return <div className="owner-legend">{items.map(([color, label]) => <span key={label}><i style={{ background: color }}/>{label}</span>)}</div> }
function ChartSummary({ values }: { values: Array<[string, string]> }) { return <div className="owner-chart-summary">{values.map(([value, label]) => <span key={value}><strong>{value}</strong>{label ? <i>{label}</i> : null}</span>)}</div> }
function Progress({ value, max, color, marker }: { value: number; max: number; color: string; marker?: number }) { const percentage = Math.min(100, Math.max(0, value / Math.max(1, max) * 100)); return <div className="owner-progress"><span style={{ width: `${percentage}%`, background: color }}/>{marker !== undefined ? <i style={{ left: `${Math.min(100, Math.max(0, marker))}%` }}/> : null}</div> }
function LotBadge({ state }: { state: Lot['state'] }) { return <span className={`owner-chip ${state === 'closed' ? 'green' : state === 'packing' ? 'amber' : ''}`}>{states[state]}</span> }
function Badge({ state }: { state: string }) { return <span className={`owner-chip ${state === 'Concluída' ? 'green' : state === 'Carregando' ? 'blue' : ''}`}>{state}</span> }
function DetailGrid({ values }: { values: Array<[string, string]> }) { return <div className="owner-detail-grid">{values.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div> }
function Empty({ children }: { children: ReactNode }) { return <div className="owner-empty">{children}</div> }
function ExecutiveNote({ number, children }: { number: string; children: ReactNode }) { return <div className="owner-executive-note"><span>{number}</span><p>{children}</p></div> }

function mergeDays(milk: NonNullable<Dashboard['leite']['data']>['serie_diaria'], production: NonNullable<Dashboard['producao']['data']>['days'], dispatched: NonNullable<Dashboard['expedicao']['data']>['dispatchedDays']) {
  const map = new Map<string, { date: string; collected: number; previousCollected: number; producers: number; cheeseMilk: number; creamKg: number; wheyLiters: number; dispatchedKg: number }>()
  const get = (date: string) => { const current = map.get(date) ?? { date, collected: 0, previousCollected: 0, producers: 0, cheeseMilk: 0, creamKg: 0, wheyLiters: 0, dispatchedKg: 0 }; map.set(date, current); return current }
  milk.forEach((day) => Object.assign(get(day.data), { collected: day.litros, previousCollected: day.litros_periodo_anterior, producers: day.produtores }))
  production.forEach((day) => Object.assign(get(day.date), { cheeseMilk: day.cheeseMilk, creamKg: day.creamKg, wheyLiters: day.wheyLiters }))
  dispatched.forEach((day) => Object.assign(get(day.date), { dispatchedKg: day.kg }))
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
}
function dayYield(lots: Lot[]) { const weight = sumBy(lots, (lot) => lot.weight); return weight ? sumBy(lots, (lot) => lot.milk) / weight : 0 }
function shortDate(value: string) { return value ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : '—' }
function formatDate(value: string) { if (!value) return '—'; const [year, month, day] = value.slice(0, 10).split('-'); return `${day}/${month}/${year}` }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }
function productColor(product: Product, index: number) { return product.color || fallbackTones[index % fallbackTones.length] }
function weightedAging(stock: Array<{ available: number; agingDays: number }>) { const total = sumBy(stock, (item) => item.available); return total ? sumBy(stock, (item) => item.available * item.agingDays) / total : 0 }
async function toggleFullscreen(element: HTMLElement | null, notify: (message: string) => void) { try { if (document.fullscreenElement) await document.exitFullscreen(); else await element?.requestFullscreen() } catch { notify('Tela cheia indisponível neste navegador.') } }
function buildEvents(input: { milk: Dashboard['leite']['data']; production: Dashboard['producao']['data']; quality: NonNullable<Dashboard['qualidade']['data']>['quality'] | undefined; shipping: Dashboard['expedicao']['data']; fuel: Dashboard['combustivel']['data']; pasteurizer: Dashboard['pasteurizador']['data'] }) {
  const events: Array<{ time: string; title: string; detail: string; tone: 'green' | 'amber' | 'blue' }> = []
  const openLots = input.production?.lotes.filter((lot) => lot.state !== 'closed').length ?? 0
  if (input.shipping?.shipments[0]) events.push({ time: formatDate(input.shipping.shipments[0].date), title: `Expedição ${input.shipping.shipments[0].status.toLocaleLowerCase('pt-BR')}`, detail: `${input.shipping.shipments[0].client} · ${formatNumber(input.shipping.shipments[0].kg)} kg`, tone: input.shipping.shipments[0].status === 'Concluída' ? 'green' : 'blue' })
  if (openLots) events.push({ time: 'Produção', title: `${openLots} lotes com resultado em formação`, detail: 'O peso final ainda não entra no rendimento consolidado.', tone: 'amber' })
  if (input.quality?.issues.length) events.push({ time: 'Qualidade', title: `${input.quality.issues.length} ocorrências para acompanhamento`, detail: `Atualizado em ${input.quality.updatedAt ? formatDate(input.quality.updatedAt) : 'data não informada'}.`, tone: 'amber' })
  if (input.pasteurizer?.temperatureMetrics) events.push({ time: formatDateTime(input.pasteurizer.temperatureMetrics.updatedAt), title: `Pasteurizador em ${formatNumber(input.pasteurizer.temperatures.at(-1)?.value ?? 0, 1)} °C`, detail: `Mínima ${formatNumber(input.pasteurizer.temperatureMetrics.min, 1)} °C · máxima ${formatNumber(input.pasteurizer.temperatureMetrics.max, 1)} °C.`, tone: 'green' })
  if (input.fuel) events.push({ time: 'Atual', title: `Combustível em ${formatNumber(input.fuel.porcentagem)}%`, detail: `${formatNumber(input.fuel.estoque_atual_litros)} L de ${formatNumber(input.fuel.capacidade_litros)} L.`, tone: input.fuel.porcentagem < 25 ? 'amber' : 'blue' })
  if (input.milk?.atualizado_em) events.push({ time: formatDateTime(input.milk.atualizado_em), title: 'Última coleta sincronizada', detail: `${input.milk.rotas.length} rotas na última coleta registrada.`, tone: 'green' })
  return events.slice(0, 6)
}
