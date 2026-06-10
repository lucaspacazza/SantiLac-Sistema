import {
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  ClipboardList,
  FlaskConical,
  Fuel,
  Home,
  LogOut,
  Package,
  Thermometer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeToggle, type ThemeMode } from './ThemeToggle'
import { moduleHref, sidebarModules, type SidebarModuleItem, type SystemModule } from './modules'

export function routeForModule(module: SystemModule): string {
  return moduleHref(module)
}

export function CoreSidebar({
  userName,
  theme,
  activeModule,
  onToggleTheme,
  onLogout,
  onBackToSystem,
  onOpenModule,
  showSystemHomeActive = false,
  modules = sidebarModules,
}: {
  userName: string
  theme: ThemeMode
  activeModule: SystemModule | null
  onToggleTheme: () => void
  onLogout: () => void
  onBackToSystem: () => void
  onOpenModule: (module: SystemModule) => void
  showSystemHomeActive?: boolean
  modules?: readonly SidebarModuleItem[]
}) {
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/inicio')

  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash || '#/inicio')

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function openRoute(href: string) {
    window.location.hash = href
    setCurrentHash(href)
  }

  return (
    <aside className="sidebar" data-owner="core-shell">
      <img className="sidebar-logo" src="/assets/img/logo.png" alt="Santi'Lac" />

      <nav className="nav" aria-label="Módulos do sistema">
        <span className="nav-section-title">Sistema</span>
        <button className={`nav-item nav-motion-home ${showSystemHomeActive ? 'is-active' : ''}`} type="button" onClick={onBackToSystem}>
          <Home size={16} />
          Início do sistema
        </button>

        {modules.map((module) => {
          const isModuleActive = activeModule === module.slug

          return (
            <div className="nav-module" key={module.slug}>
              <button
                className={`nav-item ${isModuleActive ? 'is-active' : ''}`}
                type="button"
                onClick={() => onOpenModule(module.slug)}
                title={module.desc}
              >
                {iconForModule(module.icon)}
                {module.title}
              </button>

              {isModuleActive && module.children?.length ? (
                <div className="nav-subtree" aria-label={`Submódulos de ${module.title}`}>
                  {module.children.map((child) => (
                    <button
                      key={child.href}
                      className={`nav-subitem ${isSubmoduleActive(currentHash, child.href) ? 'is-active' : ''}`}
                      type="button"
                      onClick={() => openRoute(child.href)}
                    >
                      {iconForModule(child.icon)}
                      {child.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="avatar small">{userName.slice(0, 1).toUpperCase()}</span>
          <span>{userName}</span>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button className="sidebar-logout" type="button" onClick={onLogout}>
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </aside>
  )
}

function iconForModule(icon: string): ReactNode {
  const icons: Record<string, LucideIcon> = {
    'fa-home': Home,
    'fa-flask': FlaskConical,
    'fa-warehouse': Package,
    'fa-gas-pump': Fuel,
    'fa-thermometer-half': Thermometer,
    'fa-users': Users,
    'fa-chart-pie': BarChart3,
    'fa-exchange-alt': ArrowRightLeft,
    'fa-arrow-down': ArrowDownToLine,
    'fa-arrow-up': ArrowUpFromLine,
    'fa-clipboard-list': ClipboardList,
  }

  const Icon = icons[icon] ?? Home
  return <Icon size={16} />
}

function isSubmoduleActive(currentHash: string, href: string): boolean {
  const current = normalizeHash(currentHash)
  const target = normalizeHash(href)

  if (target === '#/inicio') {
    return current === '#/inicio'
  }

  return current === target || current.startsWith(`${target}/`)
}

function normalizeHash(hash: string): string {
  const cleaned = hash || '#/inicio'
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`
}
