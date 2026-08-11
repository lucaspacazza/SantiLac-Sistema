import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRef } from 'react'
import { authApi, type AuthSession, type AuthUser } from './api/authApi'
import { AUTH_EXPIRED_EVENT, SESSION_ACTIVITY_EVENT } from './api/http'
import { LoginPage } from './pages/LoginPage'
import { SystemHome } from './pages/SystemHome'
import { CoreSidebar, routeForModule } from './shared/CoreSidebar'
import { installDurableForms, snapshotAllDurableForms } from './shared/durableForms'
import type { ThemeMode } from './shared/ThemeToggle'
import { allowedSidebarModules, canAccessModuleSlug, isSystemModule, sidebarModules, type ModuleAccessUser, type SystemModule } from './shared/modules'
import { rememberSystemWorkspace, restoreSystemScroll, restoreSystemWorkspace } from './shared/workspaceSession'

type AppState = 'booting' | 'guest' | 'authenticated'
const DEFAULT_SESSION_TIMEOUT_MS = 120 * 60 * 1000

function timeoutFromSession(session: Pick<AuthSession, 'session_lifetime_seconds'>): number {
  const seconds = Number(session.session_lifetime_seconds)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_SESSION_TIMEOUT_MS
}

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
  useEffect(() => installDurableForms(), [])
  return isEmbalagemHost ? <EmbalagemPortal /> : <CoreApp />
}

function useSessionExpiry(
  state: AppState,
  setUser: (user: AuthUser | null) => void,
  sessionTimeoutMs: number,
  setSessionTimeoutMs: (timeout: number) => void,
) {
  const [expired, setExpired] = useState(false)
  const lastSessionActivityRef = useRef(Date.now())

  useEffect(() => {
    if (state !== 'authenticated') return
    let checking = false
    let expiryTimer: number | undefined
    const requireLogin = () => {
      snapshotAllDurableForms()
      setExpired(true)
    }
    const checkLocalExpiry = () => {
      if (Date.now() - lastSessionActivityRef.current < sessionTimeoutMs) return false
      requireLogin()
      return true
    }
    const scheduleLocalExpiry = () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer)
      const elapsed = Date.now() - lastSessionActivityRef.current
      const remaining = Math.max(0, sessionTimeoutMs - elapsed)
      expiryTimer = window.setTimeout(() => {
        if (!checkLocalExpiry()) scheduleLocalExpiry()
      }, remaining)
    }
    const noteSessionActivity = () => {
      lastSessionActivityRef.current = Date.now()
      scheduleLocalExpiry()
    }
    const checkSession = async () => {
      if (checking || expired) return
      checking = true
      try {
        const session = await authApi.me()
        if (!session.user) requireLogin()
        else {
          setUser(session.user)
          setSessionTimeoutMs(timeoutFromSession(session))
          noteSessionActivity()
        }
      } catch {
        // API 401/419 emits AUTH_EXPIRED_EVENT. Do not confuse a temporary
        // connection failure with an expired authenticated session.
      } finally {
        checking = false
      }
    }
    const checkWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!checkLocalExpiry()) void checkSession()
    }
    noteSessionActivity()

    window.addEventListener(AUTH_EXPIRED_EVENT, requireLogin)
    window.addEventListener(SESSION_ACTIVITY_EVENT, noteSessionActivity)
    window.addEventListener('focus', checkSession)
    document.addEventListener('visibilitychange', checkWhenVisible)
    return () => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer)
      window.removeEventListener(AUTH_EXPIRED_EVENT, requireLogin)
      window.removeEventListener(SESSION_ACTIVITY_EVENT, noteSessionActivity)
      window.removeEventListener('focus', checkSession)
      document.removeEventListener('visibilitychange', checkWhenVisible)
    }
  }, [expired, sessionTimeoutMs, setSessionTimeoutMs, setUser, state])

  return [expired, setExpired] as const
}

