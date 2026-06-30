import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  authApi,
  producaoApi,
  type AuthUser,
  type FormulacaoQueijoCatalogos,
  type FormulacaoQueijoPayload,
  type OrdemProducaoPayload,
  type OrdemProducaoResumo,
  type Overview,
  type SoroRefrigeradoPayload,
} from './api'

type AuthState = 'booting' | 'guest' | 'authenticated'
type LoadState = 'loading' | 'ready' | 'error' | 'saving'
type View = 'inicio' | 'ordens' | 'queijo' | 'soro'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function optionalString(form: FormData, name: string): string | null {
  const value = field(form, name)

  return value === '' ? null : value
}

function optionalNumber(form: FormData, name: string): number | null {
  const value = field(form, name).replace(',', '.')

  return value === '' ? null : Number(value)
}

function submitValue(event: FormEvent<HTMLFormElement>, name: string): string {
  const submitter = (event.nativeEvent as SubmitEvent).submitter

  return submitter instanceof HTMLButtonElement && submitter.name === name ? submitter.value : ''
}

export function App() {
  const [authState, setAuthState] = useState<AuthState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [view, setView] = useState<View>('inicio')
  const [state, setState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('Carregando produção...')
  const [date, setDate] = useState(today())
  const [overview, setOverview] = useState<Overview | null>(null)
  const [ordens, setOrdens] = useState<OrdemProducaoResumo[]>([])
  const [catalogos, setCatalogos] = useState<FormulacaoQueijoCatalogos>({ queijos: [] })

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [view])

  const metrics = useMemo(() => {
    const totals = overview?.totais

    return [
      ['Formulações', totals?.formulacoes_queijo ?? 0],
      ['Soro', totals?.soro_refrigerado ?? 0],
      ['Creme', totals?.producoes_creme ?? 0],
      ['Rascunhos', totals?.rascunhos ?? 0],
    ] as const
  }, [overview])

  async function loadBase(nextDate = date) {
    setState('loading')
    setMessage('Carregando produção...')

    try {
      const [overviewData, ordensData, catalogosData] = await Promise.all([
        producaoApi.overview(),
        producaoApi.ordensProducao(nextDate),
        producaoApi.formulacaoQueijoCatalogos(),
      ])

      setOverview(overviewData)
      setOrdens(ordensData)
      setCatalogos(catalogosData)
      setState('ready')
      setMessage('Pronto para lançamento.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a produção.')
    }
  }

  useEffect(() => {
    async function boot() {
      try {
        await authApi.csrf()
        const session = await authApi.me()

        if (session.user) {
          setUser(session.user)
          setAuthState('authenticated')
          await loadBase()
          return
        }
      } catch {
        setUser(null)
      }

      setAuthState('guest')
      setState('ready')
      setMessage('Identifique o operador para iniciar.')
    }

    void boot()
  }, [])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const result = await authApi.login(field(form, 'login'), field(form, 'password'), true)
      setUser(result.user)
      setAuthState('authenticated')
      await loadBase()
    } catch {
      setLoginError('Usuário ou senha incorretos.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function changeDate(nextDate: string) {
    setDate(nextDate)
    await loadBase(nextDate)
  }

  async function saveOrdem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const litros = field(form, 'litros')
    const payload: OrdemProducaoPayload = {
      data: field(form, 'data'),
      codigo_ordem: optionalString(form, 'codigo_ordem'),
      campos: [
        { rotulo: 'PRODUTO', valor: field(form, 'produto') },
        { rotulo: 'LOTE', valor: field(form, 'lote') },
        { rotulo: 'LTS PRODUZIDOS TOTAL', valor: litros ? `${litros} L` : '' },
      ].filter((item) => item.valor !== ''),
    }

    setState('saving')
    setMessage('Salvando OP...')

    try {
      await producaoApi.salvarOrdemProducao(payload)
      event.currentTarget.reset()
      setDate(payload.data)
      await loadBase(payload.data)
      setMessage('OP salva.')
      setView('inicio')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a OP.')
    }
  }

  async function saveQueijo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const shouldFinalize = submitValue(event, 'finalizar') === '1'
    const payload: FormulacaoQueijoPayload = {
      tipo_queijo: field(form, 'tipo_queijo'),
      data_formulacao: field(form, 'data_formulacao'),
      silo: optionalString(form, 'silo'),
      lote_leite: optionalString(form, 'lote_leite'),
      lote_queijo: field(form, 'lote_queijo'),
      numero_queijomatic: optionalString(form, 'numero_queijomatic'),
      inicio_enchimento: optionalString(form, 'inicio_enchimento'),
      quantidade_leite: optionalNumber(form, 'quantidade_leite'),
      temperatura_pasteurizacao: optionalNumber(form, 'temperatura_pasteurizacao'),
      fosfatase: optionalString(form, 'fosfatase') as FormulacaoQueijoPayload['fosfatase'],
      peroxidase: optionalString(form, 'peroxidase') as FormulacaoQueijoPayload['peroxidase'],
      gordura_inicial: optionalNumber(form, 'gordura_inicial'),
      gordura_final: optionalNumber(form, 'gordura_final'),
      acidez: optionalNumber(form, 'acidez'),
      temperatura_coagulacao: optionalNumber(form, 'temperatura_coagulacao'),
      hora_coagulacao: optionalString(form, 'hora_coagulacao'),
      hora_corte: optionalString(form, 'hora_corte'),
      temperatura_cozimento: optionalNumber(form, 'temperatura_cozimento'),
      insumos: [],
    }

    setState('saving')
    setMessage('Salvando formulação...')

    try {
      const created = await producaoApi.criarFormulacaoQueijo(payload)
      if (shouldFinalize) await producaoApi.finalizarFormulacaoQueijo(created.id)
      event.currentTarget.reset()
      setDate(payload.data_formulacao)
      await loadBase(payload.data_formulacao)
      setMessage(shouldFinalize ? 'Formulação finalizada.' : 'Formulação salva.')
      setView('inicio')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a formulação.')
    }
  }

  async function saveSoro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const shouldFinalize = submitValue(event, 'finalizar') === '1'
    const payload: SoroRefrigeradoPayload = {
      data_registro: field(form, 'data_registro'),
      entrada_diaria_estoque: optionalNumber(form, 'entrada_diaria_estoque'),
      litragem_vendida: optionalNumber(form, 'litragem_vendida'),
      silo_armazenado: optionalString(form, 'silo_armazenado'),
      responsavel: optionalString(form, 'responsavel'),
    }

    setState('saving')
    setMessage('Salvando soro...')

    try {
      const created = await producaoApi.criarSoroRefrigerado(payload)
      if (shouldFinalize) await producaoApi.finalizarSoroRefrigerado(created.id)
      event.currentTarget.reset()
      setDate(payload.data_registro)
      await loadBase(payload.data_registro)
      setMessage(shouldFinalize ? 'Soro finalizado.' : 'Soro salvo.')
      setView('inicio')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o soro.')
    }
  }

  if (authState !== 'authenticated') {
    return (
      <main className="factory-app factory-auth">
        <form className="auth-card" onSubmit={login}>
          <span className="eyebrow">Santi'Lac / Produção</span>
          <h1>{authState === 'booting' ? 'Carregando' : 'Acesso do operador'}</h1>
          <p>{authState === 'booting' ? 'Preparando o tablet.' : 'Entre com o usuário do sistema.'}</p>
          {authState === 'guest' && (
            <>
              <input name="login" placeholder="Usuário ou e-mail" autoComplete="username" required />
              <input name="password" placeholder="Senha" type="password" autoComplete="current-password" required />
              {loginError && <span className="form-error">{loginError}</span>}
              <button type="submit" disabled={isLoggingIn}>{isLoggingIn ? 'Entrando...' : 'Entrar'}</button>
            </>
          )}
        </form>
      </main>
    )
  }

  return (
    <main className="factory-app">
      {view === 'inicio' && (
        <div className="utility-bar">
          <div className="date-actions">
            <input type="date" value={date} onChange={(event) => void changeDate(event.target.value)} />
            <button type="button" onClick={() => void loadBase()}>Atualizar</button>
          </div>
        </div>
      )}

      {(state !== 'ready' || message !== 'Pronto para lançamento.') && (
        <section className={`status-line is-${state}`}>
          <span className="status-dot" />
          {message}
        </section>
      )}

      {view === 'inicio' && (
        <section className="home-grid">
          <section className="metrics-strip">
            <div className="metrics-grid">
              {metrics.map(([label, value]) => (
                <article className="metric-card" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="action-grid">
            <button type="button" onClick={() => setView('ordens')}>
              <strong>OP</strong>
            </button>
            <button type="button" onClick={() => setView('queijo')}>
              <strong>Formulação</strong>
            </button>
            <button type="button" onClick={() => setView('soro')}>
              <strong>Soro</strong>
            </button>
          </section>

          <section className="operations-section">
            <div className="operations-header">
              <h2>OPs</h2>
              <span>{ordens.length}</span>
            </div>
            <div className="list">
              {ordens.length === 0 ? (
                <div className="empty-state">Sem OPs</div>
              ) : ordens.map((ordem) => (
                <article className="list-row" key={ordem.id}>
                  <div>
                    <strong>{ordem.codigo_ordem}</strong>
                    <span>{ordem.tipo_queijo || ordem.lote_queijo || 'Ordem manual'}</span>
                  </div>
                  <em>{ordem.status ?? 'rascunho'}</em>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {view === 'ordens' && (
        <FactoryForm title="Nova OP" onBack={() => setView('inicio')} onSubmit={saveOrdem}>
          <input name="data" type="date" defaultValue={date} required />
          <input name="codigo_ordem" placeholder="Código da OP" />
          <input name="produto" placeholder="Produto" />
          <input name="lote" placeholder="Lote" />
          <input name="litros" inputMode="decimal" placeholder="Litros previstos" />
        </FactoryForm>
      )}

      {view === 'queijo' && (
        <FactoryForm title="Formulação de queijo" onBack={() => setView('inicio')} onSubmit={saveQueijo}>
          <input name="data_formulacao" type="date" defaultValue={date} required />
          <select name="tipo_queijo" required>
            <option value="">Tipo de queijo</option>
            {catalogos.queijos.map((queijo) => (
              <option key={queijo.id} value={queijo.nome}>{queijo.nome}</option>
            ))}
          </select>
          <input name="lote_queijo" placeholder="Lote do queijo" required />
          <input name="lote_leite" placeholder="Lote do leite" />
          <input name="silo" placeholder="Silo" />
          <input name="numero_queijomatic" placeholder="Queijomatic" />
          <input name="inicio_enchimento" type="time" />
          <input name="quantidade_leite" inputMode="decimal" placeholder="Quantidade de leite" />
          <input name="temperatura_pasteurizacao" inputMode="decimal" placeholder="Temperatura pasteurização" />
          <div className="two-columns">
            <select name="fosfatase" defaultValue="">
              <option value="">Fosfatase</option>
              <option value="negativo">Negativo</option>
              <option value="positivo">Positivo</option>
              <option value="nao_aplicavel">Não aplicável</option>
            </select>
            <select name="peroxidase" defaultValue="">
              <option value="">Peroxidase</option>
              <option value="negativo">Negativo</option>
              <option value="positivo">Positivo</option>
              <option value="nao_aplicavel">Não aplicável</option>
            </select>
          </div>
          <div className="two-columns">
            <input name="gordura_inicial" inputMode="decimal" placeholder="Gordura inicial" />
            <input name="gordura_final" inputMode="decimal" placeholder="Gordura final" />
          </div>
          <div className="two-columns">
            <input name="acidez" inputMode="decimal" placeholder="Acidez" />
            <input name="temperatura_coagulacao" inputMode="decimal" placeholder="Temp. coagulação" />
          </div>
          <div className="two-columns">
            <input name="hora_coagulacao" type="time" />
            <input name="hora_corte" type="time" />
          </div>
          <input name="temperatura_cozimento" inputMode="decimal" placeholder="Temp. cozimento" />
        </FactoryForm>
      )}

      {view === 'soro' && (
        <FactoryForm title="Soro refrigerado" onBack={() => setView('inicio')} onSubmit={saveSoro}>
          <input name="data_registro" type="date" defaultValue={date} required />
          <input name="entrada_diaria_estoque" inputMode="decimal" placeholder="Entrada diária" />
          <input name="litragem_vendida" inputMode="decimal" placeholder="Litragem vendida" />
          <input name="silo_armazenado" placeholder="Silo armazenado" />
          <input name="responsavel" placeholder="Responsável" />
        </FactoryForm>
      )}
    </main>
  )
}

function FactoryForm({
  title,
  children,
  onBack,
  onSubmit,
}: {
  title: string
  children: React.ReactNode
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <div className="form-title">
        <button type="button" onClick={onBack}>Voltar</button>
        <h1>{title}</h1>
      </div>
      <div className="fields">{children}</div>
      <div className="form-actions">
        <button type="submit" name="finalizar" value="0">Salvar</button>
        <button className="primary" type="submit" name="finalizar" value="1">Salvar e finalizar</button>
      </div>
    </form>
  )
}
