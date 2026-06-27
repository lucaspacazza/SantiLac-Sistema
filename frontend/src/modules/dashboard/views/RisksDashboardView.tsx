import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { DashboardOperationalData } from '../api/dashboardOperationalTypes'
import type { DashboardResumoSnapshot } from '../api/dashboardResumoTypes'
import { EmptyMessage, Panel, ProgressBar, StatusPill, TextAction, TrendChart, type DashboardTone } from '../components/OperationalDashboardUi'
import { buildPasteurizerSummary, buildQualitySummary, formatCompactNumber } from '../shared/dashboardInsights'
import { openHash, pasteurizadorHash } from '../shared/navigation'

export function RisksDashboardView({ snapshot, operacional }: { snapshot: DashboardResumoSnapshot; operacional: DashboardOperationalData }) {
  const quality = buildQualitySummary(operacional.qualidade.analises)
  const pasteurizer = buildPasteurizerSummary(snapshot.resumoDiario.pasteurizador)
  const lowStock = operacional.estoqueBaixo
  const producerPending = operacional.qualidade.overview?.produtores_sem_analise ?? 0
  const fuelLow = operacional.combustivel !== null && operacional.combustivel.porcentagem < 25
  const highRisk = lowStock.length + (pasteurizer.inRange === false ? 1 : 0)
  const mediumRisk = (producerPending > 0 ? 1 : 0) + (fuelLow ? 1 : 0) + quality.criticalAnalyses.length
  const totalRisk = highRisk + mediumRisk
  const maxDeviation = Math.max(...quality.deviations.map((item) => item.count), 1)

  return (
    <div className="od-view od-risks-view">
      <section className={`od-risk-hero ${highRisk ? 'has-high-risk' : totalRisk ? 'has-medium-risk' : 'is-clear'}`}>
        <span className="od-risk-hero-icon">{totalRisk ? <ShieldAlert size={23} /> : <ShieldCheck size={23} />}</span>
        <div><small>LEITURA DE RISCO</small><strong>{totalRisk ? 'Atenção necessária' : 'Operação controlada'}</strong><p>{highRisk} risco(s) alto(s) · {mediumRisk} sinal(is) médio(s) · dados reais dos módulos conectados</p></div>
        <div className="od-risk-hero-count"><strong>{totalRisk}</strong><span>sinal(is)</span></div>
      </section>

      <section className="od-risks-main">
        <Panel title="Qualidade do leite" subtitle={`${quality.evaluated} análises avaliadas pelas regras do módulo`} action={<StatusPill tone={quality.percentage === null ? 'neutral' : quality.percentage >= 90 ? 'success' : 'warning'}>{quality.percentage === null ? 'Sem base' : `${quality.percentage.toFixed(1)}% conforme`}</StatusPill>} className="od-quality-panel">
          <div className="od-quality-summary">
            <div><span>Dentro do padrão</span><strong>{quality.conforming}</strong></div>
            <div><span>Com desvio</span><strong>{quality.criticalAnalyses.length}</strong></div>
            <div><span>Sem análise no período</span><strong>{producerPending}</strong></div>
          </div>
          <TrendChart points={quality.trend} tone="violet" unit="%" onClick={() => openHash('#/relatorios')} />
          <div className="od-chart-footer"><span>Percentual sem desvios em CCS, UFC, composição, ureia e temperatura.</span><TextAction onClick={() => openHash('#/relatorios')}>Abrir relatórios</TextAction></div>
        </Panel>

        <Panel title="Desvios por indicador" subtitle="Onde a qualidade está escapando do padrão" action={<StatusPill tone={quality.deviations.length ? 'warning' : 'success'}>{quality.deviations.reduce((sum, item) => sum + item.count, 0)} ocorrência(s)</StatusPill>} className="od-deviation-panel">
          {quality.deviations.length ? <div className="od-deviation-list">
            {quality.deviations.slice(0, 6).map((item, index) => (
              <button key={item.label} type="button" onClick={() => openHash('#/relatorios')}>
                <span className="od-deviation-rank">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{item.label}</strong><ProgressBar value={(item.count / maxDeviation) * 100} tone={index === 0 ? 'danger' : 'warning'} /></span>
                <em>{item.count}</em>
              </button>
            ))}
          </div> : <EmptyMessage>Nenhum desvio encontrado nas análises disponíveis.</EmptyMessage>}
          <TextAction onClick={() => openHash('#/analises')}>Consultar análises</TextAction>
        </Panel>
      </section>

      <section className="od-risks-bottom">
        <Panel title="Fila de ação" subtitle="Ordenada por impacto operacional" action={<StatusPill tone={totalRisk ? 'warning' : 'success'}>{totalRisk} aberta(s)</StatusPill>} className="od-action-queue-panel">
          <div className="od-risk-list">
            {lowStock.map((item) => <RiskRow key={`stock-${item.id}`} tone="danger" severity="ALTO" title={`Repor ${item.nome}`} detail={`${formatCompactNumber(item.saldo_atual, ` ${item.unidade}`)} disponíveis · mínimo ${formatCompactNumber(item.estoque_minimo, ` ${item.unidade}`)}`} onClick={() => openHash(`#/estoque/item/${item.id}`)} />)}
            {pasteurizer.inRange === false ? <RiskRow tone="danger" severity="ALTO" title="Revisar pasteurização" detail={`Última leitura em ${pasteurizer.current?.toFixed(1)} °C, fora da faixa 72–75 °C`} onClick={() => openHash(pasteurizadorHash(snapshot.resumoDiario.pasteurizador))} /> : null}
            {producerPending > 0 ? <RiskRow tone="warning" severity="MÉDIO" title="Solicitar análises pendentes" detail={`${producerPending} produtor(es) sem análise no período atual`} onClick={() => openHash('#/pendencias')} /> : null}
            {quality.criticalAnalyses.slice(0, 3).map((analysis, index) => <RiskRow key={`quality-${analysis.id ?? index}`} tone="warning" severity="MÉDIO" title={`Revisar ${analysis.produtor_nome || analysis.produtor_codigo || 'análise'}`} detail={`Análise de ${analysis.data} com indicador(es) fora do padrão`} onClick={() => openHash('#/analises')} />)}
            {fuelLow && operacional.combustivel ? <RiskRow tone="warning" severity="MÉDIO" title="Programar entrada de combustível" detail={`Tanque em ${operacional.combustivel.porcentagem.toFixed(0)}% da capacidade`} onClick={() => openHash('#/combustivel/entrada')} /> : null}
            {!totalRisk ? <EmptyMessage>Nenhuma ação prioritária aberta.</EmptyMessage> : null}
          </div>
        </Panel>

        <Panel title="Sinais preventivos" subtitle="Contexto útil sem lotar a tela" className="od-preventive-panel">
          <PreventiveRow label="Pasteurização" value={pasteurizer.label} tone={pasteurizer.inRange === null ? 'neutral' : pasteurizer.inRange ? 'success' : 'danger'} onClick={() => openHash(pasteurizadorHash(snapshot.resumoDiario.pasteurizador))} />
          <PreventiveRow label="Combustível" value={operacional.combustivel ? `${operacional.combustivel.porcentagem.toFixed(0)}% da capacidade` : 'Fonte indisponível'} tone={operacional.combustivel === null ? 'neutral' : operacional.combustivel.porcentagem < 25 ? 'warning' : 'success'} onClick={() => openHash('#/combustivel/inicio')} />
          <PreventiveRow label="Estoque baixo" value={lowStock.length ? `${lowStock.length} item(ns) exigem reposição` : 'Nenhum item abaixo do mínimo'} tone={lowStock.length ? 'danger' : 'success'} onClick={() => openHash('#/estoque/inicio')} />
          <PreventiveRow label="Fontes da dashboard" value={operacional.fontesIndisponiveis.length ? operacional.fontesIndisponiveis.join(', ') : 'Todas disponíveis'} tone={operacional.fontesIndisponiveis.length ? 'warning' : 'success'} />
        </Panel>
      </section>
    </div>
  )
}

function RiskRow({ tone, severity, title, detail, onClick }: { tone: DashboardTone; severity: string; title: string; detail: string; onClick: () => void }) {
  return <button className="od-risk-row" type="button" onClick={onClick}><StatusPill tone={tone}>{severity}</StatusPill><span><strong>{title}</strong><small>{detail}</small></span><em>→</em></button>
}

function PreventiveRow({ label, value, tone, onClick }: { label: string; value: string; tone: DashboardTone; onClick?: () => void }) {
  const content = <><span className={`od-preventive-dot is-${tone}`} /><strong>{label}</strong><span>{value}</span><em>{onClick ? '→' : ''}</em></>
  return onClick ? <button className="od-preventive-row" type="button" onClick={onClick}>{content}</button> : <div className="od-preventive-row">{content}</div>
}