function CoreApp() {
  const [state, setState] = useState<AppState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [activeModule, setActiveModule] = useState<SystemModule | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [sessionTimeoutMs, setSessionTimeoutMs] = useState(DEFAULT_SESSION_TIMEOUT_MS)
  const [sessionExpired, setSessionExpired] = useSessionExpiry(state, setUser, sessionTimeoutMs, setSessionTimeoutMs)
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
        const session = await authApi.me()
        if (session.user) {
          window.location.hash = restoreSystemWorkspace(session.user.id)
          setUser(session.user)
          setSessionTimeoutMs(timeoutFromSession(session))
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

  useEffect(() => {
    if (state !== 'authenticated' || !user) return
    const hash = window.location.hash
    const scrollY = restoreSystemScroll(user.id, hash)
    let pass = 0
    let frame = 0
    const restoreScroll = () => {
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' })
      pass += 1
      if (pass < 3) frame = window.requestAnimationFrame(restoreScroll)
      else rememberSystemWorkspace(user.id, hash, scrollY)
    }
    frame = window.requestAnimationFrame(restoreScroll)
    return () => window.cancelAnimationFrame(frame)
  }, [activeModule, state, user])

  useEffect(() => {
    if (state !== 'authenticated' || !user) return
    let frame = 0
    const rememberScroll = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => rememberSystemWorkspace(user.id))
    }
    const rememberNow = () => rememberSystemWorkspace(user.id)
    window.addEventListener('scroll', rememberScroll, { passive: true })
    window.addEventListener('pagehide', rememberNow)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', rememberScroll)
      window.removeEventListener('pagehide', rememberNow)
    }
  }, [state, user])

  async function handleLogin(email: string, password: string, remember: boolean) {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const resumingExpiredSession = sessionExpired
      const previousUserId = user?.id ?? null
      const result = await authApi.login(email, password, remember)
      const sameUser = previousUserId !== null && String(previousUserId) === String(result.user.id)
      const resumeHash = restoreSystemWorkspace(
        result.user.id,
        window.location.hash,
        previousUserId !== null && !sameUser,
      )
      window.location.hash = resumeHash
      setUser(result.user)
      setSessionTimeoutMs(timeoutFromSession(result))
      setState('authenticated')
      setSessionExpired(false)
      setActiveModule(moduleFromHash(result.user))
      if (resumingExpiredSession && sameUser) snapshotAllDurableForms()
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Não foi possível entrar no sistema.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    snapshotAllDurableForms()
    if (user) rememberSystemWorkspace(user.id)
    await authApi.logout().catch(() => null)
    setState('guest')
    setSessionExpired(false)
  }

  function handleOpenModule(module: SystemModule) {
    if (activeModule === module) return
    snapshotAllDurableForms()
    if (user) rememberSystemWorkspace(user.id)
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
    snapshotAllDurableForms()
    if (user) rememberSystemWorkspace(user.id)
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

  if (!user) {
    return <LoginPage loading={isLoggingIn} error={loginError} onLogin={handleLogin} />
  }

  return (<>
    <div className="app-shell" data-draft-owner={user.id} key={user.id} aria-hidden={sessionExpired || state === 'guest' || undefined}>
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
    {(sessionExpired || state === 'guest') && <ReauthOverlay expired={sessionExpired} loading={isLoggingIn} error={loginError} onLogin={handleLogin} />}
  </>)
}

function EmbalagemPortal() {
  const [state, setState] = useState<AppState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [sessionTimeoutMs, setSessionTimeoutMs] = useState(DEFAULT_SESSION_TIMEOUT_MS)
  const [sessionExpired, setSessionExpired] = useSessionExpiry(state, setUser, sessionTimeoutMs, setSessionTimeoutMs)
  const [area, setArea] = useState<'embalagem' | 'carregamento'>(() =>
    window.localStorage.getItem('embalagem-area') === 'carregamento' ? 'carregamento' : 'embalagem')

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    void import('./modules/embalagem/styles.css')

    async function boot() {
      try {
        const session = await authApi.me()
        if (session.user) {
          setUser(session.user)
          setSessionTimeoutMs(timeoutFromSession(session))
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
      const previousUserId = user?.id ?? null
      const result = await authApi.login(loginValue, password, remember)
      const sameUser = previousUserId !== null && String(previousUserId) === String(result.user.id)
      setUser(result.user)
      setSessionTimeoutMs(timeoutFromSession(result))
      setState('authenticated')
      setSessionExpired(false)
      if (sameUser) snapshotAllDurableForms()
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar no sistema.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function logout() {
    snapshotAllDurableForms()
    await authApi.logout().catch(() => null)
    setState('guest')
    setSessionExpired(false)
  }

  function selectArea(value: 'embalagem' | 'carregamento') {
    if (area === value) return
    snapshotAllDurableForms()
    setArea(value)
    window.localStorage.setItem('embalagem-area', value)
  }

  if (state === 'booting') {
    return <main className="core-loading"><img src="/assets/img/logo.png" alt="Santi'Lac" /><span>Carregando operação...</span></main>
  }
  if (!user) {
    return <LoginPage loading={isLoggingIn} error={loginError} onLogin={login} variant="factory" />
  }

  return (<>
    <div className="packaging-workspace" data-draft-owner={user.id} key={user.id} aria-hidden={sessionExpired || state === 'guest' || undefined}>
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
    {(sessionExpired || state === 'guest') && <ReauthOverlay expired={sessionExpired} loading={isLoggingIn} error={loginError} onLogin={login} />}
  </>)
}

function ReauthOverlay({ expired, loading, error, onLogin }: {
  expired: boolean
  loading: boolean
  error: string | null
  onLogin: (login: string, password: string, remember: boolean) => Promise<void>
}) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')

  return (
    <main className="session-reauth-backdrop" role="dialog" aria-modal="true" aria-labelledby="session-reauth-title">
      <form className="auth-panel session-reauth-panel" onSubmit={(event) => {
        event.preventDefault()
        void onLogin(login, password, true)
      }}>
        <img className="auth-logo" src="/assets/img/logo.png" alt="Santi'Lac" />
        <h1 id="session-reauth-title">{expired ? 'Sessão expirada' : 'Sessão encerrada'}</h1>
        <p>Seu preenchimento foi preservado. Entre novamente para continuar exatamente de onde parou.</p>
        <label>Usuário<input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} required autoFocus /></label>
        <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error ? <span className="form-error">{error}</span> : null}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Continuar'}</button>
      </form>
    </main>
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