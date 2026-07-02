import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { authApi, type AuthUser } from './api/authApi'
import { LoginPage } from './pages/LoginPage'
import { SystemHome } from './pages/SystemHome'
import { CoreSidebar, routeForModule } from './shared/CoreSidebar'
import type { ThemeMode } from './shared/ThemeToggle'
import { allowedSidebarModules, canAccessModuleSlug, isSystemModule, type ModuleAccessUser, type SystemModule } from './shared/modules'

type AppState = 'booting' | 'guest' | 'authenticated'

const CadastrosModule = lazy(() => import('./modules/cadastros/CadastrosModule').then((module) => ({ default: module.CadastrosModule })))
const ColetasModule = lazy(() => import('./modules/coletas/ColetasModule').then((module) => ({ default: module.ColetasModule })))
const CombustivelModule = lazy(() => import('./modules/combustivel/CombustivelModule').then((module) => ({ default: module.CombustivelModule })))
const DashboardResumoApp = lazy(() => import('./modules/dashboard/DashboardResumoApp').then((module) => ({ default: module.DashboardResumoApp })))
const EmbalagemApp = lazy(() => import('./modules/embalagem/App').then((module) => ({ default: module.App })))
const EstoqueModule = lazy(() => import('./modules/estoque/EstoqueModule').then((module) => ({ default: module.EstoqueModule })))
const PasteurizadorModule = lazy(() => import('./modules/pasteurizador/PasteurizadorModule').then((module) => ({ default: module.PasteurizadorModule })))
const ProducaoModule = lazy(() => import('./modules/producao/ProducaoModule').then((module) => ({ default: module.ProducaoModule })))
const QualidadeModule = lazy(() => import('./modules/qualidade/QualidadeModule').then((module) => ({ default: module.QualidadeModule })))
const isEmbalagemHost = window.location.hostname.toLowerCase() === 'embalagem.santilac.com.br'

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
  if (isEmbalagemHost) {
    return (
      <Suspense fallback={null}>
        <EmbalagemApp />
      </Suspense>
    )
  }

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
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Não foi possível entrar no sistema.')
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
        <Suspense fallback={<ModuleLoading />}>
          {activeModule === 'dashboard' ? (
            <DashboardResumoApp />
          ) : activeModule === 'qualidade' ? (
            <QualidadeModule />
          ) : activeModule === 'producao' ? (
            <ProducaoModule />
          ) : activeModule === 'estoque' ? (
            <EstoqueModule />
          ) : activeModule === 'pasteurizador' ? (
            <PasteurizadorModule />
          ) : activeModule === 'combustivel' ? (
            <CombustivelModule />
          ) : activeModule === 'coletas' ? (
            <ColetasModule />
          ) : activeModule === 'cadastros' ? (
            <CadastrosModule />
          ) : (
            <SystemHome />
          )}
        </Suspense>
      </main>
    </div>
  )
}

function ModuleLoading() {
  return (
    <section className="module-loading" aria-live="polite">
      <span className="module-loading-dot" />
      <span>Carregando módulo...</span>
    </section>
  )
}
