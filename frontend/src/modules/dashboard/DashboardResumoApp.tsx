import { DashboardHeader } from './components/DashboardHeader'
import { useDashboardResumo } from './hooks/useDashboardResumo'
import { openDashboardView } from './shared/navigation'
import { OperationsDashboardView } from './views/OperationsDashboardView'
import { OverviewDashboardView } from './views/OverviewDashboardView'
import { RisksDashboardView } from './views/RisksDashboardView'
import './dashboard.css'

export function DashboardResumoApp() {
  const dashboard = useDashboardResumo()

  return (
    <section className="dashboard-module">
      <DashboardHeader
        view={dashboard.view}
        data={dashboard.data}
        status={dashboard.erro ?? dashboard.status}
        refreshing={dashboard.carregando}
        onDataChange={(data) => openDashboardView(dashboard.view, data)}
        onRefresh={() => void dashboard.carregar(dashboard.data)}
      />

      {!dashboard.snapshot ? (
        <div className={`od-loading-state ${dashboard.erro ? 'is-error' : ''}`}>
          <span className="od-loading-mark" />
          <strong>{dashboard.erro ? 'Não foi possível carregar a dashboard' : 'Consolidando a operação...'}</strong>
          <p>{dashboard.erro ?? 'Buscando dados dos módulos conectados.'}</p>
          {dashboard.erro ? <button type="button" onClick={() => void dashboard.carregar(dashboard.data)}>Tentar novamente</button> : null}
        </div>
      ) : dashboard.view === 'operations' ? (
        <OperationsDashboardView snapshot={dashboard.snapshot} operacional={dashboard.operacional} />
      ) : dashboard.view === 'risks' ? (
        <RisksDashboardView snapshot={dashboard.snapshot} operacional={dashboard.operacional} />
      ) : (
        <OverviewDashboardView snapshot={dashboard.snapshot} operacional={dashboard.operacional} />
      )}
    </section>
  )
}
