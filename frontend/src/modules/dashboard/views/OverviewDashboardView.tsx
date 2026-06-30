import { AlertTriangle, Factory, Fuel, Route, ShieldCheck, Thermometer } from 'lucide-react'
import type { DashboardOperationalData } from '../api/dashboardOperationalTypes'
import type { DashboardResumoSnapshot } from '../api/dashboardResumoTypes'
import { DashboardKpi, EmptyMessage, Panel, ProgressBar, StatusPill, TextAction, TrendChart, type DashboardTone } from '../components/OperationalDashboardUi'
import { buildPasteurizerSummary, buildQualitySummary, collectionMovement, formatClock, formatCompactNumber } from '../shared/dashboardInsights'
import { formatDate } from '../shared/formatters'
import { openHash, pasteurizadorHash } from '../shared/navigation'

export function OverviewDashboardView({ snapshot, operacional }: { snapshot: DashboardResumoSnapshot; operacional: DashboardOperationalData }) {
  const home = snapshot.homeResumo
  const quality = buildQualitySummary(operacional.qualidade.analises)
  const pasteurizer = buildPasteurizerSummary(home.pasteurizador)
  const movement = collectionMovement(home.coletas.serie)
  const activeRoutes = operacional.rotas.filter((route) => !/conclu|finaliz|encerr/i.test(route.status_label))
  const lowStock = operacional.estoqueBaixo
  const producerPending = operacional.qualidade.overview?.produtores_sem_analise ?? 0
  const fuel = operacional.combustivel
  const attentionCount = lowStock.length + (producerPending > 0 ? 1 : 0) + (pasteurizer.inRange === false ? 1 : 0) + ((fuel?.porcentagem ?? 100) < 25 ? 1 : 0)
  const collectionTrend = home.coletas.serie.slice(-14).map((item) => ({ label: formatDate(item.data).slice(0, 5), value: item.litros }))

  return (
    <div className="od-view od-overview-view">
      <section className={`od-attention-strip ${attentionCount ? 'has-attention' : 'is-clear'}`}>
        <span className="od-attention-icon"><AlertTriangle size={18} /></span>
        <div>
          <strong>{attentionCount ? `${attentionCount} decisão(ões) precisa(m) de atenção` : 'Operação sem bloqueios críticos'}</strong>
          <p>{attentionCount ? 'Os sinais abaixo estão ordenados por impacto e levam direto ao módulo responsável.' : 'Nenhum estoque crítico, desvio térmico ou nível urgente de combustível foi identificado.'}</p>
        </div>
        <button type="button" onClick={() => openHash(`#/dashboard/riscos?data=${encodeURIComponent(snapshot.data)}`)}>Ver riscos</button>
      </section>

      <section className="od-kpi-grid">
        <DashboardKpi icon={Route} label="Leite coletado" value={formatCompactNumber(home.coletas.litros, ' L')} detail={movement === null ? `Base de ${formatDate(home.coletas.ultima_data)}` : `${movement >= 0 ? '↑' : '↓'} ${Math.abs(movement).toFixed(1)}% vs. média dos 7 registros anteriores`} tone={movement !== null && movement < 0 ? 'warning' : 'success'} trend={home.coletas.serie.slice(-8).map((item) => ({ value: item.litros }))} onClick={() => openHash(snapshot.rotas.coletas)} />
        <DashboardKpi icon={Factory} label="Produção registrada" value={formatCompactNumber(home.producao.litros, ' L')} detail={`${home.producao.lotes.length} lote(s) na base mais recente`} tone="info" trend={home.producao.lotes.slice(-6).map((item) => ({ value: item.litros }))} onClick={() => openHash(snapshot.rotas.producao)} />
        <DashboardKpi icon={ShieldCheck} label="Qualidade dentro do padrão" value={quality.percentage === null ? '—' : `${quality.percentage.toFixed(1)}%`} detail={quality.evaluated ? `${quality.conforming} de ${quality.evaluated} análises avaliadas` : 'Sem análises disponíveis'} tone={quality.percentage === null ? 'neutral' : quality.percentage >= 90 ? 'success' : 'warning'} trend={quality.trend} onClick={() => openHash('#/relatorios')} />
        <DashboardKpi icon={Thermometer} label="Pasteurização agora" value={pasteurizer.current === null ? '—' : `${pasteurizer.current.toFixed(1)} °C`} detail={pasteurizer.continuousMinutes === null ? pasteurizer.label : `${pasteurizer.continuousMinutes} min contínuos ≥ 72 °C`} tone={pasteurizer.inRange === null ? 'neutral' : pasteurizer.inRange ? 'success' : 'danger'} trend={pasteurizer.series} onClick={() => openHash(pasteurizadorHash(home.pasteurizador))} />
      </section>

      <section className="od-overview-main">
        <Panel title="Volume coletado" subtitle="Últimos 14 registros · litros" action={<StatusPill tone="info">{formatCompactNumber(home.coletas.litros, ' L')}</StatusPill>} className="od-volume-panel">
          <TrendChart points={collectionTrend} tone="info" unit=" L" onClick={() => openHash(snapshot.rotas.coletas)} />
          <div className="od-chart-footer">
            <span>Leitura de tendência; passe o mouse nos pontos para ver o valor.</span>
            <TextAction onClick={() => openHash(snapshot.rotas.coletas)}>Abrir coletas</TextAction>
          </div>
        </Panel>

        <Panel title="Prioridades agora" subtitle="Sinais que exigem uma decisão" action={<StatusPill tone={attentionCount ? 'warning' : 'success'}>{attentionCount} aberta(s)</StatusPill>} className="od-priority-panel">
          <div className="od-action-list">
            {lowStock.slice(0, 2).map((item) => (
              <PriorityRow key={item.id} tone="danger" label="Estoque abaixo do mínimo" title={item.nome} detail={`${formatCompactNumber(item.saldo_atual, ` ${item.unidade}`)} disponíveis · mínimo ${formatCompactNumber(item.estoque_minimo, ` ${item.unidade}`)}`} onClick={() => openHash(`#/estoque/item/${item.id}`)} />
            ))}
            {producerPending > 0 ? <PriorityRow tone="warning" label="Qualidade" title={`${producerPending} produtor(es) sem análise`} detail="Acompanhamento pendente no período atual" onClick={() => openHash('#/pendencias')} /> : null}
            {pasteurizer.inRange === false ? <PriorityRow tone="danger" label="Pasteurização" title="Temperatura fora da faixa" detail={`${pasteurizer.current?.toFixed(1)} °C na última leitura`} onClick={() => openHash(pasteurizadorHash(home.pasteurizador))} /> : null}
            {fuel && fuel.porcentagem < 25 ? <PriorityRow tone="warning" label="Combustível" title="Tanque em nível preventivo" detail={`${fuel.porcentagem.toFixed(0)}% da capacidade`} onClick={() => openHash('#/combustivel/inicio')} /> : null}
            {!attentionCount ? <EmptyMessage>Nenhuma ação crítica aberta neste momento.</EmptyMessage> : null}
          </div>
          {attentionCount ? <TextAction onClick={() => openHash(`#/dashboard/riscos?data=${encodeURIComponent(snapshot.data)}`)}>Abrir central de riscos</TextAction> : null}
        </Panel>
      </section>

      <section className="od-signal-grid">
        <Panel title="Rotas" subtitle="Situação do dia" className="od-signal-card">
          <div className="od-signal-value"><strong>{activeRoutes.length}</strong><span>em andamento</span></div>
          <div className="od-mini-list">
            {operacional.rotas.slice(0, 2).map((route) => <button key={route.uuid} type="button" onClick={() => openHash(`#/coletas/rotas/${encodeURIComponent(route.uuid)}`)}><span>{route.rota_nome}</span><strong>{formatCompactNumber(route.total_litros, ' L')}</strong></button>)}
          </div>
          <TextAction onClick={() => openHash('#/coletas/rotas')}>Acompanhar rotas</TextAction>
        </Panel>

        <Panel title="Combustível" subtitle="Nível do tanque" className="od-signal-card">
          {fuel ? <>
            <div className="od-signal-value"><strong>{fuel.porcentagem.toFixed(0)}%</strong><span>{formatCompactNumber(fuel.estoque_atual_litros, ' L')}</span></div>
            <ProgressBar value={fuel.porcentagem} tone={fuel.porcentagem < 25 ? 'warning' : 'info'} />
            <p className="od-signal-note">Última saída: {fuel.ultima_saida ? `${formatCompactNumber(fuel.ultima_saida.quantidade_litros, ' L')} às ${formatClock(fuel.ultima_saida.data_hora)}` : 'sem registro'}</p>
          </> : <EmptyMessage>Fonte de combustível indisponível.</EmptyMessage>}
          <TextAction onClick={() => openHash('#/combustivel/inicio')}>Abrir combustível</TextAction>
        </Panel>

        <Panel title="Produção" subtitle="Pendências operacionais" className="od-signal-card">
          <div className="od-signal-value"><strong>{operacional.producao?.totais.ops_aguardando_formato ?? 0}</strong><span>OPs aguardando formato</span></div>
          <p className="od-signal-note">{operacional.producao?.totais.rascunhos ?? 0} ficha(s) ainda em rascunho.</p>
          <TextAction onClick={() => openHash('#/producao/ordem-producao')}>Abrir produção</TextAction>
        </Panel>

        <Panel title="Pasteurizador" subtitle="Leitura selecionada" className="od-signal-card">
          <div className="od-signal-value"><strong>{pasteurizer.average === null ? '—' : `${pasteurizer.average.toFixed(1)} °C`}</strong><span>média do período</span></div>
          <StatusPill tone={pasteurizer.inRange === null ? 'neutral' : pasteurizer.inRange ? 'success' : 'danger'}>{pasteurizer.label}</StatusPill>
          <TextAction onClick={() => openHash(pasteurizadorHash(home.pasteurizador))}>Abrir histórico</TextAction>
        </Panel>
      </section>
    </div>
  )
}

function PriorityRow({ tone, label, title, detail, onClick }: { tone: DashboardTone; label: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button className="od-priority-row" type="button" onClick={onClick}>
      <span className={`od-priority-mark is-${tone}`} />
      <span><small>{label}</small><strong>{title}</strong><em>{detail}</em></span>
      <span className="od-priority-arrow">→</span>
    </button>
  )
}
