import { RefreshCcw } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  pasteurizadorApi,
  type Amostra,
  type CoberturaSerie,
  type Coleta,
  type Overview,
  type SerieAmostras,
  type SerieAmostrasMeta,
} from './api/pasteurizadorApi'
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

type LacunasCobertura = {
  ultimaDataCoberta: string | null
  ultimaDataObservada: string | null
  primeiraDataFaltante: string
  ultimaDataEsperada: string
  totalDiasFaltantes: number
}

type SerieVerificada = {
  result: SerieAmostras
  cobertura: CoberturaSerie | null
}

const defaultHistoricoFiltro: HistoricoFiltro = {
  inicio: '',
  fim: '',
  horaInicio: '00:00:00',
  horaFim: '23:59:59',
  canal: 'Todos',
}

function hojeNoFusoDoEquipamento(): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return new Date(Date.UTC(value('year'), value('month') - 1, value('day')))
}

function ultimoDiaProducaoSolicitado(fim: string): string | null {
  const match = fim.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const data = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  const hoje = hojeNoFusoDoEquipamento()
  if (data >= hoje) {
    data.setTime(hoje.getTime())
    data.setUTCDate(data.getUTCDate() - 1)
  }
  if (data.getUTCDay() === 0) {
    data.setUTCDate(data.getUTCDate() - 1)
  }

  return data.toISOString().slice(0, 10)
}

