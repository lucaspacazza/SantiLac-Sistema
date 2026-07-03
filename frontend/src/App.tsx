import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { authApi, type AuthUser } from './api/authApi'
import { LoginPage } from './pages/LoginPage'
import { SystemHome } from './pages/SystemHome'
import { CoreSidebar, routeForModule } from './shared/CoreSidebar'
import type { ThemeMode } from './shared/ThemeToggle'
import { allowedSidebarModules, canAccessModuleSlug, isSystemModule, sidebarModules, type ModuleAccessUser, type SystemModule } from './shared/modules'

type AppState = 'booting' | 'guest' | 'authenticated'

const CadastrosModule = lazy(() => import('./modules/cadastros/CadastrosModule').then((module) => ({ default: module.CadastrosModule })))
const ColetasModule = lazy(() => import('./modules/coletas/ColetasModule').then((module) => ({ default: module.ColetasModule })))
const CombustivelModule = lazy(() => import('./modules/combustivel/CombustivelModule').then((module) => ({ default: module.CombustivelModule })))
const DashboardResumoApp = lazy(() => import('./modules/dashboard/DashboardResumoApp').then((module) => ({ default: module.DashboardResumoApp })))
const EmbalagemApp = lazy(() => import('./modules/embalagem/App').then((module) => ({ default: module.App })))
const CarregamentoExpedicao = lazy(() => import('./modules/embalagem/views/CarregamentoExpedicao').then((module) => ({ default: module.CarregamentoExpedicao })))
const ExpedicaoModule = lazy(() => import('./modules/expedicao/ExpedicaoModule').then((module) => ({ default: module.ExpedicaoModule })))
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
  return isEmbalagemHost ? <EmbalagemPortal /> : <CoreApp />
}

function CoreApp() {
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
    const module = activeModule
      ? sidebarModules.find((item) => item.slug === activeModule)
      : null
    document.title = module ? `Santi'Lac | ${module.title}` : "Santi'Lac"
  }, [activeModule])

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
          ) : activeModule === 'expedicao' ? (
            <ExpedicaoModule />
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

function EmbalagemPortal() {
  const [state, setState] = useState<AppState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [area, setArea] = useState<'embalagem' | 'carregamento'>(() =>
    window.localStorage.getItem('embalagem-area') === 'carregamento' ? 'carregamento' : 'embalagem')

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    void import('./modules/embalagem/styles.css')

    async function boot() {
      try {
        await authApi.csrf()
        const session = await authApi.me()
        if (session.user) {
          setUser(session.user)
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
    document.title = state === 'authenticated'
      ? `Santi'Lac | ${area === 'embalagem' ? 'Embalagem' : 'Carregamento'}`
      : "Santi'Lac"
  }, [area, state])

  async function login(loginValue: string, password: string, remember: boolean) {
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      const result = await authApi.login(loginValue, password, remember)
      setUser(result.user)
      setState('authenticated')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar no sistema.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function logout() {
    await authApi.logout().catch(() => null)
    setUser(null)
    setState('guest')
  }

  function selectArea(value: 'embalagem' | 'carregamento') {
    setArea(value)
    window.localStorage.setItem('embalagem-area', value)
  }

  if (state === 'booting') {
    return <main className="core-loading"><img src="/assets/img/logo.png" alt="Santi'Lac" /><span>Carregando operação...</span></main>
  }
  if (state === 'guest' || !user) {
    return <LoginPage loading={isLoggingIn} error={loginError} onLogin={login} />
  }

  return (
    <div className="packaging-workspace">
      <header className="packaging-topbar">
        <img src="/assets/img/logo.png" alt="Santi'Lac" />
        <nav className="packaging-tabs" aria-label="Áreas da operação">
          <button className={area === 'embalagem' ? 'is-active' : ''} type="button" onClick={() => selectArea('embalagem')}>Embalagem</button>
          <button className={area === 'carregamento' ? 'is-active' : ''} type="button" onClick={() => selectArea('carregamento')}>Carregamento</button>
        </nav>
        <div className="packaging-user">
          <span>{user.nome}</span>
          <button className="icon-btn" type="button" title="Sair" aria-label="Sair" onClick={() => void logout()}><LogOut size={16} /></button>
        </div>
      </header>
      <Suspense fallback={<ModuleLoading />}>
        {area === 'embalagem' ? <EmbalagemApp /> : <CarregamentoExpedicao />}
      </Suspense>
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
