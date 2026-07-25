import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Beaker,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  Factory,
  FlaskConical,
  Home,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  AUTH_EXPIRED_EVENT,
  SESSION_ACTIVITY_EVENT,
  authApi,
  producaoApi,
  type AuthSession,
  type AuthUser,
  type FormulacaoCremePayload,
  type FormulacaoQueijo,
  type FormulacaoQueijoCatalogos,
  type FormulacaoQueijoPayload,
  type OrdemProducaoCatalogos,
  type OrdemProducaoDetalhe,
  type OrdemProducaoPayload,
  type OrdemProducaoResumo,
  type Overview,
  type ProducaoCremePayload,
  type SoroRefrigeradoPayload,
} from './api'
import { localDateValue } from './dateTime'
import {
  bindFormDraft,
  clearFormDraft,
  draftFieldCount,
  draftFieldValue,
  readFormDraft,
} from './drafts'
import { KioskSelect, type KioskSelectOption } from './KioskSelect'
import { TimeWheelInput } from './TimeWheelPicker'
import { PRODUCTION_WORKFLOWS, type View, type WorkflowId } from './workflows'

type AuthState = 'booting' | 'guest' | 'authenticated'
type LoadState = 'loading' | 'ready' | 'error' | 'saving'
type ConfirmationRequest = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
}

const EMPTY_CHEESE_CATALOGS: FormulacaoQueijoCatalogos = { queijos: [], insumos: [] }
const EMPTY_ORDER_CATALOGS: OrdemProducaoCatalogos = { queijos: [], insumos: [] }
const formatOptions: KioskSelectOption[] = [
  { value: 'f1', label: 'F1' },
  { value: 'f4', label: 'F4' },
  { value: 'f6', label: 'F6' },
]
const analysisOptions: KioskSelectOption[] = [
  { value: 'negativo', label: 'Negativo' },
  { value: 'positivo', label: 'Positivo' },
  { value: 'nao_aplicavel', label: 'Não aplicável' },
]
const SESSION_CHECK_INTERVAL = 30_000
const DEFAULT_SESSION_TIMEOUT_MS = 120 * 60 * 1000
const DraftOwnerContext = createContext('anonymous')

function timeoutFromSession(session: Pick<AuthSession, 'session_lifetime_seconds'>): number {
  const seconds = Number(session.session_lifetime_seconds)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_SESSION_TIMEOUT_MS
}

