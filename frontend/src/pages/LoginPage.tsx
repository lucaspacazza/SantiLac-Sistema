import { Lock, LogIn, Mail } from 'lucide-react'
import { FormEvent, useState } from 'react'

export function LoginPage({
  loading,
  error,
  onLogin,
}: {
  loading: boolean
  error: string | null
  onLogin: (email: string, password: string, remember: boolean) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onLogin(email, password, remember)
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
              <span>E-mail</span>
              <div className="input-with-icon">
                <Mail size={17} />
                <input
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
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
    </main>
  )
}
