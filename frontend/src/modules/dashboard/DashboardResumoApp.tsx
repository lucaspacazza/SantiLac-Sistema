import { useDashboardResumo } from './hooks/useDashboardResumo'
import { DashboardHeader } from './components/DashboardHeader'
import { InicioResumoView } from './views/InicioResumo/InicioResumoView'
import { ResumoDiarioView } from './views/ResumoDiario/ResumoDiarioView'
import './dashboard.css'

export function DashboardResumoApp() {
  const dashboard = useDashboardResumo()

  return (
    <section className="page dashboard-module">
      <DashboardHeader
        view={dashboard.view}
        data={dashboard.data}
        onDataChange={(data) => {
          dashboard.setData(data)
          void dashboard.carregar(data)
        }}
        onRefresh={() => void dashboard.carregar(dashboard.data)}
      />

      <div className={`status-line ${dashboard.erro ? 'is-error' : 'is-live'}`}>
        <span className="status-dot" />
        <span>{dashboard.erro ?? dashboard.status}</span>
      </div>

      {!dashboard.snapshot ? (
        <div className="empty-state">Carregando dashboard...</div>
      ) : dashboard.view === 'inicio' ? (
        <InicioResumoView snapshot={dashboard.snapshot} />
      ) : (
        <ResumoDiarioView snapshot={dashboard.snapshot} />
      )}
    </section>
  )
}
