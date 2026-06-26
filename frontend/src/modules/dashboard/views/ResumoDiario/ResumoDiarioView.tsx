import { AlertTriangle, CalendarDays, Factory, Package, Route, Thermometer } from 'lucide-react'
import type { DashboardResumoSnapshot } from '../../api/dashboardResumoTypes'
import { ClickDestinations, ModuleShortcuts, SectionHeader, StatusRow } from '../../components/DashboardBlocks'
import { KpiCard } from '../../components/KpiCard'
import { PasteurizadorResumoCard } from '../../components/PasteurizadorResumoCard'
import { formatDate, formatNumber } from '../../shared/formatters'
import { openHash, pasteurizadorHash } from '../../shared/navigation'

export function ResumoDiarioView({ snapshot }: { snapshot: DashboardResumoSnapshot }) {
  const diario = snapshot.resumoDiario
  const estoqueOk = diario.estoque.abaixo_minimo <= 0
  const alertas = diario.estoque.abaixo_minimo

  return (
    <div className="dashboard-daily-grid">
      <section className="dashboard-kpis is-daily">
        <KpiCard icon={<CalendarDays size={12} />} badge="Dia" tone="info" label="Data do resumo" value={formatDate(diario.data)} hint="dia ativo na dashboard" />
        <KpiCard icon={<Route size={12} />} badge="Coletas" tone="warn" label="Coleta do dia" value={formatNumber(diario.coletas.litros, ' L')} hint={diario.coletas.coletas > 0 ? `${diario.coletas.coletas} coleta(s)` : 'sem fechamento novo'} onClick={() => openHash(snapshot.rotas.coletas)} />
        <KpiCard icon={<Thermometer size={12} />} badge="Hoje" tone="ok" label="Pasteurizador do dia" value={`${diario.pasteurizador.total_pontos.toLocaleString('pt-BR')} pts`} hint={diario.pasteurizador.media === null ? 'sem média' : `média ${diario.pasteurizador.media.toFixed(2)}°C`} onClick={() => openHash(pasteurizadorHash(diario.pasteurizador))} />
        <KpiCard icon={<Factory size={12} />} badge="Produção" tone="warn" label="Produção do dia" value={formatNumber(diario.producao.litros, ' L')} hint={diario.producao.total_lotes > 0 ? `${diario.producao.total_lotes} lote(s)` : 'sem produção nova'} onClick={() => openHash(snapshot.rotas.producao)} />
        <KpiCard icon={<Package size={12} />} badge="Estoque" tone="ok" label="Estoque no dia" value={`${diario.estoque.ativos} itens`} hint="base atual disponível" onClick={() => openHash(snapshot.rotas.estoque)} />
        <KpiCard icon={<AlertTriangle size={12} />} badge="Agora" tone={alertas > 0 ? 'danger' : 'ok'} label="Alertas" value={`${alertas}`} hint={alertas > 0 ? 'estoque abaixo do mínimo' : 'nenhum item crítico'} onClick={() => openHash(snapshot.rotas.estoque)} />
      </section>

      <article className="panel dashboard-section daily-operation-panel">
        <SectionHeader title="Resumo diário da operação" subtitle="tela para o dono revisar um único dia por completo" />

        <section className="daily-pasteurizador-card">
          <div>
            <h3>Amostra do pasteurizador do dia</h3>
            <p>o card resume o dia e o clique abre o módulo do pasteurizador</p>
          </div>
          <PasteurizadorResumoCard pasteurizador={diario.pasteurizador} large onClick={() => openHash(pasteurizadorHash(diario.pasteurizador))} />
          <small className="period-copy">
            {formatDate(diario.data)} 00:00 → {formatDate(diario.data)} 23:59 • canal {diario.pasteurizador.canal}
          </small>
        </section>

        <div className="operational-list">
          <OperationalRow title="Coletas" text={diario.coletas.coletas > 0 ? `${diario.coletas.coletas} coleta(s) fechada(s) no dia` : 'Sem nova coleta fechada no dia'} action="Abrir coletas" onClick={() => openHash(snapshot.rotas.coletas)} />
          <OperationalRow title="Produção" text={diario.producao.total_lotes > 0 ? `${diario.producao.total_lotes} lote(s) registrado(s) no dia` : 'Sem produção nova no dia'} action="Abrir produção" onClick={() => openHash(snapshot.rotas.producao)} />
          <OperationalRow title="Estoque" text="Disponibilidade atual ainda válida para decisão" action="Abrir estoque" onClick={() => openHash(snapshot.rotas.estoque)} />
          <OperationalRow title="Alertas" text={alertas > 0 ? `${alertas} item(ns) abaixo do mínimo` : 'Nenhum item crítico no estoque agora'} action="Abrir estoque" onClick={() => openHash(snapshot.rotas.estoque)} />
        </div>
      </article>

      <article className="panel dashboard-section daily-reading-panel">
        <SectionHeader title="Leitura do dia" subtitle="o que muda quando o dono escolhe uma data" />
        <div className="status-list">
          <StatusRow tag="Coleta" tone={diario.coletas.coletas > 0 ? 'ok' : 'warn'} onClick={() => openHash(snapshot.rotas.coletas)}>
            {diario.coletas.coletas > 0 ? `${formatNumber(diario.coletas.litros, ' L')} coletados` : `sem dado novo em ${formatDate(diario.data)}`}
          </StatusRow>
          <StatusRow tag="Pasteurizador" tone={diario.pasteurizador.total_pontos > 0 ? 'ok' : 'warn'} onClick={() => openHash(pasteurizadorHash(diario.pasteurizador))}>
            {diario.pasteurizador.total_pontos > 0 ? 'rodando e gravando normal' : 'sem amostras no período'}
          </StatusRow>
          <StatusRow tag="Produção" tone={diario.producao.total_lotes > 0 ? 'ok' : 'warn'} onClick={() => openHash(snapshot.rotas.producao)}>
            {diario.producao.total_lotes > 0 ? `${diario.producao.total_lotes} lote(s) no dia` : 'continua usando última base'}
          </StatusRow>
          <StatusRow tag="Estoque" tone={estoqueOk ? 'ok' : 'danger'} onClick={() => openHash(snapshot.rotas.estoque)}>
            {estoqueOk ? 'visão atual disponível' : `${diario.estoque.abaixo_minimo} item(ns) abaixo do mínimo`}
          </StatusRow>
        </div>
      </article>

      <ModuleShortcuts rotas={snapshot.rotas} />
      <ClickDestinations rotas={snapshot.rotas} />
    </div>
  )
}

function OperationalRow({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) {
  return (
    <button className="operational-row" type="button" onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
      <em>{action}</em>
    </button>
  )
}
