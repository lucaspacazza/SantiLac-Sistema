import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Beaker,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Droplets,
  Factory,
  FlaskConical,
  Home,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  authApi,
  producaoApi,
  type AuthUser,
  type FormulacaoCremePayload,
  type FormulacaoQueijoCatalogos,
  type FormulacaoQueijoPayload,
  type OrdemProducaoCatalogos,
  type OrdemProducaoPayload,
  type OrdemProducaoResumo,
  type Overview,
  type ProducaoCremePayload,
  type SoroRefrigeradoPayload,
} from './api'
import { localDateValue } from './dateTime'
import { TimeWheelInput } from './TimeWheelPicker'
import { PRODUCTION_WORKFLOWS, type View, type WorkflowId } from './workflows'

type AuthState = 'booting' | 'guest' | 'authenticated'
type LoadState = 'loading' | 'ready' | 'error' | 'saving'

const EMPTY_CHEESE_CATALOGS: FormulacaoQueijoCatalogos = { queijos: [], insumos: [] }
const EMPTY_ORDER_CATALOGS: OrdemProducaoCatalogos = { queijos: [], insumos: [] }

function today(): string {
  return localDateValue()
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
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function optionalInteger(form: FormData, name: string): number | null {
  const value = field(form, name)
  return value === '' ? null : Number.parseInt(value, 10)
}

function submitValue(event: FormEvent<HTMLFormElement>, name: string): string {
  const submitter = (event.nativeEvent as SubmitEvent).submitter
  return submitter instanceof HTMLButtonElement && submitter.name === name ? submitter.value : ''
}

function formatDateInput(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value
}

function DateInput({ name, value, defaultValue, required, onChange }: {
  name?: string
  value?: string
  defaultValue?: string
  required?: boolean
  onChange?: (value: string) => void
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? value ?? '')
  const currentValue = value ?? internalValue

  return (
    <span className="short-date-input">
      <span>{formatDateInput(currentValue)}</span>
      <CalendarDays size={18} aria-hidden="true" />
      <input
        aria-label="Selecionar data"
        name={name}
        type="date"
        value={currentValue}
        required={required}
        onChange={(event) => {
          const nextValue = event.target.value
          setInternalValue(nextValue)
          onChange?.(nextValue)
        }}
      />
    </span>
  )
}

function workflowIcon(id: WorkflowId, size = 22) {
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true }
  if (id === 'ordens') return <ClipboardList {...props} />
  if (id === 'queijo') return <FlaskConical {...props} />
  if (id === 'soro') return <Droplets {...props} />
  if (id === 'formulacao-creme') return <Beaker {...props} />
  return <Factory {...props} />
}

