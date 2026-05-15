import { BarChart3, FlaskConical, LogOut, Package, Settings, ShieldCheck } from 'lucide-react'
import type { AuthUser } from '../api/authApi'
import { AnimatedHomeIcon } from '../shared/AnimatedHomeIcon'
import { ThemeToggle, type ThemeMode } from '../shared/ThemeToggle'

export type SystemModule = 'qualidade' | 'estoque'

export function SystemHome({
  user,
  theme,
  onToggleTheme,
  onOpenModule,
  onLogout,
}: {
  user: AuthUser
  theme: ThemeMode
  onToggleTheme: () => void
  onOpenModule: (module: SystemModule) => void
  onLogout: () => void
}) {
  return (
    <div className="app-shell core-home-shell">
      <aside className="sidebar">
        <img className="sidebar-logo" src="/assets/img/logo.png" alt="Santi'Lac" />

        <nav className="nav" aria-label="Módulos do sistema">
          <span className="nav-section-title">Sistema</span>
          <button className="nav-item nav-motion-home is-active" type="button">
            <AnimatedHomeIcon size={16} />
            Início do sistema
          </button>
          <button className="nav-item nav-motion-quality" type="button" onClick={() => onOpenModule('qualidade')}>
            <FlaskConical size={16} />
            Qualidade
          </button>
          <button className="nav-item nav-motion-stock" type="button" onClick={() => onOpenModule('estoque')}>
            <Package size={16} />
            Estoque
          </button>
          <button className="nav-item nav-motion-dashboard is-disabled" type="button" disabled>
            <BarChart3 size={16} />
            Dashboard
          </button>
          <button className="nav-item nav-motion-admin is-disabled" type="button" disabled>
            <Settings size={16} />
            Administração
          </button>
          <button className="nav-item nav-motion-access is-disabled" type="button" disabled>
            <ShieldCheck size={16} />
            Acessos
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar small">{user.nome.slice(0, 1).toUpperCase()}</span>
            <span>{user.nome}</span>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
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