function useDraftKey(formName: string): string {
  return `${useContext(DraftOwnerContext)}:${formName}`
}

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
  const [sessionExpired, setSessionExpired] = useState(false)
  const [sessionTimeoutMs, setSessionTimeoutMs] = useState(DEFAULT_SESSION_TIMEOUT_MS)
  const lastSessionActivityRef = useRef(Date.now())
  const [view, setView] = useState<View>('inicio')
  const [state, setState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('')
  const [date, setDate] = useState(today())
  const [overview, setOverview] = useState<Overview | null>(null)
  const [ordens, setOrdens] = useState<OrdemProducaoResumo[]>([])
  const [openOrders, setOpenOrders] = useState<OrdemProducaoResumo[]>([])
  const [orderEditorOpen, setOrderEditorOpen] = useState(false)
  const [activeOrder, setActiveOrder] = useState<OrdemProducaoDetalhe | null>(null)
  const orderSavingRef = useRef(false)
  const [cheeseCatalogs, setCheeseCatalogs] = useState<FormulacaoQueijoCatalogos>(EMPTY_CHEESE_CATALOGS)
  const [orderCatalogs, setOrderCatalogs] = useState<OrdemProducaoCatalogos>(EMPTY_ORDER_CATALOGS)
  const [openCheeseFormulas, setOpenCheeseFormulas] = useState<FormulacaoQueijo[]>([])
  const [cheeseEditorOpen, setCheeseEditorOpen] = useState(false)
  const [activeCheeseFormula, setActiveCheeseFormula] = useState<FormulacaoQueijo | null>(null)
  const cheeseSavingRef = useRef(false)
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null)
  const confirmationResolverRef = useRef<((answer: boolean) => void) | null>(null)

  function askConfirmation(request: ConfirmationRequest): Promise<boolean> {
    confirmationResolverRef.current?.(false)
    setConfirmation(request)

    return new Promise((resolve) => {
      confirmationResolverRef.current = resolve
    })
  }

  function answerConfirmation(answer: boolean) {
    const resolve = confirmationResolverRef.current
    confirmationResolverRef.current = null
    setConfirmation(null)
    resolve?.(answer)
  }

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
      const [overviewData, ordensData, openOrdersData, cheeseData, orderData, openFormulas] = await Promise.all([
        producaoApi.overview(),
        producaoApi.ordensProducao(nextDate),
        producaoApi.ordensProducaoAbertas(),
        producaoApi.formulacaoQueijoCatalogos(),
        producaoApi.ordensProducaoCatalogos(),
        producaoApi.formulacoesQueijoAbertas(),
      ])

      setOverview(overviewData)
      setOrdens(ordensData)
      setOpenOrders(openOrdersData)
      setCheeseCatalogs(cheeseData)
      setOrderCatalogs(orderData)
      setOpenCheeseFormulas(openFormulas.items)
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
          setSessionTimeoutMs(timeoutFromSession(session))
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

  useEffect(() => {
    if (authState !== 'authenticated') return
    let checking = false

    const requireLogin = () => {
      setSessionExpired(true)
      setState('ready')
      setMessage('Sessão expirada. Entre novamente para continuar de onde parou.')
    }
    const noteSessionActivity = () => {
      lastSessionActivityRef.current = Date.now()
    }
    const checkLocalExpiry = () => {
      if (Date.now() - lastSessionActivityRef.current >= sessionTimeoutMs) requireLogin()
    }
    const checkSession = async () => {
      if (checking || sessionExpired) return
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
        // HTTP 401/419 emits AUTH_EXPIRED_EVENT. A connection failure alone
        // must not discard or unmount the operator's current form.
      } finally {
        checking = false
      }
    }
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkSession()
    }
    noteSessionActivity()
    const interval = window.setInterval(checkLocalExpiry, SESSION_CHECK_INTERVAL)

    window.addEventListener(AUTH_EXPIRED_EVENT, requireLogin)
    window.addEventListener(SESSION_ACTIVITY_EVENT, noteSessionActivity)
    window.addEventListener('focus', checkSession)
    document.addEventListener('visibilitychange', checkWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(AUTH_EXPIRED_EVENT, requireLogin)
      window.removeEventListener(SESSION_ACTIVITY_EVENT, noteSessionActivity)
      window.removeEventListener('focus', checkSession)
      document.removeEventListener('visibilitychange', checkWhenVisible)
    }
  }, [authState, sessionExpired, sessionTimeoutMs])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const resumingExpiredSession = sessionExpired
      const result = await authApi.login(field(form, 'login'), field(form, 'password'), true)
      setUser(result.user)
      setSessionTimeoutMs(timeoutFromSession(result))
      setAuthState('authenticated')
      setSessionExpired(false)
      if (resumingExpiredSession) {
        setState('ready')
        setMessage('Sessão renovada. Seu preenchimento foi mantido.')
      } else {
        await loadBase()
      }
    } catch {
      setLoginError('Usuário ou senha incorretos.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function logout() {
    setState('saving')
    setMessage('Encerrando sessão')

    try {
      await authApi.logout()
      setUser(null)
      setAuthState('guest')
      setSessionExpired(false)
      setView('inicio')
      setMessage('')
      setLoginError(null)
      setOverview(null)
      setOrdens([])
      setOpenOrders([])
      setOpenCheeseFormulas([])
      setActiveOrder(null)
      setActiveCheeseFormula(null)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível sair.')
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
      clearFormDraft(formElement.dataset.draftKey)
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
    if (orderSavingRef.current) return

    orderSavingRef.current = true
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
      clearFormDraft(formElement.dataset.draftKey)
      formElement.reset()
      setDate(data)
      await loadBase(data)
      setMessage('OP salva')
      setOrderEditorOpen(false)
      setView('ordens')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a OP.')
    } finally {
      orderSavingRef.current = false
    }
  }

  async function openOrder(id: number) {
    setState('loading')
    setMessage('Carregando OP')

    try {
      setActiveOrder(await producaoApi.ordemProducao(id))
      setMessage('')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a OP.')
    }
  }

  async function finalizeOrder() {
    if (!activeOrder || orderSavingRef.current) return

    orderSavingRef.current = true
    setState('saving')
    setMessage('Finalizando OP')

    try {
      await producaoApi.finalizarOrdemProducao(activeOrder.id)
      await loadBase(activeOrder.data ?? date)
      setActiveOrder(null)
      setMessage('OP finalizada')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível finalizar a OP.')
    } finally {
      orderSavingRef.current = false
    }
  }

  async function defineOrderFormat(format: 'f1' | 'f4' | 'f6') {
    if (!activeOrder || orderSavingRef.current || activeOrder.status !== 'aguardando_formato') return

    orderSavingRef.current = true
    setState('saving')
    setMessage('Definindo formato e finalizando OP')

    try {
      await producaoApi.definirFormatoOrdemProducao(activeOrder.id, format)
      await loadBase(activeOrder.data ?? date)
      setActiveOrder(null)
      setMessage('Formato definido e OP finalizada')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível finalizar a OP de mussarela.')
    } finally {
      orderSavingRef.current = false
    }
  }

  async function updateOrder(payload: OrdemProducaoPayload) {
    if (!activeOrder || orderSavingRef.current || activeOrder.status !== 'rascunho') return

    orderSavingRef.current = true
    setState('saving')
    setMessage('Salvando alterações da OP')

    try {
      const updated = await producaoApi.atualizarOrdemProducao(activeOrder.id, payload)
      setActiveOrder(updated)
      setDate(payload.data)
      await loadBase(payload.data)
      setMessage('Alterações da OP salvas')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a OP.')
    } finally {
      orderSavingRef.current = false
    }
  }

  async function cancelOrder() {
    if (!activeOrder || orderSavingRef.current) return
    const confirmed = await askConfirmation({
      title: 'Excluir OP?',
      message: `A OP ${activeOrder.codigo_ordem} será excluída definitivamente. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Sim',
      cancelLabel: 'Não',
      destructive: true,
    })
    if (!confirmed) return

    orderSavingRef.current = true
    setState('saving')
    setMessage('Excluindo OP')

    try {
      await producaoApi.cancelarOrdemProducao(activeOrder.id)
      await loadBase(activeOrder.data ?? date)
      setActiveOrder(null)
      setMessage('OP excluída')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a OP.')
    } finally {
      orderSavingRef.current = false
    }
  }

  async function saveQueijo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (cheeseSavingRef.current) return

    cheeseSavingRef.current = true
    const formElement = event.currentTarget
    const form = new FormData(formElement)
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

    const action = submitValue(event, 'acao')
    const shouldGenerateOrder = action === 'finalizar' && await askConfirmation({
      title: 'Gerar OP automaticamente?',
      message: 'Deseja finalizar a formulação e gerar a OP com os dados atuais?',
      confirmLabel: 'Sim',
      cancelLabel: 'Não',
    })
    let generatedOrderCode: string | null = null
    setState('saving')
    setMessage(action === 'finalizar' ? 'Salvando alterações' : 'Salvando formulação')

    try {
      const saved = activeCheeseFormula
        ? await producaoApi.atualizarFormulacaoQueijo(activeCheeseFormula.id, payload)
        : await producaoApi.criarFormulacaoQueijo(payload)
      clearFormDraft(formElement.dataset.draftKey)

      if (action === 'finalizar') {
        await producaoApi.finalizarFormulacaoQueijo(saved.id)

        if (shouldGenerateOrder) {
          try {
            const generatedOrder = await producaoApi.gerarOpFormulacaoQueijo(saved.id)
            generatedOrderCode = generatedOrder.codigo_ordem
          } catch (error) {
            setActiveCheeseFormula(null)
            setCheeseEditorOpen(false)
            setDate(payload.data_formulacao)
            await loadBase(payload.data_formulacao)
            setView('queijo')
            setState('error')
            setMessage(error instanceof Error
              ? `Formulação finalizada, mas a OP não foi gerada: ${error.message}`
              : 'Formulação finalizada, mas a OP não foi gerada.')
            return
          }
        }

        setActiveCheeseFormula(null)
        setCheeseEditorOpen(false)
      } else {
        setActiveCheeseFormula(saved)
      }

      setDate(payload.data_formulacao)
      await loadBase(payload.data_formulacao)
      setView('queijo')
      if (action !== 'finalizar') {
        setMessage('Formulação salva. Você pode continuar editando.')
      } else if (generatedOrderCode) {
        setMessage(`Formulação finalizada. OP ${generatedOrderCode} gerada.`)
      } else if (!shouldGenerateOrder) {
        setMessage('Formulação finalizada')
      }
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a formulação.')
    } finally {
      cheeseSavingRef.current = false
    }
  }

  async function cancelCheeseFormula() {
    if (!activeCheeseFormula || cheeseSavingRef.current) return
    const confirmed = await askConfirmation({
      title: 'Excluir formulação?',
      message: `A formulação ${activeCheeseFormula.codigo_formulacao} será excluída definitivamente. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Sim',
      cancelLabel: 'Não',
      destructive: true,
    })
    if (!confirmed) return

    cheeseSavingRef.current = true
    setState('saving')
    setMessage('Excluindo formulação')

    try {
      await producaoApi.cancelarFormulacaoQueijo(activeCheeseFormula.id)
      await loadBase(activeCheeseFormula.data_formulacao)
      setActiveCheeseFormula(null)
      setCheeseEditorOpen(false)
      setView('queijo')
      setMessage('Formulação excluída')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a formulação.')
    } finally {
      cheeseSavingRef.current = false
    }
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
    <DraftOwnerContext.Provider value={String(user?.id ?? 'anonymous')}>
    <div className="factory-shell" aria-hidden={sessionExpired || undefined}>
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
            onClick={() => {
              if (workflow.id === 'ordens') { setOrderEditorOpen(false); setActiveOrder(null) }
              if (workflow.id === 'queijo') { setCheeseEditorOpen(false); setActiveCheeseFormula(null) }
              setView(workflow.id)
            }}
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
          <button className="icon-button logout-button" type="button" onClick={() => void logout()} aria-label="Sair" title="Sair">
            <LogOut size={20} />
          </button>
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
                  <button className="compact-button" type="button" onClick={() => { setActiveOrder(null); setOrderEditorOpen(true); setView('ordens') }}><Plus size={18} />Nova OP</button>
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
                  <button key={workflow.id} type="button" onClick={() => {
                    if (workflow.id === 'ordens') { setOrderEditorOpen(false); setActiveOrder(null) }
                    if (workflow.id === 'queijo') { setCheeseEditorOpen(false); setActiveCheeseFormula(null) }
                    setView(workflow.id)
                  }}>
                    <span className="launch-icon">{workflowIcon(workflow.id, 20)}</span>
                    <strong>{workflow.label}</strong>
                    <ChevronRight size={19} />
                  </button>
                ))}
              </aside>
            </div>
          </div>
        )}

        {view === 'ordens' && (activeOrder ? (
          <OpenOrderDetail
            key={activeOrder.id}
            order={activeOrder}
            busy={state === 'saving'}
            onBack={() => setActiveOrder(null)}
            onSave={(payload) => void updateOrder(payload)}
            onFinalize={() => void finalizeOrder()}
            onDefineFormat={(format) => void defineOrderFormat(format)}
            onCancel={() => void cancelOrder()}
          />
        ) : orderEditorOpen ? (
          <OrderForm key={`${view}-${date}`} date={date} catalogs={orderCatalogs} busy={state === 'saving'} onBack={() => setOrderEditorOpen(false)} onSubmit={saveOrdem} />
        ) : (
          <OpenOrderList items={openOrders} onBack={() => setView('inicio')} onCreate={() => setOrderEditorOpen(true)} onOpen={(id) => void openOrder(id)} />
        ))}
        {view === 'queijo' && (cheeseEditorOpen ? (
          <CheeseForm
            key={`queijo-${activeCheeseFormula?.id ?? 'nova'}`}
            date={date}
            catalogs={cheeseCatalogs}
            initial={activeCheeseFormula}
            busy={state === 'saving'}
            onBack={() => { setCheeseEditorOpen(false); setActiveCheeseFormula(null) }}
            onCancel={() => void cancelCheeseFormula()}
            onSubmit={saveQueijo}
          />
        ) : (
          <CheeseFormulaList
            items={openCheeseFormulas}
            onBack={() => setView('inicio')}
            onCreate={() => { setActiveCheeseFormula(null); setCheeseEditorOpen(true) }}
            onEdit={(item) => { setActiveCheeseFormula(item); setCheeseEditorOpen(true) }}
          />
        ))}
        {view === 'soro' && <SoroForm key={`${view}-${date}`} date={date} onBack={() => setView('inicio')} onSubmit={saveSoro} />}
        {view === 'formulacao-creme' && <CreamFormulaForm key={`${view}-${date}`} date={date} onBack={() => setView('inicio')} onSubmit={saveFormulacaoCreme} />}
        {view === 'producao-creme' && <CreamProductionForm key={`${view}-${date}`} date={date} onBack={() => setView('inicio')} onSubmit={saveProducaoCreme} />}
      </main>
      {confirmation && <ConfirmationDialog request={confirmation} onAnswer={answerConfirmation} />}
    </div>
    {sessionExpired && <ReauthDialog loading={isLoggingIn} error={loginError} onSubmit={login} />}
    </DraftOwnerContext.Provider>
  )
}

