import { Factory, Gauge, Route, Thermometer } from 'lucide-react'
import type { DashboardOperationalData } from '../api/dashboardOperationalTypes'
import type { DashboardResumoSnapshot, LoteProducao } from '../api/dashboardResumoTypes'
import { DashboardKpi, EmptyMessage, Panel, StatusPill, TextAction, TrendChart } from '../components/OperationalDashboardUi'
import { buildPasteurizerSummary, formatClock, formatCompactNumber } from '../shared/dashboardInsights'
import { formatDate } from '../shared/formatters'
import { openHash, pasteurizadorHash } from '../shared/navigation'

export function OperationsDashboardView({ snapshot, operacional }: { snapshot: DashboardResumoSnapshot; operacional: DashboardOperationalData }) {
  const daily = snapshot.resumoDiario
  const pasteurizer = buildPasteurizerSummary(daily.pasteurizador)
  const activeRoutes = operacional.rotas.filter((route) => !/conclu|finaliz|encerr/i.test(route.status_label))
  const routeLiters = operacional.rotas.reduce((sum, route) => sum + route.total_litros, 0)
  const lots = daily.producao.lotes.length ? daily.producao.lotes : snapshot.homeResumo.producao.lotes
  const timeline = buildTimeline(operacional, lots, pasteurizer.series.at(-1)?.label)

  return (
    <div className="od-view od-operations-view">
      <section className="od-kpi-grid">
        <DashboardKpi icon={Route} label="Rotas em campo" value={String(activeRoutes.length)} detail={`${operacional.rotas.length} rota(s) no dia`} tone={activeRoutes.length ? 'info' : 'neutral'} onClick={() => openHash('#/coletas/rotas')} />
        <DashboardKpi icon={Gauge} label="Volume em rotas" value={formatCompactNumber(routeLiters, ' L')} detail={`${operacional.rotas.reduce((sum, route) => sum + route.total_coletas, 0)} coleta(s) registradas`} tone="success" trend={operacional.rotas.map((route) => ({ value: route.total_litros }))} onClick={() => openHash('#/coletas/rotas')} />
        <DashboardKpi icon={Factory} label="Produção do dia" value={formatCompactNumber(daily.producao.litros, ' L')} detail={`${daily.producao.total_lotes} lote(s) em ${formatDate(daily.data)}`} tone="info" trend={lots.map((lot) => ({ value: lot.litros }))} onClick={() => openHash(snapshot.rotas.producao)} />
        <DashboardKpi icon={Thermometer} label="Pasteurização" value={pasteurizer.current === null ? '—' : `${pasteurizer.current.toFixed(1)} °C`} detail={pasteurizer.continuousMinutes === null ? pasteurizer.label : `${pasteurizer.continuousMinutes} min contínuos ≥ 72 °C`} tone={pasteurizer.inRange === null ? 'neutral' : pasteurizer.inRange ? 'success' : 'danger'} trend={pasteurizer.series} onClick={() => openHash(pasteurizadorHash(daily.pasteurizador))} />
      </section>

      <section className="od-operations-main">
        <Panel title="Linha do tempo operacional" subtitle={`Eventos consolidados de ${formatDate(daily.data)}`} action={<StatusPill tone={timeline.length ? 'info' : 'neutral'}>{timeline.length} evento(s)</StatusPill>} className="od-timeline-panel">
          {timeline.length ? <div className="od-timeline">
            {timeline.map((event, index) => (
              <button key={`${event.time}-${event.title}-${index}`} type="button" onClick={() => openHash(event.href)}>
                <span className={`od-timeline-dot is-${event.tone}`} />
                <time>{event.time}</time>
                <span><strong>{event.title}</strong><small>{event.detail}</small></span>
                <em>→</em>
              </button>
            ))}
          </div> : <EmptyMessage>Nenhum evento operacional localizado para a data selecionada.</EmptyMessage>}
        </Panel>

        <Panel title="Temperatura de pasteurização" subtitle="Canal Temp.Pasteuriza · faixa operacional 72–75 °C" action={<StatusPill tone={pasteurizer.inRange === null ? 'neutral' : pasteurizer.inRange ? 'success' : 'danger'}>{pasteurizer.label}</StatusPill>} className="od-temperature-panel">
          <div className="od-temperature-summary">
            <div><span>Atual</span><strong>{pasteurizer.current === null ? '—' : `${pasteurizer.current.toFixed(1)} °C`}</strong></div>
            <div><span>Média</span><strong>{pasteurizer.average === null ? '—' : `${pasteurizer.average.toFixed(1)} °C`}</strong></div>
            <div><span>Contínuo ≥ 72 °C</span><strong>{pasteurizer.continuousMinutes === null ? '—' : `${pasteurizer.continuousMinutes} min`}</strong></div>
          </div>
          <TrendChart points={pasteurizer.series} tone={pasteurizer.inRange === false ? 'danger' : 'success'} unit=" °C" benchmark={72} onClick={() => openHash(pasteurizadorHash(daily.pasteurizador))} />
          <div className="od-chart-footer"><span>A linha tracejada marca o limite inferior operacional.</span><TextAction onClick={() => openHash(pasteurizadorHash(daily.pasteurizador))}>Abrir histórico</TextAction></div>
        </Panel>
      </section>

      <section className="od-operations-bottom">
        <Panel title="Rotas de coleta" subtitle="Status, volume e movimentação" action={<TextAction onClick={() => openHash('#/coletas/rotas')}>Ver todas</TextAction>} className="od-routes-panel">
          {operacional.rotas.length ? <div className="od-data-table od-routes-table">
            <div className="od-table-head"><span>Rota</span><span>Status</span><span>Volume</span><span>Coletas</span><span>Início</span><span /></div>
            {operacional.rotas.slice(0, 5).map((route) => (
              <button key={route.uuid} type="button" onClick={() => openHash(`#/coletas/rotas/${encodeURIComponent(route.uuid)}`)}>
                <span><strong>{route.rota_nome}</strong><small>{route.motorista_nome || 'Sem motorista'}</small></span>
                <StatusPill tone={/conclu|finaliz|encerr/i.test(route.status_label) ? 'success' : 'info'}>{route.status_label}</StatusPill>
                <span>{formatCompactNumber(route.total_litros, ' L')}</span>
                <span>{route.total_coletas}</span>
                <span>{formatClock(route.inicio)}</span>
                <em>→</em>
              </button>
            ))}
          </div> : <EmptyMessage>Nenhuma rota encontrada para a data selecionada.</EmptyMessage>}
        </Panel>

        <Panel title="Lotes de produção" subtitle="Última base produtiva disponível" action={<TextAction onClick={() => openHash(snapshot.rotas.producao)}>Abrir produção</TextAction>} className="od-lots-panel">
          {lots.length ? <div className="od-lot-list">
            {lots.slice(0, 5).map((lot) => (
              <button key={lot.id} type="button" onClick={() => openHash(snapshot.rotas.producao)}>
                <span><strong>{lot.tipo}</strong><small>{lot.lote || 'Lote não informado'}</small></span>
                <span><strong>{formatCompactNumber(lot.litros, ' L')}</strong><StatusPill tone={statusTone(lot.status)}>{lot.status}</StatusPill></span>
              </button>
            ))}
          </div> : <EmptyMessage>Nenhum lote disponível na base atual.</EmptyMessage>}
        </Panel>
      </section>
    </div>
  )
}

