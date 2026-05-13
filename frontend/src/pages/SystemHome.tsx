import { BarChart3, FlaskConical, LogOut, Settings, ShieldCheck } from 'lucide-react'
import type { AuthUser } from '../api/authApi'

export type SystemModule = 'qualidade'

export function SystemHome({
  user,
  onOpenModule,
  onLogout,
}: {
  user: AuthUser
  onOpenModule: (module: SystemModule) => void
  onLogout: () => void
}) {
  return (
    <div className="app-shell core-home-shell">
      <aside className="sidebar">
        <img className="sidebar-logo" src="/assets/img/logo.png" alt="Santi'Lac" />

        <nav className="nav" aria-label="Módulos do sistema">
          <span className="nav-section-title">Sistema</span>
          <button className="nav-item is-active" type="button" onClick={() => onOpenModule('qualidade')}>
            <FlaskConical size={16} />
            Qualidade
          </button>
          <button className="nav-item is-disabled" type="button" disabled>
            <BarChart3 size={16} />
            Dashboard
          </button>
          <button className="nav-item is-disabled" type="button" disabled>
            <Settings size={16} />
            Administração
          </button>
          <button className="nav-item is-disabled" type="button" disabled>
            <ShieldCheck size={16} />
            Acessos
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="avatar small">{user.nome.slice(0, 1).toUpperCase()}</span>
          <span>{user.nome}</span>
        </div>
      </aside>

      <main className="content core-home-content">
        <header className="global-topbar">
          <span />
          <nav>
            <button type="button" onClick={onLogout}>
              <LogOut size={15} />
              Sair
            </button>
          </nav>
        </header>

        <section className="system-logo-stage" aria-label="Santi'Lac Core">
          <img src="/assets/img/logo.png" alt="Santi'Lac" />
        </section>
      </main>
    </div>
  )
}