function ReauthDialog({ loading, error, onSubmit }: {
  loading: boolean
  error: string | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="factory-auth reauth-backdrop" role="dialog" aria-modal="true" aria-labelledby="reauth-title">
      <form className="auth-panel" onSubmit={onSubmit}>
        <img className="auth-logo" src="https://sistema.santilac.com.br/assets/img/logo.png" alt="Santi'Lac" />
        <h1 id="reauth-title">Sessão expirada</h1>
        <p>Seu preenchimento está salvo. Entre novamente para continuar.</p>
        <label>Usuário<input name="login" autoComplete="username" required autoFocus /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <span className="form-error">{error}</span>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Continuar'}</button>
      </form>
    </main>
  )
}

function ConfirmationDialog({ request, onAnswer }: {
  request: ConfirmationRequest
  onAnswer: (answer: boolean) => void
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onAnswer(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onAnswer])

  return (
    <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onAnswer(false) }}>
      <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <h2 id="confirmation-title">{request.title}</h2>
        <p id="confirmation-message">{request.message}</p>
        <div className="confirmation-actions">
          <button className="secondary-button" type="button" onClick={() => onAnswer(false)} autoFocus>{request.cancelLabel}</button>
          <button className={request.destructive ? 'danger-button' : 'primary-button'} type="button" onClick={() => onAnswer(true)}>{request.confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

function FactoryForm({ title, code, draftKey, children, onBack, onSubmit, singleAction = false, hideActions = false, busy = false }: {
  title: string
  code: string
  draftKey: string
  children: ReactNode
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  singleAction?: boolean
  hideActions?: boolean
  busy?: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const form = formRef.current
    if (!form) return
    return bindFormDraft(form, draftKey)
  }, [draftKey])

  return (
    <form ref={formRef} className="factory-form" data-draft-key={draftKey} onSubmit={onSubmit}>
      <div className="form-heading">
        <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={20} />Voltar</button>
        <div><span className="section-kicker">{code}</span><h1>{title}</h1></div>
      </div>
      <div className="form-body">{children}</div>
      {!hideActions && <div className="form-footer">
        {!singleAction && <button className="secondary-button" type="submit" name="finalizar" value="0" disabled={busy}><Save size={19} />Salvar rascunho</button>}
        <button className="primary-button" type="submit" name="finalizar" value={singleAction ? '0' : '1'} disabled={busy}><Save size={19} />{busy ? 'Salvando…' : singleAction ? 'Salvar OP' : 'Salvar e finalizar'}</button>
      </div>}
    </form>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="form-section"><legend>{title}</legend><div className="field-grid">{children}</div></fieldset>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? 'field is-wide' : 'field'}><span>{label}</span>{children}</label>
}

