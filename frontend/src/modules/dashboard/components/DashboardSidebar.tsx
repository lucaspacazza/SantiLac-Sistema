import type { DashboardView } from '../shared/navigation'
import { openHash, openResumoDiario } from '../shared/navigation'

export function DashboardSidebar({ view, data }: { view: DashboardView; data: string }) {
  return (
    <aside className="sidebar">
      <img className="sidebar-logo" src="/assets/img/logo.png" alt="Santi'Lac" />
      <nav className="nav" aria-label="Dashboard">
        <span className="nav-section-title">Dashboard</span>
        <button className={`nav-item ${view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => openHash('#/inicio')}>
          Dashboard
        </button>
        <button className={`nav-item ${view === 'resumo-diario' ? 'is-active' : ''}`} type="button" onClick={() => openResumoDiario(data)}>
          Resumo diário
        </button>
      </nav>
      <div className="sidebar-footer dashboard-sidebar-footer">
        <div className="sidebar-user">
          <span className="avatar small">S</span>
          <span>Santi'Lac</span>
        </div>
      </div>
    </aside>
  )
}