function buildTimeline(operacional: DashboardOperationalData, lots: LoteProducao[], lastReading?: string) {
  const events: Array<{ time: string; title: string; detail: string; tone: 'info' | 'success' | 'warning'; href: string }> = []
  operacional.rotas.forEach((route) => {
    events.push({ time: formatClock(route.inicio), title: `${route.rota_nome} iniciou`, detail: `${route.motorista_nome || 'Motorista não informado'} · ${formatCompactNumber(route.total_litros, ' L')}`, tone: 'info', href: `#/coletas/rotas/${encodeURIComponent(route.uuid)}` })
    if (route.fim) events.push({ time: formatClock(route.fim), title: `${route.rota_nome} concluída`, detail: `${route.total_coletas} coleta(s) · ${formatCompactNumber(route.total_litros, ' L')}`, tone: 'success', href: `#/coletas/rotas/${encodeURIComponent(route.uuid)}` })
  })
  lots.slice(0, 2).forEach((lot) => events.push({ time: '—', title: `Lote ${lot.lote || lot.id}`, detail: `${lot.tipo} · ${formatCompactNumber(lot.litros, ' L')} · ${lot.status}`, tone: statusTone(lot.status) === 'success' ? 'success' : 'warning', href: '#/producao/inicio' }))
  if (lastReading) events.push({ time: lastReading, title: 'Pasteurizador atualizado', detail: 'Última leitura do canal selecionado', tone: 'success', href: '#/pasteurizador/historico' })
  return events.slice(0, 7)
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (/finaliz|conclu|ativo|produ/i.test(status)) return 'success'
  if (/rascunho|aguard|pend/i.test(status)) return 'warning'
  return 'neutral'
}