export function App() {
  const [authState, setAuthState] = useState<AuthState>('booting')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [view, setView] = useState<View>('inicio')
  const [state, setState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('')
  const [date, setDate] = useState(today())
  const [overview, setOverview] = useState<Overview | null>(null)
  const [ordens, setOrdens] = useState<OrdemProducaoResumo[]>([])
  const [cheeseCatalogs, setCheeseCatalogs] = useState<FormulacaoQueijoCatalogos>(EMPTY_CHEESE_CATALOGS)
  const [orderCatalogs, setOrderCatalogs] = useState<OrdemProducaoCatalogos>(EMPTY_ORDER_CATALOGS)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [view])

  const summary = useMemo(() => [
    { label: 'OPs do dia', value: ordens.length },
    { label: 'Rascunhos', value: overview?.totais.rascunhos ?? 0 },
    { label: 'Aguardando formato', value: overview?.totais.ops_aguardando_formato ?? 0 },
  ], [ordens.length, overview])

  async function loadBase(nextDate = date) {
    setState('loading')
    setMessage('Atualizando dados')

    try {
      const [overviewData, ordensData, cheeseData, orderData] = await Promise.all([
        producaoApi.overview(),
        producaoApi.ordensProducao(nextDate),
        producaoApi.formulacaoQueijoCatalogos(),
        producaoApi.ordensProducaoCatalogos(),
      ])

      setOverview(overviewData)
      setOrdens(ordensData)
      setCheeseCatalogs(cheeseData)
      setOrderCatalogs(orderData)
      setState('ready')
      setMessage('')
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

  async function finishSave(
    event: FormEvent<HTMLFormElement>,
    dateValue: string,
    action: () => Promise<{ id: number }>,
    finalize?: (id: number) => Promise<unknown>,
  ) {
    const formElement = event.currentTarget
    const shouldFinalize = submitValue(event, 'finalizar') === '1'
    setState('saving')
    setMessage(shouldFinalize ? 'Salvando e finalizando' : 'Salvando rascunho')

    try {
      const created = await action()
      if (shouldFinalize && finalize) await finalize(created.id)
      formElement.reset()
      setDate(dateValue)
      await loadBase(dateValue)
      setMessage(shouldFinalize ? 'Ficha finalizada' : 'Rascunho salvo')
      setView('inicio')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a ficha.')
    }
  }

  async function saveOrdem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const data = field(form, 'data')
    const produto = field(form, 'produto_codigo').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const lote = field(form, 'lote_codigo').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const litros = field(form, 'lts_total')
    const campos: OrdemProducaoPayload['campos'] = [
      { rotulo: 'PRODUÇÃO DIARIA / DATA', valor: formatDateInput(data) },
    ]

    if (litros !== '') campos.push({ rotulo: 'LTS PRODUZIDOS TOTAL', valor: `${litros} L` })
    const produtoRotulo = field(form, 'produto_op_rotulo')
    if (produtoRotulo !== '') campos.push({ rotulo: produtoRotulo, valor: '' })

    const insumoRotulos = form.getAll('insumo_op_rotulo')
    const insumoQuantidades = form.getAll('insumo_quantidade')
    const insumoUnidades = form.getAll('insumo_unidade')
    insumoQuantidades.forEach((quantity, index) => {
      const value = String(quantity ?? '').trim()
      const label = String(insumoRotulos[index] ?? '').trim()
      const unit = String(insumoUnidades[index] ?? '').trim()
      if (value !== '' && label !== '') campos.push({ rotulo: label, valor: unit ? `${value} ${unit}` : value })
    })

    const payload: OrdemProducaoPayload = {
      data,
      codigo_ordem: `op${produto}${lote}`,
      campos,
    }

    setState('saving')
    setMessage('Salvando OP')
    try {
      await producaoApi.salvarOrdemProducao(payload)
      formElement.reset()
      setDate(data)
      await loadBase(data)
      setMessage('OP salva')
      setView('inicio')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a OP.')
    }
  }

  async function saveQueijo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const insumoTypes = form.getAll('insumo_tipo')
    const insumoNames = form.getAll('insumo_nome')
    const insumoQuantities = form.getAll('insumo_quantidade')
    const insumoUnits = form.getAll('insumo_unidade')
    const insumoLots = form.getAll('insumo_lote')

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
      insumos: insumoQuantities.flatMap((quantity, index) => {
        const parsed = Number(String(quantity).replace(',', '.'))
        const unit = String(insumoUnits[index] ?? '').trim()
        if (!Number.isFinite(parsed) || parsed <= 0 || unit === '') return []
        return [{
          tipo_insumo: String(insumoTypes[index] ?? 'outro') as FormulacaoQueijoPayload['insumos'][number]['tipo_insumo'],
          nome_insumo: String(insumoNames[index] ?? '').trim() || null,
          quantidade: parsed,
          unidade: unit,
          lote_insumo: String(insumoLots[index] ?? '').trim() || null,
        }]
      }),
    }

    await finishSave(
      event,
      payload.data_formulacao,
      () => producaoApi.criarFormulacaoQueijo(payload),
      producaoApi.finalizarFormulacaoQueijo,
    )
  }

  async function saveSoro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload: SoroRefrigeradoPayload = {
      data_registro: field(form, 'data_registro'),
      entrada_diaria_estoque: optionalNumber(form, 'entrada_diaria_estoque'),
      litragem_vendida: optionalNumber(form, 'litragem_vendida'),
      silo_armazenado: optionalString(form, 'silo_armazenado'),
      responsavel: optionalString(form, 'responsavel'),
    }
    await finishSave(event, payload.data_registro, () => producaoApi.criarSoroRefrigerado(payload), producaoApi.finalizarSoroRefrigerado)
  }

  async function saveFormulacaoCreme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload: FormulacaoCremePayload = {
      data_fabricacao: field(form, 'data_fabricacao'),
      lote_creme_produzido: field(form, 'lote_creme_produzido'),
      tipo_creme: field(form, 'tipo_creme'),
      mes: optionalInteger(form, 'mes'),
      ano: optionalInteger(form, 'ano'),
      gordura_inicial: optionalNumber(form, 'gordura_inicial'),
      gordura_final: optionalNumber(form, 'gordura_final'),
      acidez: optionalNumber(form, 'acidez'),
      responsavel_monitoramento: optionalString(form, 'responsavel_monitoramento'),
      responsavel: optionalString(form, 'responsavel'),
    }
    await finishSave(event, payload.data_fabricacao, () => producaoApi.criarFormulacaoCreme(payload), producaoApi.finalizarFormulacaoCreme)
  }

  async function saveProducaoCreme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const payload: ProducaoCremePayload = {
      data_fabricacao: field(form, 'data_fabricacao'),
      lote_creme_produzido: field(form, 'lote_creme_produzido'),
      tipo_creme: field(form, 'tipo_creme'),
      mes: optionalInteger(form, 'mes'),
      ano: optionalInteger(form, 'ano'),
      quantidade_produzida_kg: optionalNumber(form, 'quantidade_produzida_kg'),
      responsavel_monitoramento: optionalString(form, 'responsavel_monitoramento'),
      responsavel: optionalString(form, 'responsavel'),
    }
    await finishSave(event, payload.data_fabricacao, () => producaoApi.criarProducaoCreme(payload), producaoApi.finalizarProducaoCreme)
  }

  if (authState !== 'authenticated') {
    return (
      <main className="factory-auth">
        <form className="auth-panel" onSubmit={login}>
          <img className="auth-logo" src="https://sistema.santilac.com.br/assets/img/logo.png" alt="Santi'Lac" />
          {authState === 'guest' && (
            <>
              <label>Usuário<input name="login" autoComplete="username" required /></label>
              <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
              {loginError && <span className="form-error">{loginError}</span>}
              <button className="primary-button" type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? 'Entrando…' : 'Entrar'}
              </button>
            </>
          )}
        </form>
      </main>
    )
  }

  return (
    <div className="factory-shell">
      <aside className="process-rail" aria-label="Processos da produção">
        <button className={`rail-home ${view === 'inicio' ? 'is-active' : ''}`} type="button" onClick={() => setView('inicio')} aria-label="Início">
          <Home size={23} />
        </button>
        <div className="rail-divider" />
        {PRODUCTION_WORKFLOWS.map((workflow) => (
          <button
            className={view === workflow.id ? 'is-active' : ''}
            key={workflow.id}
            type="button"
            onClick={() => setView(workflow.id)}
          >
            {workflowIcon(workflow.id)}
            <span>{workflow.shortLabel}</span>
          </button>
        ))}
      </aside>

      <main className="factory-workspace">
        <header className="utility-bar">
          <label className="date-control">
            <span>Data</span>
            <DateInput value={date} onChange={(nextDate) => void changeDate(nextDate)} />
          </label>
          <button className="icon-button" type="button" onClick={() => void loadBase()} aria-label="Atualizar">
            <RefreshCw size={20} className={state === 'loading' ? 'is-spinning' : ''} />
          </button>
          <div className="operator-chip"><UserRound size={18} /><span>{user?.nome ?? user?.usuario}</span></div>
        </header>

        {message && (
          <div className={`system-message is-${state}`} role="status">
            <span />{message}
          </div>
        )}

        {view === 'inicio' && (
          <div className="operations-home">
            <section className="summary-band" aria-label="Resumo do dia">
              {summary.map((item) => (
                <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>
              ))}
            </section>

            <div className="workbench-grid">
              <section className="work-list">
                <div className="section-heading">
                  <div><span className="section-kicker">Hoje</span><h1>Ordens de produção</h1></div>
                  <button className="compact-button" type="button" onClick={() => setView('ordens')}><Plus size={18} />Nova OP</button>
                </div>
                <div className="order-list">
                  {ordens.length === 0 ? (
                    <div className="empty-state"><ClipboardList size={24} /><span>Nenhuma OP para esta data</span></div>
                  ) : ordens.map((order) => (
                    <article className="order-row" key={order.id}>
                      <span className={`order-status is-${order.status ?? 'rascunho'}`} />
                      <div><strong>{order.codigo_ordem}</strong><span>{order.tipo_queijo || order.lote_queijo || 'Ordem manual'}</span></div>
                      <em>{order.status?.replace('_', ' ') ?? 'rascunho'}</em>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="launch-list">
                <div className="section-heading"><div><span className="section-kicker">Novo</span><h2>Lançamento</h2></div></div>
                {PRODUCTION_WORKFLOWS.map((workflow) => (
                  <button key={workflow.id} type="button" onClick={() => setView(workflow.id)}>
                    <span className="launch-icon">{workflowIcon(workflow.id, 20)}</span>
                    <strong>{workflow.label}</strong>
                    <ChevronRight size={19} />
                  </button>
                ))}
              </aside>
            </div>
          </div>
        )}

        {view === 'ordens' && <OrderForm key={`${view}-${date}`} date={date} catalogs={orderCatalogs} onBack={() => setView('inicio')} onSubmit={saveOrdem} />}
        {view === 'queijo' && <CheeseForm key={`${view}-${date}`} date={date} catalogs={cheeseCatalogs} onBack={() => setView('inicio')} onSubmit={saveQueijo} />}
        {view === 'soro' && <SoroForm key={`${view}-${date}`} date={date} onBack={() => setView('inicio')} onSubmit={saveSoro} />}
        {view === 'formulacao-creme' && <CreamFormulaForm key={`${view}-${date}`} date={date} onBack={() => setView('inicio')} onSubmit={saveFormulacaoCreme} />}
        {view === 'producao-creme' && <CreamProductionForm key={`${view}-${date}`} date={date} onBack={() => setView('inicio')} onSubmit={saveProducaoCreme} />}
      </main>
    </div>
  )
}

function FactoryForm({ title, code, children, onBack, onSubmit, singleAction = false }: {
  title: string
  code: string
  children: ReactNode
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  singleAction?: boolean
}) {
  return (
    <form className="factory-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={20} />Voltar</button>
        <div><span className="section-kicker">{code}</span><h1>{title}</h1></div>
      </div>
      <div className="form-body">{children}</div>
      <div className="form-footer">
        {!singleAction && <button className="secondary-button" type="submit" name="finalizar" value="0"><Save size={19} />Salvar rascunho</button>}
        <button className="primary-button" type="submit" name="finalizar" value={singleAction ? '0' : '1'}><Save size={19} />{singleAction ? 'Salvar OP' : 'Salvar e finalizar'}</button>
      </div>
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="form-section"><legend>{title}</legend><div className="field-grid">{children}</div></fieldset>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? 'field is-wide' : 'field'}><span>{label}</span>{children}</label>
}

function OrderForm({ date, catalogs, onBack, onSubmit }: {
  date: string
  catalogs: OrdemProducaoCatalogos
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [cheeseId, setCheeseId] = useState(String(catalogs.queijos[0]?.id ?? ''))
  const [format, setFormat] = useState('f4')
  const [rows, setRows] = useState([1])
  const [selectedInputs, setSelectedInputs] = useState<Record<number, string>>({})
  const cheese = catalogs.queijos.find((item) => String(item.id) === cheeseId) ?? null
  const productLabel = cheese?.precisa_formato ? `PEÇAS ${format.toUpperCase()}` : cheese?.op_rotulo ?? ''

  useEffect(() => {
    if (!cheeseId && catalogs.queijos[0]) setCheeseId(String(catalogs.queijos[0].id))
  }, [catalogs.queijos, cheeseId])

  return (
    <FactoryForm title="Ordem de produção" code="OP" onBack={onBack} onSubmit={onSubmit} singleAction>
      <FormSection title="Identificação">
        <Field label="Data"><DateInput name="data" defaultValue={date} required /></Field>
        <Field label="Produto"><select value={cheeseId} onChange={(event) => setCheeseId(event.target.value)} required><option value="">Selecionar</option>{catalogs.queijos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Lote"><input name="lote_codigo" required /></Field>
        {cheese?.precisa_formato && <Field label="Formato"><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="f1">F1</option><option value="f4">F4</option><option value="f6">F6</option></select></Field>}
        <Field label="Litros"><input name="lts_total" inputMode="decimal" /></Field>
        <input name="produto_codigo" type="hidden" value={cheese?.codigo_balanca || cheese?.id || ''} />
        <input name="produto_op_rotulo" type="hidden" value={productLabel} />
      </FormSection>
      <FormSection title="Insumos">
        <div className="repeat-list is-wide">
          {rows.map((rowId, index) => {
            const selected = catalogs.insumos.find((item) => String(item.id) === selectedInputs[rowId]) ?? null
            return (
              <div className="repeat-row" key={rowId}>
                <span>{index + 1}</span>
                <select aria-label={`Insumo ${index + 1}`} value={selectedInputs[rowId] ?? ''} onChange={(event) => setSelectedInputs((current) => ({ ...current, [rowId]: event.target.value }))}><option value="">Selecionar insumo</option>{catalogs.insumos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
                <input name="insumo_quantidade" inputMode="decimal" placeholder="Quantidade" />
                <strong>{selected?.unidade ?? '—'}</strong>
                <input name="insumo_op_rotulo" type="hidden" value={selected?.op_rotulo ?? ''} />
                <input name="insumo_unidade" type="hidden" value={selected?.unidade ?? ''} />
                <button type="button" aria-label="Remover insumo" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((id) => id !== rowId))}><Trash2 size={18} /></button>
              </div>
            )
          })}
          <button className="add-row-button" type="button" onClick={() => setRows((current) => [...current, Math.max(...current) + 1])}><Plus size={18} />Adicionar insumo</button>
        </div>
      </FormSection>
    </FactoryForm>
  )
}

function CheeseForm({ date, catalogs, onBack, onSubmit }: {
  date: string
  catalogs: FormulacaoQueijoCatalogos
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [rows, setRows] = useState([1])
  const [selectedInputs, setSelectedInputs] = useState<Record<number, string>>({})

  return (
    <FactoryForm title="Formulação de queijo" code="PLAN 6.3" onBack={onBack} onSubmit={onSubmit}>
      <FormSection title="Lote">
        <Field label="Data"><DateInput name="data_formulacao" defaultValue={date} required /></Field>
        <Field label="Tipo de queijo"><select name="tipo_queijo" required><option value="">Selecionar</option>{catalogs.queijos.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select></Field>
        <Field label="Lote do queijo"><input name="lote_queijo" required /></Field>
        <Field label="Lote do leite"><input name="lote_leite" /></Field>
        <Field label="Silo"><input name="silo" /></Field>
        <Field label="Queijomatic"><input name="numero_queijomatic" /></Field>
      </FormSection>
      <FormSection title="Processo">
        <Field label="Início do enchimento"><TimeWheelInput name="inicio_enchimento" label="Início do enchimento" /></Field>
        <Field label="Leite (L)"><input name="quantidade_leite" inputMode="decimal" /></Field>
        <Field label="Pasteurização (°C)"><input name="temperatura_pasteurizacao" inputMode="decimal" /></Field>
        <Field label="Fosfatase"><select name="fosfatase"><option value="">Selecionar</option><option value="negativo">Negativo</option><option value="positivo">Positivo</option><option value="nao_aplicavel">Não aplicável</option></select></Field>
        <Field label="Peroxidase"><select name="peroxidase"><option value="">Selecionar</option><option value="negativo">Negativo</option><option value="positivo">Positivo</option><option value="nao_aplicavel">Não aplicável</option></select></Field>
        <Field label="Gordura inicial"><input name="gordura_inicial" inputMode="decimal" /></Field>
        <Field label="Gordura final"><input name="gordura_final" inputMode="decimal" /></Field>
        <Field label="Acidez"><input name="acidez" inputMode="decimal" /></Field>
        <Field label="Coagulação (°C)"><input name="temperatura_coagulacao" inputMode="decimal" /></Field>
        <Field label="Hora da coagulação"><TimeWheelInput name="hora_coagulacao" label="Hora da coagulação" /></Field>
        <Field label="Hora do corte"><TimeWheelInput name="hora_corte" label="Hora do corte" /></Field>
        <Field label="Cozimento (°C)"><input name="temperatura_cozimento" inputMode="decimal" /></Field>
      </FormSection>
      <FormSection title="Insumos">
        <div className="repeat-list is-wide">
          {rows.map((rowId, index) => {
            const selected = catalogs.insumos.find((item) => String(item.id) === selectedInputs[rowId]) ?? null
            return (
              <div className="repeat-row repeat-row-cheese" key={rowId}>
                <span>{index + 1}</span>
                <select aria-label={`Insumo ${index + 1}`} value={selectedInputs[rowId] ?? ''} onChange={(event) => setSelectedInputs((current) => ({ ...current, [rowId]: event.target.value }))}><option value="">Selecionar insumo</option>{catalogs.insumos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
                <input name="insumo_quantidade" inputMode="decimal" placeholder="Quantidade" />
                <input name="insumo_lote" placeholder="Lote" />
                <strong>{selected?.unidade ?? '—'}</strong>
                <input name="insumo_tipo" type="hidden" value={selected?.tipo_insumo ?? 'outro'} />
                <input name="insumo_nome" type="hidden" value={selected?.nome ?? ''} />
                <input name="insumo_unidade" type="hidden" value={selected?.unidade ?? ''} />
                <button type="button" aria-label="Remover insumo" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((id) => id !== rowId))}><Trash2 size={18} /></button>
              </div>
            )
          })}
          <button className="add-row-button" type="button" onClick={() => setRows((current) => [...current, Math.max(...current) + 1])}><Plus size={18} />Adicionar insumo</button>
        </div>
      </FormSection>
    </FactoryForm>
  )
}

function SoroForm({ date, onBack, onSubmit }: { date: string; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <FactoryForm title="Soro refrigerado" code="PLAN 6.7" onBack={onBack} onSubmit={onSubmit}>
      <FormSection title="Movimentação">
        <Field label="Data"><DateInput name="data_registro" defaultValue={date} required /></Field>
        <Field label="Entrada (L)"><input name="entrada_diaria_estoque" inputMode="decimal" /></Field>
        <Field label="Saída / venda (L)"><input name="litragem_vendida" inputMode="decimal" /></Field>
        <Field label="Silo"><input name="silo_armazenado" /></Field>
        <Field label="Responsável"><input name="responsavel" /></Field>
      </FormSection>
    </FactoryForm>
  )
}

const creamTypes = ['Creme de Leite de Uso Industrial', 'Creme de Soro de Uso Industrial']

function CreamFormulaForm({ date, onBack, onSubmit }: { date: string; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <FactoryForm title="Formulação de creme" code="PLAN 6.9" onBack={onBack} onSubmit={onSubmit}>
      <FormSection title="Lote">
        <Field label="Data"><DateInput name="data_fabricacao" defaultValue={date} required /></Field>
        <Field label="Lote do creme"><input name="lote_creme_produzido" required /></Field>
        <Field label="Tipo de creme"><select name="tipo_creme" required><option value="">Selecionar</option>{creamTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Mês"><input name="mes" type="number" min="1" max="12" defaultValue={new Date(`${date}T12:00:00`).getMonth() + 1} /></Field>
        <Field label="Ano"><input name="ano" type="number" min="2020" max="2100" defaultValue={date.slice(0, 4)} /></Field>
      </FormSection>
      <FormSection title="Análises">
        <Field label="Gordura inicial"><input name="gordura_inicial" inputMode="decimal" /></Field>
        <Field label="Gordura final"><input name="gordura_final" inputMode="decimal" /></Field>
        <Field label="Acidez (°D)"><input name="acidez" inputMode="decimal" /></Field>
        <Field label="Monitoramento"><input name="responsavel_monitoramento" /></Field>
        <Field label="Responsável"><input name="responsavel" /></Field>
      </FormSection>
    </FactoryForm>
  )
}

function CreamProductionForm({ date, onBack, onSubmit }: { date: string; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <FactoryForm title="Produção de creme" code="PLAN 6.10" onBack={onBack} onSubmit={onSubmit}>
      <FormSection title="Produção">
        <Field label="Data"><DateInput name="data_fabricacao" defaultValue={date} required /></Field>
        <Field label="Lote do creme"><input name="lote_creme_produzido" required /></Field>
        <Field label="Tipo de creme"><select name="tipo_creme" required><option value="">Selecionar</option>{creamTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Quantidade (kg)"><input name="quantidade_produzida_kg" inputMode="decimal" /></Field>
        <Field label="Mês"><input name="mes" type="number" min="1" max="12" defaultValue={new Date(`${date}T12:00:00`).getMonth() + 1} /></Field>
        <Field label="Ano"><input name="ano" type="number" min="2020" max="2100" defaultValue={date.slice(0, 4)} /></Field>
        <Field label="Monitoramento"><input name="responsavel_monitoramento" /></Field>
        <Field label="Responsável"><input name="responsavel" /></Field>
      </FormSection>
    </FactoryForm>
  )
}
