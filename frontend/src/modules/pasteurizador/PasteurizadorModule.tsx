import { RefreshCcw } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { pasteurizadorApi, type Amostra, type Coleta, type Overview } from './api/pasteurizadorApi'
import { Inicio } from './views/Inicio/Inicio'
import './pasteurizador.css'

type View = 'inicio' | 'historico'
type LoadStatus = 'loading' | 'live' | 'error'

const HistoricoPasteurizacao = lazy(() => import('./views/HistoricoPasteurizacao/HistoricoPasteurizacao').then((module) => ({ default: module.HistoricoPasteurizacao })))

type HistoricoFiltro = {
  inicio: string
  fim: string
  horaInicio: string
  horaFim: string
  canal: string
}

type RouteState = {
  view: View
  filtro: HistoricoFiltro
}

const defaultHistoricoFiltro: HistoricoFiltro = {
  inicio: '',
  fim: '',
  horaInicio: '00:00:00',
  horaFim: '23:59:59',
  canal: 'Todos',
}

function parseRoute(): RouteState {
  const rawHash = window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = rawHash.split('?')
  const parts = path.split('/').filter(Boolean)

  if (parts[0] !== 'pasteurizador') {
    return { view: 'inicio', filtro: defaultHistoricoFiltro }
  }

  const params = new URLSearchParams(query)

  return {
    view: parts[1] === 'historico' ? 'historico' : 'inicio',
    filtro: {
      inicio: params.get('inicio') ?? '',
      fim: params.get('fim') ?? '',
      horaInicio: params.get('hora_inicio') ?? defaultHistoricoFiltro.horaInicio,
      horaFim: params.get('hora_fim') ?? defaultHistoricoFiltro.horaFim,
      canal: params.get('canal') ?? defaultHistoricoFiltro.canal,
    },
  }
}

