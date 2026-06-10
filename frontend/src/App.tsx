import { useEffect, useMemo, useState } from 'react'
import { authApi, type AuthUser } from './api/authApi'
import { CombustivelModule } from './modules/combustivel/CombustivelModule'
import { EstoqueModule } from './modules/estoque/EstoqueModule'
import { PasteurizadorModule } from './modules/pasteurizador/PasteurizadorModule'
import { ProducaoModule } from './modules/producao/ProducaoModule'
import { QualidadeModule } from './modules/qualidade/QualidadeModule'
import { LoginPage } from './pages/LoginPage'
import { SystemHome } from './pages/SystemHome'
import { CoreSidebar, routeForModule } from './shared/CoreSidebar'
import type { ThemeMode } from './shared/ThemeToggle'
import { allowedSidebarModules, canAccessModuleSlug, isSystemModule, type ModuleAccessUser, type SystemModule } from './shared/modules'

type AppState = 'booting' | 'guest' | 'authenticated'

function moduleFromHash(user: ModuleAccessUser | null): SystemModule | null {
  const firstPart = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)[0]
  let module: SystemModule | null = null

  if (isSystemModule(firstPart)) {
    module = firstPart
  } else if (['inicio', 'produtores', 'pendencias', 'analises', 'relatorios'].includes(firstPart)) {
    module = 'qualidade'
  }

  return module && canAccessModuleSlug(user, module) ? module : null
}

export function App() {
  const [state, setState] = useState<AppState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [activeModule, setActiveModule] = useState<SystemModule | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem('santilac-theme')
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const visibleModules = useMemo(() => allowedSidebarModules(user), [user])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('santilac-theme', theme)
  }, [theme])

  useEffect(() => {
    async function boot() {
      try {
        await authApi.csrf()
        const session = await authApi.me()
        if (session.user) {
          setUser(session.user)
          setActiveModule(moduleFromHash(session.user))
          setState('authenticated')
          return
        }
      } catch {
        setUser(null)
      }

      setState('guest')
    }

    void boot()
  }, [])

  useEffect(() => {
    if (state !== 'authenticated' || !user) {
      return
    }

    const handleHashChange = () => {
      setActiveModule(moduleFromHash(user))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [state, user])

  async function handleLogin(email: string, password: string, remember: boolean) {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const result = await authApi.login(email, password, remember)
      setUser(result.user)
      window.location.hash = '#/sistema'
      setActiveModule(null)
      setState('authenticated')
    } catch {
      setLoginError('Usuário ou senha incorretos.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    await authApi.logout().catch(() => null)
    setUser(null)
    setActiveModule(null)
    setState('guest')
  }

  function handleOpenModule(module: SystemModule) {
    if (!canAccessModuleSlug(user, module)) {
      window.location.hash = '#/sistema'
      setActiveModule(null)
      return
    }

    const route = routeForModule(module)
    if (route.startsWith('#')) {
      window.location.hash = route
      setActiveModule(module)
      return
    }

    window.location.href = route
  }

  function handleBackToSystem() {
    window.location.hash = '#/sistema'
    setActiveModule(null)
  }

  function handleToggleTheme() {
    setTheme((current) => current === 'dark' ? 'light' : 'dark')
  }

  if (state === 'booting') {
    return (
      <main className="core-loading">
        <img src="/assets/img/logo.png" alt="Santi'Lac" />
        <span>Carregando sistema...</span>
      </main>
    )
  }

  if (state === 'guest' || !user) {
    return <LoginPage loading={isLoggingIn} error={loginError} onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <CoreSidebar
        userName={user.nome}
        theme={theme}
        activeModule={activeModule}
        modules={visibleModules}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        onBackToSystem={handleBackToSystem}
        onOpenModule={handleOpenModule}
        showSystemHomeActive={activeModule === null}
      />

      <main className="content">
        {activeModule === 'qualidade' ? (
          <QualidadeModule />
        ) : activeModule === 'producao' ? (
          <ProducaoModule />
        ) : activeModule === 'estoque' ? (
          <EstoqueModule />
        ) : activeModule === 'pasteurizador' ? (
          <PasteurizadorModule />
        ) : activeModule === 'combustivel' ? (
          <CombustivelModule />
        ) : (
          <SystemHome />
        )}
      </main>
    </div>
  )
}
