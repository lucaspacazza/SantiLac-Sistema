import { Download, Lock, LogIn, User } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

export function LoginPage({
  loading,
  error,
  onLogin,
}: {
  loading: boolean
  error: string | null
  onLogin: (login: string, password: string, remember: boolean) => Promise<void>
}) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as NavigatorWithStandalone).standalone)
    setIsStandalone(standalone)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onLogin(login, password, remember)
  }

  async function handleInstall() {
    if (!installPrompt) return

    await installPrompt.prompt()
    await installPrompt.userChoice.catch(() => null)
    setInstallPrompt(null)
  }

  return (
    <main className="core-login">
      <section className="login-brand-stage" aria-label="Santi'Lac">
        <img src="/assets/img/logo.png" alt="Santi'Lac" />
      </section>

      <section className="login-side">
        <div className="login-panel">
          <div>
            <span className="eyebrow">Santi'Lac Core</span>
            <h1>Entrar no sistema</h1>
            <p>Acesse a operação central da empresa com seu usuário autorizado.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              <span>Usuário ou e-mail</span>
              <div className="input-with-icon">
                <User size={17} />
                <input
                  autoComplete="username"
                  inputMode="text"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  type="text"
                  required
                />
              </div>
            </label>

            <label>
              <span>Senha</span>
              <div className="input-with-icon">
                <Lock size={17} />
                <input
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                />
              </div>
            </label>

            <label className="check-line">
              <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              Manter sessão neste computador
            </label>

            {error && <span className="form-error">{error}</span>}

            <button className="primary-action" disabled={loading} type="submit">
              <LogIn size={17} />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

          </form>
        </div>
      </section>

      {!isStandalone && installPrompt ? (
        <button className="install-floating" type="button" onClick={handleInstall} title="Instalar aplicativo">
          <Download size={16} />
          Instalar
        </button>
      ) : null}
    </main>
  )
}

