import { AlertTriangle, Factory, Package, Route, Thermometer } from 'lucide-react'
import type { DashboardResumoSnapshot } from '../../api/dashboardResumoTypes'
import { AvisosNotas, ModuleShortcuts, SectionHeader, StatusRow, diffColetaLabel } from '../../components/DashboardBlocks'
import { KpiCard } from '../../components/KpiCard'
import { LineChart } from '../../components/LineChart'
import { LotesTable } from '../../components/LotesTable'
import { PasteurizadorResumoCard } from '../../components/PasteurizadorResumoCard'
import { formatDate, formatNumber } from '../../shared/formatters'
import { openHash, openResumoDiario } from '../../shared/navigation'

export function InicioResumoView({ snapshot }: { snapshot: DashboardResumoSnapshot }) {
  const home = snapshot.homeResumo
  const estoqueOk = home.estoque.abaixo_minimo <= 0

  return (
    <div className="dashboard-home-grid">
      <section className="dashboard-kpis">
        <KpiCard icon={<Route size={12} />} badge="Coletas" tone="info" label="Leite coletado" value={formatNumber(home.coletas.litros, ' L')} hint={`último fechamento • ${formatDate(home.coletas.ultima_data)}`} onClick={() => openHash(snapshot.rotas.coletas)} />
        <KpiCard icon={<Factory size={12} />} badge="Produção" tone="info" label="Produção registrada" value={formatNumber(home.producao.litros, ' L')} hint={`última base • ${formatDate(home.producao.ultima_data)}`} onClick={() => openHash(snapshot.rotas.producao)} />
        <KpiCard icon={<Thermometer size={12} />} badge="Hoje" tone="ok" label="Pasteurizador hoje" value={home.pasteurizador.media === null ? '-' : `${home.pasteurizador.media.toFixed(2)}°C`} hint={`média • ${home.pasteurizador.total_pontos.toLocaleString('pt-BR')} pts`} onClick={() => openResumoDiario(snapshot.data)} />
        <KpiCard icon={<Package size={12} />} badge="Estoque" tone="ok" label="Estoque disponível" value={`${home.estoque.ativos} itens`} hint={estoqueOk ? 'sem item abaixo do mínimo' : `${home.estoque.abaixo_minimo} abaixo do mínimo`} onClick={() => openHash(snapshot.rotas.estoque)} />
        <KpiCard icon={<AlertTriangle size={12} />} badge="Agora" tone={home.estoque.abaixo_minimo > 0 ? 'danger' : 'ok'} label="Alertas" value={`${home.estoque.abaixo_minimo}`} hint={home.estoque.abaixo_minimo > 0 ? 'estoque abaixo do mínimo' : 'nenhum item crítico'} onClick={() => openHash(snapshot.rotas.estoque)} />
      </section>

      <article className="panel dashboard-section cockpit-panel">
        <SectionHeader title="Cockpit da manhã" subtitle="o dono abre e entende a situação sem trocar de tela" />
        <div className="status-list">
          <StatusRow tag="Coleta" tone="warn" onClick={() => openHash(snapshot.rotas.coletas)}>
            {home.coletas.ultima_data ? `último fechamento em ${formatDate(home.coletas.ultima_data)}` : 'sem fechamento encontrado'}
          </StatusRow>
          <StatusRow tag="Produção" tone="warn" onClick={() => openHash(snapshot.rotas.producao)}>
            {home.producao.ultima_data ? `última formulação em ${formatDate(home.producao.ultima_data)}` : 'sem produção registrada'}
          </StatusRow>
          <StatusRow tag="Pasteurizador" tone={home.pasteurizador.total_pontos > 0 ? 'ok' : 'warn'} onClick={() => openResumoDiario(snapshot.data)}>
            {home.pasteurizador.total_pontos > 0 ? 'com amostras no dia selecionado' : 'sem amostras no dia selecionado'}
          </StatusRow>
          <StatusRow tag="Estoque" tone={estoqueOk ? 'ok' : 'danger'} onClick={() => openHash(snapshot.rotas.estoque)}>
            {estoqueOk ? 'nenhum item abaixo do mínimo' : `${home.estoque.abaixo_minimo} item(ns) abaixo do mínimo`}
          </StatusRow>
        </div>
        <div className="table-block-title">
          <h3>Produção em andamento / última base</h3>
        </div>
        <LotesTable lotes={home.producao.lotes.slice(0, 4)} onClick={() => openHash(snapshot.rotas.producao)} />
      </article>

      <article className="panel dashboard-section collection-panel">
        <div className="split-head">
          <SectionHeader title="Aumento de coleta" subtitle="últimos dias com registro" />
          <span className="mini-badge is-info">{diffColetaLabel(snapshot)}</span>
        </div>
        <LineChart points={home.coletas.serie.slice(-7).map((item) => ({ label: formatDate(item.data).slice(0, 5), value: item.litros }))} onClick={() => openHash(snapshot.rotas.coletas)} />
      </article>

      <article className="panel dashboard-section pasteurizador-panel">
        <SectionHeader title="Pasteurizador do dia" subtitle="se clicar aqui, aprofunda no resumo diário" />
        <PasteurizadorResumoCard pasteurizador={home.pasteurizador} onClick={() => openResumoDiario(snapshot.data)} />
      </article>

      <article className="panel dashboard-section stock-panel">
        <SectionHeader title="Estoque e disponibilidade" subtitle="queijos, lotes e saldos em leitura rápida" />
        <div className="stock-list">
          {home.estoque.categorias.slice(0, 4).map((item) => (
            <button className="stock-row" type="button" key={item.categoria} onClick={() => openHash(snapshot.rotas.estoque)}>
              <span>{item.categoria}</span>
              <small>{item.itens} {item.itens === 1 ? 'item' : 'itens'}</small>
              <strong>{formatNumber(item.saldo)}</strong>
            </button>
          ))}
        </div>
        <button className="module-link" type="button" onClick={() => openHash(snapshot.rotas.estoque)}>abrir módulo: #/estoque/inicio</button>
      </article>

      <AvisosNotas snapshot={snapshot} />

      <ModuleShortcuts rotas={snapshot.rotas} />
    </div>
  )
}
