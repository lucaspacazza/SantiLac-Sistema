import type { ReactNode } from 'react'
import type { DashboardResumoSnapshot } from '../api/dashboardResumoTypes'
import { formatDate, formatNumber } from '../shared/formatters'
import { openHash, pasteurizadorHash } from '../shared/navigation'

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
      <div>
        <h2>Acessos rapidos</h2>
        <p>atalhos limpos para abrir os modulos principais</p>
      </div>
      <Shortcut label="Coletas" description="Abrir rotas" href={rotas.coletas} />
      <Shortcut label="Producao" description="Abrir producao" href={rotas.producao} />
      <Shortcut label="Pasteurizador" description="Abrir historico" href={rotas.pasteurizador} />
      <Shortcut label="Estoque" description="Abrir estoque" href={rotas.estoque} />
    </section>
  )
}

export function Shortcut({
  label,
  href,
  large = false,
  description = 'Abrir modulo',
}: {
  label: string
  href: string
  large?: boolean
  description?: string
}) {
  return (
    <button className={`shortcut ${large ? 'is-large' : ''}`} type="button" onClick={() => openHash(href)}>
      <strong>{label}</strong>
      <small>{description}</small>
    </button>
  )
}

export function AvisosNotas({ snapshot }: { snapshot: DashboardResumoSnapshot }) {
  const home = snapshot.homeResumo
  const estoqueOk = home.estoque.abaixo_minimo <= 0

  return (
    <article className="panel dashboard-section notes-panel">
      <SectionHeader title="Avisos, lembretes e notas" subtitle="leitura rapida do que precisa de atencao" />
      <div className="status-list">
        <StatusRow tag="Aviso" tone="warn" onClick={() => openHash(snapshot.rotas.coletas)}>
          {home.coletas.ultima_data ? `ultimo fechamento de coleta em ${formatDate(home.coletas.ultima_data)}` : 'sem fechamento de coleta encontrado'}
        </StatusRow>
        <StatusRow tag="Lembrete" tone="warn" onClick={() => openHash(snapshot.rotas.producao)}>
          {home.producao.ultima_data ? `ultima producao registrada em ${formatDate(home.producao.ultima_data)}` : 'sem producao registrada'}
        </StatusRow>
        <StatusRow tag="Nota" tone="ok" onClick={() => openHash(pasteurizadorHash(home.pasteurizador))}>
          {home.pasteurizador.total_pontos > 0 ? 'pasteurizador com amostras no dia' : 'sem amostras do pasteurizador no dia'}
        </StatusRow>
        <StatusRow tag="Nota" tone={estoqueOk ? 'ok' : 'danger'} onClick={() => openHash(snapshot.rotas.estoque)}>
          {estoqueOk ? 'nenhum item critico no estoque agora' : `${home.estoque.abaixo_minimo} item(ns) abaixo do minimo`}
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
