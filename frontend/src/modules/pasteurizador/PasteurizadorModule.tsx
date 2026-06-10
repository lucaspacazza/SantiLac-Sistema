import { RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { pasteurizadorApi, type Amostra, type Coleta, type Overview } from './api/pasteurizadorApi'
import { HistoricoPasteurizacao } from './views/HistoricoPasteurizacao/HistoricoPasteurizacao'
import { Inicio } from './views/Inicio/Inicio'

type View = 'inicio' | 'historico'
type LoadStatus = 'loading' | 'live' | 'error'

function parseRoute(): View {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)

  if (parts[0] !== 'pasteurizador') {
    return 'inicio'
  }

  return parts[1] === 'historico' ? 'historico' : 'inicio'
}

function pushRoute(view: View): void {
  const nextHash = view === 'historico' ? '#/pasteurizador/historico' : '#/pasteurizador/inicio'

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

export function PasteurizadorModule() {
  const [view, setView] = useState<View>(() => parseRoute())
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando pasteurizador...')
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(false)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [coletas, setColetas] = useState<Coleta[]>([])
  const [amostras, setAmostras] = useState<Amostra[]>([])
  const [selectedColetaId, setSelectedColetaId] = useState<number | null>(null)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [horaInicio, setHoraInicio] = useState('00:00:00')
  const [horaFim, setHoraFim] = useState('23:59:59')
  const [canal, setCanal] = useState('Todos')
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

  async function loadAmostrasPeriodo() {
    setStatus('loading')
    setStatusText('Carregando amostras por período...')

    try {
      const result = await pasteurizadorApi.amostrasPeriodo(inicio, fim, horaInicio, horaFim, canal)
      setAmostras(result)
      setStatus('live')
      setStatusText(`${result.length.toLocaleString('pt-BR')} ponto(s) carregado(s) para o gráfico.`)
    } catch (error) {
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar o gráfico por período.')
    }
  }

  async function consultarAmostrasPeriodo() {
    const result = await pasteurizadorApi.amostrasPeriodo(inicio, fim, horaInicio, horaFim, canal)
    setAmostras(result)
    return result
  }

  async function loadColetasSalvas() {
    const result = await pasteurizadorApi.coletas(inicio, fim, horaInicio, horaFim, 1, 50)
    setColetas(result.items)
    setSelectedColetaId((current) => current && result.items.some((item) => item.id === current) ? current : null)
    return result
  }

  async function loadColetas() {
    setStatus('loading')
    setStatusText('Carregando coletas salvas...')

    try {
      await loadColetasSalvas()
      await loadAmostrasPeriodo()
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
    setSelectedColetaId(null)
    setStatus('loading')
    setStatusText('Consultando período...')

    try {
      await loadColetasSalvas()
      let result = await consultarAmostrasPeriodo()

      if (result.length === 0 && inicio && fim) {
        setStatusText('Sem dados salvos. Coletando direto do equipamento...')
        await pasteurizadorApi.coletarAgora(inicio, fim, horaInicio, horaFim)
        await loadColetasSalvas()
        result = await consultarAmostrasPeriodo()
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
  }

  useEffect(() => {
    const handleHashChange = () => setView(parseRoute())

    if (!window.location.hash.startsWith('#/pasteurizador')) {
      window.history.replaceState(null, '', '#/pasteurizador/inicio')
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (view === 'inicio') void loadOverview()
    else void loadColetas()
  }, [view])

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
              onRecarregar={loadColetas}
              exportPdfUrl={exportPdfUrl}
            />
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