function OpenOrderList({ items, onBack, onCreate, onOpen }: {
  items: OrdemProducaoResumo[]
  onBack: () => void
  onCreate: () => void
  onOpen: (id: number) => void
}) {
  return (
    <section className="formula-module">
      <div className="form-heading formula-module-heading">
        <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={20} />Voltar</button>
        <div><span className="section-kicker">OP</span><h1>Ordens abertas</h1></div>
        <button className="primary-button" type="button" onClick={onCreate}><Plus size={19} />Nova OP</button>
      </div>
      <div className="formula-list">
        {items.length === 0 ? (
          <div className="empty-state"><ClipboardList size={25} /><span>Nenhuma OP aberta</span></div>
        ) : items.map((item) => (
          <button className="formula-row open-order-row" key={item.id} type="button" onClick={() => onOpen(item.id)}>
            <span className={`order-status is-${item.status ?? 'rascunho'}`} />
            <div><strong>{item.codigo_ordem}</strong><span>{item.tipo_queijo || item.lote_queijo || 'Ordem manual'}</span></div>
            <time>{item.data ? formatDateInput(item.data) : 'Sem data'}</time>
            <em>{item.status?.replace('_', ' ') ?? 'rascunho'}</em>
          </button>
        ))}
      </div>
    </section>
  )
}

