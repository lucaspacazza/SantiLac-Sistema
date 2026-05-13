import { useEffect, useState } from 'react'
import { authApi, type AuthUser } from './api/authApi'
import { QualidadeModule } from './modules/qualidade/QualidadeModule'
import { LoginPage } from './pages/LoginPage'
import { SystemHome, type SystemModule } from './pages/SystemHome'

type AppState = 'booting' | 'guest' | 'authenticated'

export function App() {
  const [state, setState] = useState<AppState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [activeModule, setActiveModule] = useState<SystemModule | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
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

  async function handleLogin(email: string, password: string, remember: boolean) {
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const result = await authApi.login(email, password, remember)
      setUser(result.user)
      setState('authenticated')
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Não foi possível entrar no sistema.')
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

  if (activeModule === 'qualidade') {
    return <QualidadeModule user={user} onBackToSystem={() => setActiveModule(null)} onLogout={handleLogout} />
  }

  return (
    <SystemHome
      user={user}
      onOpenModule={setActiveModule}
      onLogout={handleLogout}
    />
  )
}