function diasProducaoEsperados(inicio: string, fim: string): string[] {
  const primeiraData = inicio.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const ultimaData = ultimoDiaProducaoSolicitado(fim)
  if (!primeiraData || !ultimaData) return []

  const cursor = new Date(Date.UTC(
    Number(primeiraData[1]),
    Number(primeiraData[2]) - 1,
    Number(primeiraData[3]),
  ))
  const limite = new Date(`${ultimaData}T00:00:00Z`)
  if (cursor > limite) return []

  const datas: string[] = []
  while (cursor <= limite) {
    if (cursor.getUTCDay() !== 0) {
      datas.push(cursor.toISOString().slice(0, 10))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return datas
}

function lacunasNaCobertura(
  result: SerieAmostras,
  cobertura: CoberturaSerie | null,
  filtro: HistoricoFiltro,
): LacunasCobertura | null {
  if (!cobertura) return null
  const datasEsperadas = diasProducaoEsperados(filtro.inicio, filtro.fim)
  if (datasEsperadas.length === 0) return null

  // last_timestamp/observed_dates are diagnostic only. A sample at 00:00 (or
  // 23:59) cannot certify that the whole day was collected successfully.
  const datasCobertas = new Set(cobertura.covered_dates)
  const datasFaltantes = datasEsperadas.filter((data) => !datasCobertas.has(data))
  if (datasFaltantes.length === 0) return null

  return {
    ultimaDataCoberta: cobertura.coverage_end,
    ultimaDataObservada:
      cobertura.observed_end ?? result.meta.last_timestamp?.slice(0, 10) ?? null,
    primeiraDataFaltante: datasFaltantes[0],
    ultimaDataEsperada: datasEsperadas[datasEsperadas.length - 1],
    totalDiasFaltantes: datasFaltantes.length,
  }
}

function coberturaMaisRecenteQueSerie(
  result: SerieAmostras,
  cobertura: CoberturaSerie,
): boolean {
  const ultimaAmostraCobertura = cobertura.observed_last_timestamp
  if (!ultimaAmostraCobertura) return false

  return !result.meta.last_timestamp
    || ultimaAmostraCobertura > result.meta.last_timestamp
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
  const [seriesMeta, setSeriesMeta] = useState<SerieAmostrasMeta | null>(null)
  const [seriesStale, setSeriesStale] = useState(false)
  const [seriesCoverageWarning, setSeriesCoverageWarning] = useState<string | null>(null)
  const [selectedColetaId, setSelectedColetaId] = useState<number | null>(null)
  const [inicio, setInicio] = useState(initialRoute.filtro.inicio)
  const [fim, setFim] = useState(initialRoute.filtro.fim)
  const [horaInicio, setHoraInicio] = useState(initialRoute.filtro.horaInicio)
  const [horaFim, setHoraFim] = useState(initialRoute.filtro.horaFim)
  const [canal, setCanal] = useState(initialRoute.filtro.canal)
  const [routeKey, setRouteKey] = useState(() => window.location.hash || '#/pasteurizador/inicio')
  const loadingStartedAt = useRef<number | null>(null)
  const loadingHideTimer = useRef<number | null>(null)
  const amostrasRequest = useRef<{ id: number; controller: AbortController } | null>(null)
  const coberturaRequest = useRef<AbortController | null>(null)
  const amostrasRequestSequence = useRef(0)
  const historicoOperationSequence = useRef(0)

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

  function iniciarRequisicaoAmostras() {
    amostrasRequest.current?.controller.abort()
    coberturaRequest.current?.abort()

    const request = {
      id: ++amostrasRequestSequence.current,
      controller: new AbortController(),
    }
    amostrasRequest.current = request
    return request
  }

  function requisicaoAmostrasAtual(id: number): boolean {
    return amostrasRequest.current?.id === id
  }

  function operacaoHistoricoAtual(id: number): boolean {
    return historicoOperationSequence.current === id
  }

  function aplicarSerie(result: SerieAmostras, requestId: number): boolean {
    if (!requisicaoAmostrasAtual(requestId)) return false

    setAmostras(result.items)
    setSeriesMeta(result.meta)
    setSeriesStale(false)
    setSeriesCoverageWarning(null)
    return true
  }

  function textoSerieCarregada(result: SerieAmostras): string {
    if (result.meta.reduced) {
      return `${result.meta.returned.toLocaleString('pt-BR')} pontos representando ${result.meta.source_total.toLocaleString('pt-BR')} registros do período completo.`
    }

    return `${result.meta.returned.toLocaleString('pt-BR')} ponto(s) carregado(s) para o gráfico.`
  }

  function finalizarSerieCarregada(
    result: SerieAmostras,
    cobertura: CoberturaSerie | null,
    filtro: HistoricoFiltro,
  ): void {
    const lacuna = lacunasNaCobertura(result, cobertura, filtro)
    if (lacuna && filtro.inicio && filtro.fim) {
      const evidenciaParcial = lacuna.ultimaDataObservada
        ? ` Há amostras até ${lacuna.ultimaDataObservada}, mas elas não certificam um dia completo.`
        : ''
      const aviso = `Período incompleto: ${lacuna.totalDiasFaltantes} dia(s) sem processamento integral confirmado; primeira lacuna em ${lacuna.primeiraDataFaltante}, com cobertura esperada até ${lacuna.ultimaDataEsperada}.${evidenciaParcial}`
      setSeriesCoverageWarning(aviso)
      setStatus('error')
      setStatusText(`${aviso} A recuperação automática terminou sem preencher todas as lacunas.`)
      return
    }

    setSeriesCoverageWarning(null)
    setStatus('live')
    setStatusText(result.meta.source_total
      ? textoSerieCarregada(result)
      : 'Nenhuma informação encontrada para esse período.')
  }

  async function recuperarSerieSeIncompleta(
    result: SerieAmostras,
    filtro: HistoricoFiltro,
    operationId: number,
  ): Promise<SerieVerificada | null> {
    if (!filtro.inicio || !filtro.fim) {
      return { result, cobertura: null }
    }

    let resultAtual = result
    let cobertura = await consultarCoberturaSerie(filtro, operationId)
    if (!cobertura) return null

    // A coleta pode terminar entre o GET da série e o GET de cobertura. Refaça
    // a série uma única vez quando o ledger já enxerga uma amostra mais nova.
    if (coberturaMaisRecenteQueSerie(resultAtual, cobertura)) {
      const resultSincronizado = await consultarAmostrasPeriodo(filtro, operationId)
      if (!resultSincronizado) return null
      resultAtual = resultSincronizado
    }

    const lacuna = lacunasNaCobertura(resultAtual, cobertura, filtro)
    if (!lacuna) return { result: resultAtual, cobertura }

    const ultimaDataCoberta = lacuna.ultimaDataCoberta ?? 'nenhuma data'
    const evidenciaParcial = lacuna.ultimaDataObservada
      ? ` (há amostras parciais até ${lacuna.ultimaDataObservada})`
      : ''
    setSeriesCoverageWarning(
      `Cobertura parcial detectada: ${lacuna.totalDiasFaltantes} dia(s) pendente(s), começando em ${lacuna.primeiraDataFaltante}; último dia integral conhecido ${ultimaDataCoberta}${evidenciaParcial}. Recuperação automática em andamento.`,
    )
    setStatusText(resultAtual.meta.source_total === 0
      ? 'Sem dados salvos. Coletando direto do equipamento...'
      : `Recuperando todas as lacunas até ${lacuna.ultimaDataEsperada}...`)

    try {
      await pasteurizadorApi.coletarAgora(
        filtro.inicio,
        lacuna.ultimaDataEsperada,
        '00:00:00',
        '23:59:59',
      )
    } catch (error) {
      if (operacaoHistoricoAtual(operationId)) {
        setSeriesCoverageWarning(
          `A recuperação automática falhou; ainda há lacunas até ${lacuna.ultimaDataEsperada}.`,
        )
      }
      throw error
    }
    if (!operacaoHistoricoAtual(operationId)) return null

    await loadColetasSalvas(filtro, operationId)
    if (!operacaoHistoricoAtual(operationId)) return null

    const refreshedResult = await consultarAmostrasPeriodo(filtro, operationId)
    if (!refreshedResult) return null

    cobertura = await consultarCoberturaSerie(filtro, operationId)
    if (!cobertura) return null

    resultAtual = refreshedResult
    if (coberturaMaisRecenteQueSerie(resultAtual, cobertura)) {
      const resultSincronizado = await consultarAmostrasPeriodo(filtro, operationId)
      if (!resultSincronizado) return null
      resultAtual = resultSincronizado
    }

    return { result: resultAtual, cobertura }
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

  async function loadAmostrasPeriodo(
    filtro = filtroAtual(),
    operationId = ++historicoOperationSequence.current,
  ) {
    setStatus('loading')
    setStatusText('Carregando amostras por período...')

    try {
      let result = await consultarAmostrasPeriodo(filtro, operationId)
      if (!result) return

      const verificada = await recuperarSerieSeIncompleta(result, filtro, operationId)
      if (!verificada) return

      finalizarSerieCarregada(verificada.result, verificada.cobertura, filtro)
    } catch (error) {
      if (!operacaoHistoricoAtual(operationId)) return
      if (error instanceof DOMException && error.name === 'AbortError') return

      setSeriesStale(amostras.length > 0)
      setStatus('error')
      setStatusText(amostras.length
        ? 'A atualização falhou; o último gráfico válido continua visível.'
        : (error instanceof Error ? error.message : 'Não foi possível carregar o gráfico por período.'))
    }
  }

  async function consultarAmostrasPeriodo(
    filtro = filtroAtual(),
    operationId = ++historicoOperationSequence.current,
  ) {
    const request = iniciarRequisicaoAmostras()
    const result = await pasteurizadorApi.amostrasPeriodo(
      filtro.inicio,
      filtro.fim,
      filtro.horaInicio,
      filtro.horaFim,
      filtro.canal,
      request.controller.signal,
    )
    if (!operacaoHistoricoAtual(operationId) || !aplicarSerie(result, request.id)) return null

    return result
  }

  async function consultarCoberturaSerie(
    filtro: HistoricoFiltro,
    operationId: number,
  ): Promise<CoberturaSerie | null> {
    coberturaRequest.current?.abort()
    const controller = new AbortController()
    coberturaRequest.current = controller

    try {
      const result = await pasteurizadorApi.cobertura(
        filtro.inicio,
        filtro.fim,
        controller.signal,
      )
      if (!operacaoHistoricoAtual(operationId) || controller.signal.aborted) return null

      return result
    } finally {
      if (coberturaRequest.current === controller) {
        coberturaRequest.current = null
      }
    }
  }

  async function loadColetasSalvas(filtro = filtroAtual(), operationId?: number) {
    const result = await pasteurizadorApi.coletas(
      filtro.inicio,
      filtro.fim,
      filtro.horaInicio,
      filtro.horaFim,
      1,
      50,
    )
    if (operationId !== undefined && !operacaoHistoricoAtual(operationId)) return null

    setColetas(result.items)
    setSelectedColetaId((current) => current && result.items.some((item) => item.id === current) ? current : null)
    return result
  }

  async function loadColetas(filtro = filtroAtual()) {
    const operationId = ++historicoOperationSequence.current
    setStatus('loading')
    setStatusText('Carregando coletas salvas...')

    try {
      const result = await loadColetasSalvas(filtro, operationId)
      if (!result || !operacaoHistoricoAtual(operationId)) return

      await loadAmostrasPeriodo(filtro, operationId)
    } catch (error) {
      if (!operacaoHistoricoAtual(operationId)) return

      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as coletas.')
    }
  }

  async function loadAmostras(coletaId: number, nextCanal = canal) {
    const operationId = ++historicoOperationSequence.current
    const request = iniciarRequisicaoAmostras()
    setStatus('loading')
    setStatusText('Carregando amostras da coleta...')

    try {
      const result = await pasteurizadorApi.amostras(coletaId, nextCanal, request.controller.signal)
      if (!operacaoHistoricoAtual(operationId) || !requisicaoAmostrasAtual(request.id)) return

      setAmostras(result)
      setSeriesMeta(null)
      setSeriesStale(false)
      setStatus('live')
      setStatusText('Amostras da coleta carregadas para o gráfico.')
    } catch (error) {
      if (
        !operacaoHistoricoAtual(operationId)
        || !requisicaoAmostrasAtual(request.id)
        || request.controller.signal.aborted
      ) return

      setSeriesStale(amostras.length > 0)
      setStatus('error')
      setStatusText(error instanceof Error ? error.message : 'Não foi possível carregar as amostras.')
    }
  }

  async function handleFiltrar() {
    const operationId = ++historicoOperationSequence.current
    const filtro = filtroAtual()
    setSelectedColetaId(null)
    setStatus('loading')
    setStatusText('Consultando período...')

    try {
      const coletasResult = await loadColetasSalvas(filtro, operationId)
      if (!coletasResult || !operacaoHistoricoAtual(operationId)) return

      let result = await consultarAmostrasPeriodo(filtro, operationId)
      if (!result) return

      const verificada = await recuperarSerieSeIncompleta(result, filtro, operationId)
      if (!verificada) return

      finalizarSerieCarregada(verificada.result, verificada.cobertura, filtro)
    } catch (error) {
      if (!operacaoHistoricoAtual(operationId)) return
      if (error instanceof DOMException && error.name === 'AbortError') return

      setSeriesStale(amostras.length > 0)
      setStatus('error')
      setStatusText(amostras.length
        ? 'A consulta falhou; o último gráfico válido continua visível.'
        : (error instanceof Error ? error.message : 'Não foi possível filtrar o período.'))
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
    if (view === 'inicio') {
      historicoOperationSequence.current += 1
      amostrasRequest.current?.controller.abort()
      coberturaRequest.current?.abort()
      void loadOverview()
    } else {
      void loadColetas()
    }
  }, [view, routeKey])

  useEffect(() => {
    return () => {
      historicoOperationSequence.current += 1
      amostrasRequest.current?.controller.abort()
      coberturaRequest.current?.abort()
    }
  }, [])

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
                seriesMeta={seriesMeta}
                seriesStale={seriesStale}
                seriesCoverageWarning={seriesCoverageWarning}
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