function OpenOrderDetail({ order, busy, onBack, onSave, onFinalize, onDefineFormat, onCancel }: {
  order: OrdemProducaoDetalhe
  busy: boolean
  onBack: () => void
  onSave: (payload: OrdemProducaoPayload) => void
  onFinalize: () => void
  onDefineFormat: (format: 'f1' | 'f4' | 'f6') => void
  onCancel: () => void
}) {
  const editable = order.status === 'rascunho'
  const [editDate, setEditDate] = useState(order.data ?? '')
  const [editFields, setEditFields] = useState(order.campos)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [mozzarellaFormat, setMozzarellaFormat] = useState<'f1' | 'f4' | 'f6'>('f4')

  useEffect(() => {
    setEditDate(order.data ?? '')
    setEditFields(order.campos)
    setHasUnsavedChanges(false)
  }, [order])

  function updateField(index: number, value: string) {
    setHasUnsavedChanges(true)
    setEditFields((current) => current.map((field, fieldIndex) => (
      fieldIndex === index ? { ...field, valor: value } : field
    )))
  }

  function updateOrderDate(value: string) {
    setEditDate(value)
    setHasUnsavedChanges(true)
    setEditFields((current) => current.map((field) => (
      field.rotulo === 'PRODUÇÃO DIARIA / DATA' ? { ...field, valor: formatDateInput(value) } : field
    )))
  }

  return (
    <section className="formula-module order-detail">
      <div className="form-heading formula-module-heading">
        <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={20} />Voltar</button>
        <div><span className="section-kicker">OP</span><h1>{order.codigo_ordem}</h1></div>
      </div>
      <div className="order-detail-card">
        <div className="order-detail-summary">
          <div>
            <span>Data</span>
            {editable ? <DateInput value={editDate} required onChange={updateOrderDate} /> : <strong>{order.data ? formatDateInput(order.data) : 'Sem data'}</strong>}
          </div>
          <div><span>Origem</span><strong>{order.manual ? 'Manual' : 'Formulação'}</strong></div>
          <div><span>Status</span><strong>{order.status.replace('_', ' ')}</strong></div>
        </div>
        <div className="order-detail-fields">
          {editFields.map((campo, index) => (
            <div key={`${campo.rotulo}-${index}`}>
              <span>{campo.rotulo}</span>
              {editable ? (
                <input aria-label={campo.rotulo} value={campo.valor ?? ''} onChange={(event) => updateField(index, event.target.value)} />
              ) : (
                <strong>{campo.valor || '—'}</strong>
              )}
            </div>
          ))}
        </div>
      </div>
      {order.status === 'aguardando_formato' && (
        <div className="order-format-control">
          <label>
            <span>Formato da mussarela</span>
            <KioskSelect
              ariaLabel="Formato da mussarela"
              value={mozzarellaFormat}
              options={formatOptions}
              onChange={(value) => setMozzarellaFormat(value as 'f1' | 'f4' | 'f6')}
            />
          </label>
          <p>Escolha o formato somente quando a OP diária estiver completa.</p>
        </div>
      )}
      {(order.status === 'rascunho' || order.status === 'aguardando_formato') && (
        <div className="form-footer">
          <button className="danger-button" type="button" disabled={busy} onClick={onCancel}>
            <Trash2 size={19} />Cancelar OP
          </button>
          {order.status === 'rascunho' && (
            <>
              <button
                className="secondary-button"
                type="button"
                disabled={busy || editDate === '' || !hasUnsavedChanges}
                onClick={() => onSave({ data: editDate, codigo_ordem: order.codigo_ordem, campos: editFields })}
              >
                <Save size={19} />{busy ? 'Salvando…' : 'Salvar alterações'}
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={busy || hasUnsavedChanges}
                title={hasUnsavedChanges ? 'Salve as alterações antes de finalizar' : undefined}
                onClick={onFinalize}
              >
                <CheckCircle2 size={19} />{busy ? 'Processando…' : 'Finalizar OP'}
              </button>
            </>
          )}
          {order.status === 'aguardando_formato' && (
            <button className="primary-button" type="button" disabled={busy} onClick={() => onDefineFormat(mozzarellaFormat)}>
              <CheckCircle2 size={19} />{busy ? 'Processando…' : 'Finalizar OP'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function OrderForm({ date, catalogs, busy, onBack, onSubmit }: {
  date: string
  catalogs: OrdemProducaoCatalogos
  busy: boolean
  onBack: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const draftKey = useDraftKey(`ordem-producao:nova:${date}`)
  const draft = readFormDraft(draftKey)
  const rowCount = Math.max(1, draftFieldCount(draft, 'insumo_quantidade'))
  const [cheeseId, setCheeseId] = useState(draftFieldValue(draft, 'produto_catalogo_id') ?? String(catalogs.queijos[0]?.id ?? ''))
  const [format, setFormat] = useState(draftFieldValue(draft, 'produto_formato') ?? 'f4')
  const [rows, setRows] = useState(Array.from({ length: rowCount }, (_, index) => index + 1))
  const [selectedInputs, setSelectedInputs] = useState<Record<number, string>>(() => Object.fromEntries(
    Array.from({ length: rowCount }, (_, index) => [index + 1, draftFieldValue(draft, 'insumo_catalogo_id', index) ?? '']),
  ))
  const cheese = catalogs.queijos.find((item) => String(item.id) === cheeseId) ?? null
  const productLabel = cheese?.precisa_formato ? `PEÇAS ${format.toUpperCase()}` : cheese?.op_rotulo ?? ''

  useEffect(() => {
    if (!cheeseId && catalogs.queijos[0]) setCheeseId(String(catalogs.queijos[0].id))
  }, [catalogs.queijos, cheeseId])

  return (
    <FactoryForm title="Ordem de produção" code="OP" draftKey={draftKey} onBack={onBack} onSubmit={onSubmit} singleAction busy={busy}>
      <FormSection title="Identificação">
        <Field label="Data"><DateInput name="data" defaultValue={date} required /></Field>
        <Field label="Produto"><KioskSelect name="produto_catalogo_id" ariaLabel="Produto" value={cheeseId} onChange={setCheeseId} required options={catalogs.queijos.map((item) => ({ value: String(item.id), label: item.nome }))} /></Field>
        <Field label="Lote"><input name="lote_codigo" required /></Field>
        {cheese?.precisa_formato && <Field label="Formato"><KioskSelect name="produto_formato" ariaLabel="Formato" value={format} onChange={setFormat} options={formatOptions} /></Field>}
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
                <KioskSelect name="insumo_catalogo_id" ariaLabel={`Insumo ${index + 1}`} placeholder="Selecionar insumo" value={selectedInputs[rowId] ?? ''} onChange={(value) => setSelectedInputs((current) => ({ ...current, [rowId]: value }))} options={catalogs.insumos.map((item) => ({ value: String(item.id), label: item.nome }))} />
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

function CheeseFormulaList({ items, onBack, onCreate, onEdit }: {
  items: FormulacaoQueijo[]
  onBack: () => void
  onCreate: () => void
  onEdit: (item: FormulacaoQueijo) => void
}) {
  return (
    <section className="formula-module">
      <div className="form-heading formula-module-heading">
        <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={20} />Voltar</button>
        <div><span className="section-kicker">PLAN 6.3</span><h1>Formulações abertas</h1></div>
        <button className="primary-button" type="button" onClick={onCreate}><Plus size={19} />Nova formulação</button>
      </div>
      <div className="formula-list">
        {items.length === 0 ? (
          <div className="empty-state"><FlaskConical size={25} /><span>Nenhuma formulação aberta</span></div>
        ) : items.map((item) => (
          <button className="formula-row" type="button" key={item.id} onClick={() => onEdit(item)}>
            <span className="order-status is-rascunho" />
            <div><strong>{item.tipo_queijo || 'Formulação sem tipo'}</strong><span>{item.codigo_formulacao} · Lote {item.lote_queijo || 'não informado'}</span></div>
            <time>{formatDateInput(item.data_formulacao)}</time>
            <em className="formula-edit">Editar <ChevronRight size={20} /></em>
          </button>
        ))}
      </div>
    </section>
  )
}

function CheeseForm({ date, catalogs, initial, busy, onBack, onCancel, onSubmit }: {
  date: string
  catalogs: FormulacaoQueijoCatalogos
  initial: FormulacaoQueijo | null
  busy: boolean
  onBack: () => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const draftKey = useDraftKey(`formulacao-queijo:${initial?.id ?? `nova:${date}`}`)
  const draft = readFormDraft(draftKey)
  const rowCount = Math.max(
    1,
    initial?.insumos.length ?? 0,
    draftFieldCount(draft, 'insumo_quantidade'),
    draftFieldCount(draft, 'insumo_catalogo_id'),
  )
  const [rows, setRows] = useState(Array.from({ length: rowCount }, (_, index) => index + 1))
  const [selectedInputs, setSelectedInputs] = useState<Record<number, string>>(() => Object.fromEntries(
    rows.map((rowId, index) => {
      const restored = draftFieldValue(draft, 'insumo_catalogo_id', index)
      if (restored !== undefined) return [rowId, restored]
      const insumo = initial?.insumos[index]
      if (!insumo) return [rowId, '']
      const match = catalogs.insumos.find((item) => item.nome === insumo.nome_insumo || item.tipo_insumo === insumo.tipo_insumo)
      return [rowId, match ? String(match.id) : '']
    }),
  ))

  return (
    <FactoryForm title="Formulação de queijo" code="PLAN 6.3" draftKey={draftKey} onBack={onBack} onSubmit={onSubmit} hideActions>
      <FormSection title="Lote">
        <Field label="Data"><DateInput name="data_formulacao" defaultValue={initial?.data_formulacao ?? date} required /></Field>
        <Field label="Tipo de queijo"><KioskSelect name="tipo_queijo" ariaLabel="Tipo de queijo" defaultValue={initial?.tipo_queijo ?? ''} required options={catalogs.queijos.map((item) => ({ value: item.nome, label: item.nome }))} /></Field>
        <Field label="Lote do queijo"><input name="lote_queijo" defaultValue={initial?.lote_queijo ?? ''} required /></Field>
        <Field label="Lote do leite"><input name="lote_leite" defaultValue={initial?.lote_leite ?? ''} /></Field>
        <Field label="Silo"><input name="silo" defaultValue={initial?.silo ?? ''} /></Field>
        <Field label="Queijomatic"><input name="numero_queijomatic" defaultValue={initial?.numero_queijomatic ?? ''} /></Field>
      </FormSection>
      <FormSection title="Processo">
        <Field label="Início do enchimento"><TimeWheelInput name="inicio_enchimento" label="Início do enchimento" defaultValue={initial?.inicio_enchimento ?? ''} /></Field>
        <Field label="Leite (L)"><input name="quantidade_leite" inputMode="decimal" defaultValue={initial?.quantidade_leite ?? ''} /></Field>
        <Field label="Pasteurização (°C)"><input name="temperatura_pasteurizacao" inputMode="decimal" defaultValue={initial?.temperatura_pasteurizacao ?? ''} /></Field>
        <Field label="Fosfatase"><KioskSelect name="fosfatase" ariaLabel="Fosfatase" defaultValue={initial?.fosfatase ?? ''} options={analysisOptions} /></Field>
        <Field label="Peroxidase"><KioskSelect name="peroxidase" ariaLabel="Peroxidase" defaultValue={initial?.peroxidase ?? ''} options={analysisOptions} /></Field>
        <Field label="Gordura inicial"><input name="gordura_inicial" inputMode="decimal" defaultValue={initial?.gordura_inicial ?? ''} /></Field>
        <Field label="Gordura final"><input name="gordura_final" inputMode="decimal" defaultValue={initial?.gordura_final ?? ''} /></Field>
        <Field label="Acidez"><input name="acidez" inputMode="decimal" defaultValue={initial?.acidez ?? ''} /></Field>
        <Field label="Coagulação (°C)"><input name="temperatura_coagulacao" inputMode="decimal" defaultValue={initial?.temperatura_coagulacao ?? ''} /></Field>
        <Field label="Hora da coagulação"><TimeWheelInput name="hora_coagulacao" label="Hora da coagulação" defaultValue={initial?.hora_coagulacao ?? ''} /></Field>
        <Field label="Hora do corte"><TimeWheelInput name="hora_corte" label="Hora do corte" defaultValue={initial?.hora_corte ?? ''} /></Field>
        <Field label="Cozimento (°C)"><input name="temperatura_cozimento" inputMode="decimal" defaultValue={initial?.temperatura_cozimento ?? ''} /></Field>
      </FormSection>
      <FormSection title="Insumos">
        <div className="repeat-list is-wide">
          {rows.map((rowId, index) => {
            const selected = catalogs.insumos.find((item) => String(item.id) === selectedInputs[rowId]) ?? null
            return (
              <div className="repeat-row repeat-row-cheese" key={rowId}>
                <span>{index + 1}</span>
                <KioskSelect name="insumo_catalogo_id" ariaLabel={`Insumo ${index + 1}`} placeholder="Selecionar insumo" value={selectedInputs[rowId] ?? ''} onChange={(value) => setSelectedInputs((current) => ({ ...current, [rowId]: value }))} options={catalogs.insumos.map((item) => ({ value: String(item.id), label: item.nome }))} />
                <input name="insumo_quantidade" inputMode="decimal" placeholder="Quantidade" defaultValue={initial?.insumos[index]?.quantidade ?? ''} />
                <input name="insumo_lote" placeholder="Lote" defaultValue={initial?.insumos[index]?.lote_insumo ?? ''} />
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
      <div className="form-footer">
        {initial && <button className="danger-button" type="button" disabled={busy} onClick={onCancel}><Trash2 size={19} />Cancelar formulação</button>}
        <button className="secondary-button" type="submit" name="acao" value="salvar" disabled={busy}><Save size={19} />{busy ? 'Salvando…' : 'Salvar'}</button>
        {initial && <button className="primary-button" type="submit" name="acao" value="finalizar" disabled={busy}><CheckCircle2 size={19} />{busy ? 'Processando…' : 'Finalizar'}</button>}
      </div>
    </FactoryForm>
  )
}

function SoroForm({ date, onBack, onSubmit }: { date: string; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const draftKey = useDraftKey(`soro-refrigerado:nova:${date}`)
  return (
    <FactoryForm title="Soro refrigerado" code="PLAN 6.7" draftKey={draftKey} onBack={onBack} onSubmit={onSubmit}>
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
const creamTypeOptions = creamTypes.map((type) => ({ value: type, label: type }))

function CreamFormulaForm({ date, onBack, onSubmit }: { date: string; onBack: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const draftKey = useDraftKey(`formulacao-creme:nova:${date}`)
  return (
    <FactoryForm title="Formulação de creme" code="PLAN 6.9" draftKey={draftKey} onBack={onBack} onSubmit={onSubmit}>
      <FormSection title="Lote">
        <Field label="Data"><DateInput name="data_fabricacao" defaultValue={date} required /></Field>
        <Field label="Lote do creme"><input name="lote_creme_produzido" required /></Field>
        <Field label="Tipo de creme"><KioskSelect name="tipo_creme" ariaLabel="Tipo de creme" required options={creamTypeOptions} /></Field>
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
  const draftKey = useDraftKey(`producao-creme:nova:${date}`)
  return (
    <FactoryForm title="Produção de creme" code="PLAN 6.10" draftKey={draftKey} onBack={onBack} onSubmit={onSubmit}>
      <FormSection title="Produção">
        <Field label="Data"><DateInput name="data_fabricacao" defaultValue={date} required /></Field>
        <Field label="Lote do creme"><input name="lote_creme_produzido" required /></Field>
        <Field label="Tipo de creme"><KioskSelect name="tipo_creme" ariaLabel="Tipo de creme" required options={creamTypeOptions} /></Field>
        <Field label="Quantidade (kg)"><input name="quantidade_produzida_kg" inputMode="decimal" /></Field>
        <Field label="Mês"><input name="mes" type="number" min="1" max="12" defaultValue={new Date(`${date}T12:00:00`).getMonth() + 1} /></Field>
        <Field label="Ano"><input name="ano" type="number" min="2020" max="2100" defaultValue={date.slice(0, 4)} /></Field>
        <Field label="Monitoramento"><input name="responsavel_monitoramento" /></Field>
        <Field label="Responsável"><input name="responsavel" /></Field>
      </FormSection>
    </FactoryForm>
  )
}
