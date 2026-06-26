import { Download, RefreshCcw } from 'lucide-react'
import { formatDate } from '../shared/formatters'
import type { DashboardView } from '../shared/navigation'

type DashboardHeaderProps = {
  view: DashboardView
  data: string
  onDataChange: (data: string) => void
  onRefresh: () => void
}

export function DashboardHeader({ view, data, onDataChange, onRefresh }: DashboardHeaderProps) {
  return (
    <header className="page-head">
      <div>
        <h1>{view === 'inicio' ? 'Dashboard' : 'Resumo diário'}</h1>
        <p>{view === 'inicio' ? 'resumo executivo da empresa' : 'o dia filtrado resumindo a empresa'}</p>
      </div>
      <div className="dashboard-actions">
        <span className="context-badge">{view === 'inicio' ? 'base atual' : formatDate(data)}</span>
        <input
          className="control"
          type="date"
          value={data}
          onChange={(event) => onDataChange(event.target.value)}
        />
        <button className="btn secondary" type="button" onClick={() => onDataChange(new Date().toISOString().slice(0, 10))}>
          Hoje
        </button>
        <button className="btn secondary" type="button" onClick={onRefresh}>
          <RefreshCcw size={16} />
        </button>
        <button className="btn primary" type="button" onClick={() => window.print()}>
          <Download size={16} />
          Exportar
        </button>
      </div>
    </header>
  )
}
