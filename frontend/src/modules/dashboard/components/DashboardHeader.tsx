import { CalendarDays, Download, RefreshCcw } from 'lucide-react'
import { formatDate } from '../shared/formatters'
import { openDashboardView, type DashboardView } from '../shared/navigation'

const viewCopy: Record<DashboardView, { title: string; description: string }> = {
  overview: {
    title: 'Visão geral',
    description: 'O que exige decisão e como a operação está performando agora.',
  },
  operations: {
    title: 'Operação do dia',
    description: 'Fluxo, gargalos e rastreabilidade da coleta à produção.',
  },
  risks: {
    title: 'Riscos & qualidade',
    description: 'Problemas ordenados por impacto, com contexto suficiente para agir.',
  },
}

type DashboardHeaderProps = {
  view: DashboardView
  data: string
  status: string
  refreshing: boolean
  onDataChange: (data: string) => void
  onRefresh: () => void
}

export function DashboardHeader({ view, data, status, refreshing, onDataChange, onRefresh }: DashboardHeaderProps) {
  const copy = viewCopy[view]

  return (
    <>
      <header className="od-page-head">
        <div>
          <span className="od-eyebrow">DASHBOARD OPERACIONAL</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <div className="od-page-actions">
          <label className="od-date-control">
            <CalendarDays size={15} />
            <span>{formatDate(data)}</span>
            <input type="date" value={data} onChange={(event) => onDataChange(event.target.value)} aria-label="Selecionar data da dashboard" />
          </label>
          <button className="od-icon-button" type="button" onClick={onRefresh} disabled={refreshing} title="Atualizar dados"><RefreshCcw size={16} className={refreshing ? 'is-spinning' : ''} /></button>
          <button className="od-export-button" type="button" onClick={() => window.print()}><Download size={15} />Exportar</button>
        </div>
      </header>

      <div className="od-viewbar">
        <nav aria-label="Visões da dashboard">
          <button className={view === 'overview' ? 'is-active' : ''} type="button" onClick={() => openDashboardView('overview', data)}>Visão geral</button>
          <button className={view === 'operations' ? 'is-active' : ''} type="button" onClick={() => openDashboardView('operations', data)}>Operação do dia</button>
          <button className={view === 'risks' ? 'is-active' : ''} type="button" onClick={() => openDashboardView('risks', data)}>Riscos & qualidade</button>
        </nav>
        <span className="od-freshness"><i />{status}</span>
      </div>
    </>
  )
}