function pushRoute(view: View): void {
  const nextHash = view === 'historico' ? '#/pasteurizador/historico' : '#/pasteurizador/inicio'

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

export function PasteurizadorModule() {
  const initialRoute = parseRoute()
  const [view, setView] = useState<View>(initialRoute.view)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando pasteurizador...')
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [coletas, setColetas] = useState<Coleta[]>([])
  const [amostras, setAmostras] = useState<Amostra[]>([])
  const [selectedColetaId, setSelectedColetaId] = useState<number | null>(null)
  const [inicio, setInicio] = useState(initialRoute.filtro.inicio)
  const [fim, setFim] = useState(initialRoute.filtro.fim)
  const [horaInicio, setHoraInicio] = useState(initialRoute.filtro.horaInicio)
  const [horaFim, setHoraFim] = useState(initialRoute.filtro.horaFim)
  const [canal, setCanal] = useState(initialRoute.filtro.canal)
  const [routeKey, setRouteKey] = useState(() => window.location.hash || '#/pasteurizador/inicio')
  const loadingStartedAt = useRef<number | null>(null)
  const loadingHideTimer = useRef<number | null>(null)

  const coletaSelecionada = useMemo(
    () => coletas.find((coleta) => coleta.id === selectedColetaId) ?? null,
    [coletas, selectedColetaId],
  )

  const canaisDisponiveis = useMemo(
    () => Array.from(new Set(['Todos', 'Temp.Pasteuriza', ...(overview?.canais.map((item) => item.canal) ?? []), ...amostras.map((item) => item.canal)])),
    [overview, amostras],
  )

  function filtroAtual(): HistoricoFiltro {
    return { inicio, fim, horaInicio, horaFim, canal }
  }

  function aplicarFiltro(filtro: HistoricoFiltro) {
    setInicio(filtro.inicio)
    setFim(filtro.fim)
    setHoraInicio(filtro.horaInicio)
    setHoraFim(filtro.horaFim)
    setCanal(filtro.canal)
  }

  async function loadOverview() {
    setStatus('loading')
    setStatusText('Carregando dados...')

    try {
      setOverview(await pasteurizadorApi.overview())
      setStatus('live')
      setStatusText('Dados carregados.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o módulo.')
    }
  }

  async function loadAmostrasPeriodo(filtro = filtroAtual()) {
    setStatus('loading')
    setStatusText('Carregando amostras por período...')

    try {
      const result = await pasteurizadorApi.amostrasPeriodo(
        filtro.inicio,
        filtro.fim,
        filtro.horaInicio,
        filtro.horaFim,
        filtro.canal,
      )
      setAmostras(result)
      setStatus('live')
      setStatusText(`${result.length.toLocaleString('pt-BR')} ponto(s) carregado(s) para o gráfico.`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o gráfico por período.')
    }
  }

  async function consultarAmostrasPeriodo(filtro = filtroAtual()) {
    const result = await pasteurizadorApi.amostrasPeriodo(
      filtro.inicio,
      filtro.fim,
      filtro.horaInicio,
      filtro.horaFim,
      filtro.canal,
    )
    setAmostras(result)
    return result
  }

  async function loadColetasSalvas(filtro = filtroAtual()) {
    const result = await pasteurizadorApi.coletas(
      filtro.inicio,
      filtro.fim,
      filtro.horaInicio,
      filtro.horaFim,
      1,
      50,
    )
    setColetas(result.items)
    setSelectedColetaId((current) => current && result.items.some((item) => item.id === current) ? current : null)
    return result
  }

  async function loadColetas(filtro = filtroAtual()) {
    setStatus('loading')
    setStatusText('Carregando coletas salvas...')

    try {
      await loadColetasSalvas(filtro)
      await loadAmostrasPeriodo(filtro)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as coletas.')
    }
  }

  async function loadAmostras(coletaId: number, nextCanal = canal) {
    setStatus('loading')
    setStatusText('Carregando amostras da coleta...')

    try {
      setAmostras(await pasteurizadorApi.amostras(coletaId, nextCanal))
      setStatus('live')
      setStatusText('Amostras da coleta carregadas para o gráfico.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as amostras.')
    }
  }

  async function handleFiltrar() {
    const filtro = filtroAtual()
    setSelectedColetaId(null)
    setStatus('loading')
    setStatusText('Consultando período...')

    try {
      await loadColetasSalvas(filtro)
      let result = await consultarAmostrasPeriodo(filtro)

      if (result.length === 0 && filtro.inicio && filtro.fim) {
        setStatusText('Sem dados salvos. Coletando direto do equipamento...')
        await pasteurizadorApi.coletarAgora(filtro.inicio, filtro.fim, filtro.horaInicio, filtro.horaFim)
        await loadColetasSalvas(filtro)
        result = await consultarAmostrasPeriodo(filtro)
      }
      setStatus('live')
      setStatusText(result.length
        ? `${result.length.toLocaleString('pt-BR')} ponto(s) carregado(s) para o gráfico.`
        : 'Nenhuma informação encontrada para esse período.')
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível filtrar o período.')
    }
  }

  function reloadCurrentView() {
    if (view === 'inicio') void loadOverview()
    if (view === 'historico') void loadColetas()
  }

  function navigate(nextView: View) {
    pushRoute(nextView)
    setView(nextView)
    if (nextView === 'historico' && view !== 'historico') {
      aplicarFiltro(defaultHistoricoFiltro)
    }
  }

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = parseRoute()
      setView(nextRoute.view)
      aplicarFiltro(nextRoute.filtro)
      setRouteKey(window.location.hash || '#/pasteurizador/inicio')
    }

    if (!window.location.hash.startsWith('#/pasteurizador')) {
      window.history.replaceState(null, '', '#/pasteurizador/inicio')
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (view === 'inicio') void loadOverview()
    else void loadColetas()
  }, [view, routeKey])

  useEffect(() => {
    if (view === 'historico') void loadAmostrasPeriodo()
  }, [canal])

  useEffect(() => {
    if (loadingHideTimer.current !== null) {
      window.clearTimeout(loadingHideTimer.current)
      loadingHideTimer.current = null
    }

    if (status === 'loading') {
      loadingStartedAt.current = Date.now()
      setLoadingOverlayVisible(true)
      return
    }

    if (loadingStartedAt.current === null) {
      setLoadingOverlayVisible(false)
      return
    }

    const elapsed = Date.now() - loadingStartedAt.current
    const remaining = Math.max(0, 700 - elapsed)

    loadingHideTimer.current = window.setTimeout(() => {
      setLoadingOverlayVisible(false)
      loadingStartedAt.current = null
      loadingHideTimer.current = null
    }, remaining)

    return () => {
      if (loadingHideTimer.current !== null) {
        window.clearTimeout(loadingHideTimer.current)
        loadingHideTimer.current = null
      }
    }
  }, [status])

  const pageTitle = view === 'inicio' ? 'Pasteurizador' : 'Histórico do pasteurizador'
  const pageCopy = view === 'inicio'
    ? 'Monitoramento das coletas automáticas feitas pelo processador do FieldLogger.'
    : 'Consulta por período, gráfico interativo e exportação CSV.'
  const exportPdfUrl = pasteurizadorApi.exportPdfPeriodoUrl(inicio, fim, horaInicio, horaFim, canal)

  return (
    <>
      {loadingOverlayVisible ? <LoadingOverlay message={statusText} /> : null}

      <section className="page pasteurizador-module">
          <header className="page-head">
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageCopy}</p>
            </div>
            <div className="actions">
              <button className="btn secondary" type="button" onClick={reloadCurrentView}>
                <RefreshCcw size={16} />
                Atualizar
              </button>
            </div>
          </header>

          <section className={`status-line is-${status}`}>
            <span className="status-dot" />
            <span>{statusText}</span>
          </section>

          {view === 'inicio' ? (
            <Inicio overview={overview} onNavigateHistorico={() => navigate('historico')} />
          ) : (
            <Suspense fallback={<LoadingOverlay message="Carregando gráfico..." />}>
              <HistoricoPasteurizacao
                coletas={coletas}
                amostras={amostras}
                coletaSelecionada={coletaSelecionada}
                inicio={inicio}
                fim={fim}
                horaInicio={horaInicio}
                horaFim={horaFim}
                canal={canal}
                canaisDisponiveis={canaisDisponiveis}
                onInicioChange={setInicio}
                onFimChange={setFim}
                onHoraInicioChange={setHoraInicio}
                onHoraFimChange={setHoraFim}
                onCanalChange={setCanal}
                onFiltrar={handleFiltrar}
                onSelecionarColeta={(id) => {
                  setSelectedColetaId(id)
                  void loadAmostras(id)
                }}
                onRecarregar={() => void loadColetas()}
                exportPdfUrl={exportPdfUrl}
              />
            </Suspense>
          )}
        </section>
    </>
  )
}

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="pasteurizador-loading-overlay" role="status" aria-live="polite" aria-label={message}>
      <div className="pasteurizador-loading-card">
        <span className="pasteurizador-loading-spinner" />
        <strong>Carregando</strong>
        <span>{message}</span>
      </div>
    </div>
  )
}
