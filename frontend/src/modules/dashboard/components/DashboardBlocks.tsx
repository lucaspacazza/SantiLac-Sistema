import type { ReactNode } from 'react'
import type { DashboardResumoSnapshot } from '../api/dashboardResumoTypes'
import { formatDate, formatNumber } from '../shared/formatters'
import { openHash, openResumoDiario } from '../shared/navigation'

type Tone = 'info' | 'ok' | 'warn' | 'danger'

export function StatusRow({ tag, tone, children, onClick }: { tag: string; tone: Tone; children: ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <span className={`pill is-${tone}`}>{tag}</span>
      <strong>{children}</strong>
    </>
  )

  return onClick ? (
    <button className="status-row" type="button" onClick={onClick}>{content}</button>
  ) : (
    <div className="status-row static">{content}</div>
  )
}

export function ModuleShortcuts({ rotas }: { rotas: DashboardResumoSnapshot['rotas'] }) {
  return (
    <section className="panel module-shortcuts">
      <span>Atalhos dos módulos reais</span>
      <Shortcut label="Coletas" href={rotas.coletas} />
      <Shortcut label="Produção" href={rotas.producao} />
      <Shortcut label="Pasteurizador" href={rotas.pasteurizador} />
      <Shortcut label="Estoque" href={rotas.estoque} />
    </section>
  )
}

export function ClickDestinations({ rotas }: { rotas: DashboardResumoSnapshot['rotas'] }) {
  return (
    <section className="panel destination-panel">
      <div>
        <h2>Destino dos cliques deste resumo</h2>
        <p>cada bloco continua sendo dashboard; os cliques levam ao módulo real ou a outro resumo</p>
      </div>
      <div className="destination-grid">
        <Shortcut label="Coletas" href={rotas.coletas} large />
        <Shortcut label="Produção" href={rotas.producao} large />
        <Shortcut label="Pasteurizador histórico" href={rotas.pasteurizador} large />
        <Shortcut label="Estoque" href={rotas.estoque} large />
      </div>
    </section>
  )
}

export function Shortcut({ label, href, large = false }: { label: string; href: string; large?: boolean }) {
  return (
    <button className={`shortcut ${large ? 'is-large' : ''}`} type="button" onClick={() => openHash(href)}>
      <strong>{label}</strong>
      <small>{href}</small>
    </button>
  )
}

export function AvisosNotas({ snapshot }: { snapshot: DashboardResumoSnapshot }) {
  const home = snapshot.homeResumo
  const estoqueOk = home.estoque.abaixo_minimo <= 0

  return (
    <article className="panel dashboard-section notes-panel">
      <SectionHeader title="Avisos, lembretes e notas" subtitle="painel humano da operação" />
      <div className="status-list">
        <StatusRow tag="Aviso" tone="warn" onClick={() => openHash(snapshot.rotas.coletas)}>
          {home.coletas.ultima_data ? `último fechamento de coleta em ${formatDate(home.coletas.ultima_data)}` : 'sem fechamento de coleta encontrado'}
        </StatusRow>
        <StatusRow tag="Lembrete" tone="warn" onClick={() => openHash(snapshot.rotas.producao)}>
          {home.producao.ultima_data ? `última produção registrada em ${formatDate(home.producao.ultima_data)}` : 'sem produção registrada'}
        </StatusRow>
        <StatusRow tag="Nota" tone="ok" onClick={() => openResumoDiario(snapshot.data)}>
          {home.pasteurizador.total_pontos > 0 ? 'pasteurizador com amostras no dia' : 'sem amostras do pasteurizador no dia'}
        </StatusRow>
        <StatusRow tag="Nota" tone={estoqueOk ? 'ok' : 'danger'} onClick={() => openHash(snapshot.rotas.estoque)}>
          {estoqueOk ? 'nenhum item crítico no estoque agora' : `${home.estoque.abaixo_minimo} item(ns) abaixo do mínimo`}
        </StatusRow>
      </div>
    </article>
  )
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="block-head">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  )
}

export function diffColetaLabel(snapshot: DashboardResumoSnapshot): string {
  const serie = snapshot.homeResumo.coletas.serie
  if (serie.length < 2) return 'base atual'
  const atual = serie[serie.length - 1]
  const anterior = serie[serie.length - 2]
  const diff = atual.litros - anterior.litros
  const sinal = diff >= 0 ? '+' : ''
  return `${sinal}${formatNumber(diff, ' L')} vs ${formatDate(anterior.data)}`
}
