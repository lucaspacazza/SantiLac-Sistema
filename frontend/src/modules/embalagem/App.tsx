import { useEffect, useRef, useState } from 'react'
import { embalagemApi, type OperacaoEmbalagem, type OrdemDisponivel } from './api/embalagemApi'
import {
  createPendingScan,
  discardRejectedOfflineScans,
  getOfflineDeviceId,
  indexedDbOfflineScanRepository,
  listOfflineScans,
  readCachedOperation,
  readCachedOperationByOrder,
  readCachedOrders,
  retryRejectedOfflineScans,
  saveOfflineScans,
  summarizeOfflineScans,
  synchronizePendingScans,
  writeCachedOperation,
  writeCachedOrders,
  type OfflineScanSummary,
} from './offline/offlineQueue'
import { HistoricoCaixas } from './views/HistoricoCaixas'
import { IniciarEmbalagem } from './views/IniciarEmbalagem'
import { OperacaoLote } from './views/OperacaoLote'

type Status = 'idle' | 'loading' | 'ok' | 'error'
type Tela = 'operacao' | 'historico'

export function App() {
  const [ordensDisponiveis, setOrdensDisponiveis] = useState<OrdemDisponivel[]>([])
  const [codigoBarra, setCodigoBarra] = useState('')
  const [pecasAvulsas, setPecasAvulsas] = useState(0)
  const [modalAvulsasAberto, setModalAvulsasAberto] = useState(false)
  const [modalPaleteParcialAberto, setModalPaleteParcialAberto] = useState(false)
  const [decisaoPaleteParcial, setDecisaoPaleteParcial] = useState<'preencher' | 'finalizar'>('preencher')
  const [codigoAvulsas, setCodigoAvulsas] = useState('')
  const [pesoAvulsas, setPesoAvulsas] = useState('')
  const [erroAvulsas, setErroAvulsas] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [mensagem, setMensagem] = useState('Carregando OPs disponíveis.')
  const [operacao, setOperacao] = useState<OperacaoEmbalagem | null>(null)
  const [tela, setTela] = useState<Tela>('operacao')
  const [ultimoCodigo, setUltimoCodigo] = useState('')
  const [offlineSummary, setOfflineSummary] = useState<OfflineScanSummary>({ pending: 0, rejected: 0, total: 0 })
  const [sincronizando, setSincronizando] = useState(false)
  const [conectado, setConectado] = useState(() => navigator.onLine)
  const operacaoRef = useRef<OperacaoEmbalagem | null>(null)
  const sincronizandoRef = useRef(false)
  const persistindoRef = useRef(false)
  const codigoBufferRef = useRef('')

  useEffect(() => {
    void import('./styles.css')
  }, [])

  useEffect(() => {
    operacaoRef.current = operacao
  }, [operacao])

  useEffect(() => {
    const handleOnline = () => {
      setConectado(true)
      void syncOfflineScans()
    }
    const handleOffline = () => setConectado(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncOfflineScans()
    }
    const interval = window.setInterval(() => void syncOfflineScans(), 15000)

    void atualizarEstadoOffline()
    void syncOfflineScans()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if ((status !== 'ok' && status !== 'error') || !mensagem) return

    const statusExibido = status
    const mensagemExibida = mensagem
    const timer = window.setTimeout(() => {
      setStatus((atual) => atual === statusExibido ? 'idle' : atual)
      setMensagem((atual) => atual === mensagemExibida ? '' : atual)
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [mensagem, status])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const telaState = (event.state as { embalagemTela?: Tela } | null)?.embalagemTela
      setTela(telaState === 'historico' ? 'historico' : 'operacao')
    }

    if (!window.history.state?.embalagemTela) {
      window.history.replaceState({ ...window.history.state, embalagemTela: 'operacao' }, '')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const loteId = Number(window.localStorage.getItem('embalagem-lote-id') || 0)
    if (!loteId) {
      void carregarOrdensDisponiveis()
      return
    }

    setStatus('loading')
    setMensagem('Carregando lote em andamento.')
    embalagemApi.estado(loteId)
      .then((data) => {
        aplicarOperacao(data)
        setStatus('ok')
        setMensagem('Lote carregado.')
      })
      .catch(async (error) => {
        const cached = podeUsarCacheOffline(error) ? await readCachedOperation(loteId) : null
        if (cached) {
          aplicarOperacao(cached, false)
          setConectado(false)
          setStatus('ok')
          setMensagem('Lote aberto com os dados salvos no tablet.')
          return
        }

        window.localStorage.removeItem('embalagem-lote-id')
        void carregarOrdensDisponiveis()
      })
  }, [])

  function aplicarOperacao(data: OperacaoEmbalagem, persistir = true) {
    setOperacao(data)
    operacaoRef.current = data
    setUltimoCodigo(data.historico[0]?.codigo_barra ?? '')
    window.localStorage.setItem('embalagem-lote-id', String(data.lote.id))
    if (persistir) void writeCachedOperation(data)
    void atualizarEstadoOffline(data.lote.id)
  }

  async function atualizarEstadoOffline(loteId = operacaoRef.current?.lote.id) {
    try {
      const scans = await listOfflineScans()
      setOfflineSummary(loteId ? summarizeOfflineScans(scans, loteId) : { pending: 0, rejected: 0, total: 0 })
      const ultimoLocal = loteId
        ? scans.filter((scan) => scan.loteId === loteId).sort((a, b) => b.capturedAt - a.capturedAt)[0]
        : null
      if (ultimoLocal) setUltimoCodigo(ultimoLocal.codigoBarra)
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível consultar as caixas salvas no tablet.')
    }
  }

  async function syncOfflineScans() {
    if (sincronizandoRef.current) return
    sincronizandoRef.current = true
    setSincronizando(true)

    try {
      const result = await synchronizePendingScans(
        indexedDbOfflineScanRepository,
        embalagemApi.registrarCaixa,
        async (scan, data) => {
          await writeCachedOperation(data)
          if (operacaoRef.current?.lote.id === scan.loteId) {
            aplicarOperacao(data, false)
            setUltimoCodigo(scan.codigoBarra)
          }
        },
      )

      setConectado(navigator.onLine && !result.paused)
      await atualizarEstadoOffline()

      if (result.rejected > 0) {
        setStatus('error')
        setMensagem(`${result.rejected} caixa(s) não foram aceitas pelo servidor. Elas continuam salvas no tablet para conferência.`)
      } else if (result.confirmed > 0) {
        setStatus('ok')
        setMensagem(`${result.confirmed} caixa(s) sincronizadas com o servidor.`)
      }
    } catch (error) {
      setConectado(false)
      await atualizarEstadoOffline()
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'A sincronização foi pausada. As caixas continuam salvas no tablet.')
    } finally {
      sincronizandoRef.current = false
      setSincronizando(false)
    }
  }

  async function carregarOrdensDisponiveis() {
    setStatus('loading')
    setMensagem('Carregando OPs disponíveis.')

    try {
      const data = await embalagemApi.ordensDisponiveis()
      setOrdensDisponiveis(data)
      await writeCachedOrders(data)
      setConectado(true)
      setStatus(data.length > 0 ? 'ok' : 'idle')
      setMensagem(data.length === 1 ? '1 OP disponível.' : `${data.length} OPs disponíveis.`)
    } catch (error) {
      const cached = podeUsarCacheOffline(error) ? await readCachedOrders() : null
      if (cached) {
        setOrdensDisponiveis(cached)
        setConectado(false)
        setStatus('ok')
        setMensagem('OPs disponíveis carregadas do tablet. Sem conexão com o servidor.')
        return
      }

      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível carregar as OPs disponíveis.')
    }
  }

  async function validarOrdem(codigoOrdem: string) {
    setStatus('loading')
    setMensagem('Validando OP.')

    try {
      const data = await embalagemApi.validarOrdem(codigoOrdem)
      aplicarOperacao(data)
      setCodigoBarra('')
      navegarOperacao(true)
      setPecasAvulsas(0)
      setStatus('idle')
      setMensagem('')
    } catch (error) {
      const cached = podeUsarCacheOffline(error) ? await readCachedOperationByOrder(codigoOrdem) : null
      if (cached && cached.lote.status !== 'finalizado') {
        aplicarOperacao(cached, false)
        setCodigoBarra('')
        navegarOperacao(true)
        setPecasAvulsas(0)
        setConectado(false)
        setStatus('ok')
        setMensagem('OP aberta com os dados salvos no tablet. As caixas serão sincronizadas quando a conexão voltar.')
        return
      }

      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível validar a OP.')
    }
  }

  function atualizarCodigoBarra(value: string) {
    const operacaoAtual = operacaoRef.current
    if (!operacaoAtual || operacaoAtual.lote.status === 'finalizado') return

    const digits = value.replace(/\D/g, '')
    codigoBufferRef.current = digits
    setCodigoBarra(digits)
    void persistirCodigosCompletos()
  }

  async function persistirCodigosCompletos() {
    if (persistindoRef.current) return
    persistindoRef.current = true

    try {
      while (true) {
        const operacaoAtual = operacaoRef.current
        if (!operacaoAtual || operacaoAtual.lote.status === 'finalizado') return

        const tamanho = operacaoAtual.barcode.length
        const buffer = codigoBufferRef.current
        if (buffer.length < tamanho) return

        const codigo = buffer.slice(0, tamanho)
        const scan = createPendingScan({
          deviceId: getOfflineDeviceId(),
          loteId: operacaoAtual.lote.id,
          codigoBarra: codigo,
        })

        try {
          await saveOfflineScans([scan])
        } catch (error) {
          setStatus('error')
          setMensagem(error instanceof Error ? error.message : 'A caixa não pôde ser salva no tablet. Escaneie novamente.')
          return
        }

        codigoBufferRef.current = codigoBufferRef.current.slice(tamanho)
        setCodigoBarra(codigoBufferRef.current)
        setUltimoCodigo(codigo)
        await atualizarEstadoOffline(operacaoAtual.lote.id)
        setStatus('ok')
        setMensagem('Caixa salva no tablet. A sincronização será feita automaticamente.')
        void syncOfflineScans()
      }
    } finally {
      persistindoRef.current = false
    }
  }

  async function finalizar(
    pesoPecasAvulsas = 0,
    confirmar = true,
    paleteParcial: 'preencher' | 'finalizar' = decisaoPaleteParcial,
  ) {
    if (!operacao) return
    if (offlineSummary.total > 0) {
      setStatus('error')
      setMensagem('Aguarde a sincronização ou resolva as caixas pendentes antes de finalizar a OP.')
      return
    }
    if (confirmar) {
      const confirmou = window.confirm('Finalizar a embalagem desta OP?')
      if (!confirmou) return
    }

    setStatus('loading')
    setMensagem('Finalizando OP.')

    try {
      const finalizada = await embalagemApi.finalizar(operacao.lote.id, pecasAvulsas, pesoPecasAvulsas, paleteParcial)
      await writeCachedOperation(finalizada)
      setOperacao(null)
      operacaoRef.current = null
      codigoBufferRef.current = ''
      setCodigoBarra('')
      setUltimoCodigo('')
      setOfflineSummary({ pending: 0, rejected: 0, total: 0 })
      setPecasAvulsas(0)
      navegarOperacao(true)
      window.localStorage.removeItem('embalagem-lote-id')
      fecharModalAvulsas()
      await carregarOrdensDisponiveis()
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível finalizar a OP.')
    }
  }

  function solicitarFinalizacao() {
    if (offlineSummary.total > 0) {
      setStatus('error')
      setMensagem('Existem caixas aguardando sincronização ou conferência. Resolva-as antes de finalizar a OP.')
      return
    }

    const palete = operacao?.palete_atual
    if (palete && palete.caixas > 0 && palete.caixas < operacao.lote.caixas_por_palete) {
      setModalPaleteParcialAberto(true)
      return
    }

    continuarFinalizacao('preencher', false)
  }

  async function tentarNovamenteRejeitadas() {
    if (!operacao) return
    await retryRejectedOfflineScans(operacao.lote.id)
    await atualizarEstadoOffline(operacao.lote.id)
    void syncOfflineScans()
  }

  async function descartarRejeitadas() {
    if (!operacao || offlineSummary.rejected === 0) return
    const confirmou = window.confirm('Descartar somente as caixas recusadas pelo servidor? Esta ação não apaga caixas já gravadas.')
    if (!confirmou) return
    await discardRejectedOfflineScans(operacao.lote.id)
    await atualizarEstadoOffline(operacao.lote.id)
    setStatus('ok')
    setMensagem('Caixas recusadas foram descartadas da fila local.')
  }

  function continuarFinalizacao(paleteParcial: 'preencher' | 'finalizar', paleteConfirmado = true) {
    setDecisaoPaleteParcial(paleteParcial)
    setModalPaleteParcialAberto(false)

    if (pecasAvulsas > 0) {
      setCodigoAvulsas('')
      setPesoAvulsas('')
      setErroAvulsas('')
      setModalAvulsasAberto(true)
      return
    }

    void finalizar(0, !paleteConfirmado, paleteParcial)
  }

  function atualizarCodigoAvulsas(value: string) {
    setCodigoAvulsas(value)
    setErroAvulsas('')

    if (!operacao) return
    const peso = extrairPesoCodigo(value, operacao.barcode)
    if (peso !== null) {
      setPesoAvulsas(formatPesoInput(peso))
    }
  }

  function confirmarAvulsas() {
    const peso = parsePesoInput(pesoAvulsas)
    if (peso <= 0) {
      setErroAvulsas('Informe o peso das peças avulsas.')
      return
    }

    void finalizar(peso, false, decisaoPaleteParcial)
  }

  function fecharModalAvulsas() {
    setModalAvulsasAberto(false)
    setCodigoAvulsas('')
    setPesoAvulsas('')
    setErroAvulsas('')
  }

  function novaOp() {
    setOperacao(null)
    operacaoRef.current = null
    codigoBufferRef.current = ''
    setCodigoBarra('')
    setUltimoCodigo('')
    setOfflineSummary({ pending: 0, rejected: 0, total: 0 })
    navegarOperacao(true)
    setPecasAvulsas(0)
    window.localStorage.removeItem('embalagem-lote-id')
    void carregarOrdensDisponiveis()
  }

  function abrirHistorico() {
    if (tela === 'historico') return
    window.history.pushState({ ...window.history.state, embalagemTela: 'historico' }, '')
    setTela('historico')
  }

  function navegarOperacao(replace = false) {
    const state = { ...window.history.state, embalagemTela: 'operacao' }
    if (replace) {
      window.history.replaceState(state, '')
    } else if (tela === 'historico') {
      window.history.back()
    } else {
      window.history.replaceState(state, '')
      setTela('operacao')
    }
  }

  return (
    <main className="page">
      {(status === 'ok' || status === 'error') && mensagem ? (
        <div
          className={`operation-toast is-${status}`}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live={status === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <span aria-hidden="true" />
          <p>{mensagem}</p>
        </div>
      ) : null}

      {!operacao ? (
        <IniciarEmbalagem
          ordens={ordensDisponiveis}
          carregando={status === 'loading'}
          onAtualizar={() => void carregarOrdensDisponiveis()}
          onSelecionar={(ordem) => void validarOrdem(ordem.codigo_ordem)}
        />
      ) : tela === 'historico' ? (
        <HistoricoCaixas
          operacao={operacao}
          onVoltar={() => navegarOperacao()}
        />
      ) : (
        <OperacaoLote
          operacao={operacao}
          codigoBarra={codigoBarra}
          ultimoCodigo={ultimoCodigo}
          pecasAvulsas={pecasAvulsas}
          processando={status === 'loading'}
          online={conectado}
          sincronizando={sincronizando}
          offlinePending={offlineSummary.pending}
          offlineRejected={offlineSummary.rejected}
          onCodigoChange={atualizarCodigoBarra}
          onPecasAvulsasChange={setPecasAvulsas}
          onFinalizar={solicitarFinalizacao}
          onSincronizar={() => void syncOfflineScans()}
          onTentarRejeitadas={() => void tentarNovamenteRejeitadas()}
          onDescartarRejeitadas={() => void descartarRejeitadas()}
          onAbrirHistorico={abrirHistorico}
          onNovaOp={novaOp}
        />
      )}

      {operacao && modalAvulsasAberto ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="avulsas-title">
            <div>
              <span className="section-kicker">Peças avulsas</span>
              <h2 id="avulsas-title">Pesar {pecasAvulsas} peças avulsas</h2>
            </div>

            <label className="field">
              <span>Código da balança</span>
              <input
                autoFocus
                className="control scan-input"
                data-scanner-input="true"
                inputMode="none"
                placeholder="Escaneie a etiqueta"
                value={codigoAvulsas}
                onChange={(event) => atualizarCodigoAvulsas(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Peso manual</span>
              <input
                className="control"
                inputMode="decimal"
                placeholder="0,000"
                value={pesoAvulsas}
                onChange={(event) => {
                  setPesoAvulsas(event.target.value)
                  setErroAvulsas('')
                }}
              />
            </label>

            {erroAvulsas ? <p className="modal-error">{erroAvulsas}</p> : null}

            <div className="modal-actions">
              <button className="btn secondary" disabled={status === 'loading'} type="button" onClick={fecharModalAvulsas}>
                Cancelar
              </button>
              <button className="btn primary" disabled={status === 'loading'} type="button" onClick={confirmarAvulsas}>
                Salvar peso e finalizar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {operacao && modalPaleteParcialAberto && operacao.palete_atual ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="palete-parcial-title">
            <div>
              <span className="section-kicker">Palete incompleto</span>
              <h2 id="palete-parcial-title">Palete {operacao.palete_atual.numero}</h2>
            </div>
            <p className="modal-copy">
              O palete {operacao.palete_atual.numero} está incompleto. Deseja deixá-lo aberto para receber caixas dos próximos lotes ou finalizá-lo e gerar a etiqueta?
            </p>
            <div className="modal-actions">
              <button className="btn secondary" type="button" onClick={() => setModalPaleteParcialAberto(false)}>
                Cancelar
              </button>
              <button className="btn secondary" type="button" onClick={() => continuarFinalizacao('preencher')}>
                Continuar preenchendo
              </button>
              <button className="btn primary" type="button" onClick={() => continuarFinalizacao('finalizar')}>
                Finalizar palete
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

function extrairPesoCodigo(codigo: string, barcode: OperacaoEmbalagem['barcode']): number | null {
  const digits = codigo.replace(/\D/g, '')
  if (digits.length < barcode.weight_start + barcode.weight_length - 1) return null
  const raw = digits.slice(barcode.weight_start - 1, barcode.weight_start - 1 + barcode.weight_length)
  if (!/^\d+$/.test(raw)) return null
  return Number(raw) / barcode.weight_divisor
}

function parsePesoInput(value: string) {
  const decimalValue = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value
  const normalized = decimalValue.replace(/[^\d.]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : 0
}

function formatPesoInput(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false })
}

function podeUsarCacheOffline(error: unknown) {
  const status = Number((error as { status?: unknown } | null)?.status)
  return !Number.isInteger(status) || status < 400 || status >= 500 || [401, 408, 419, 425, 429].includes(status)
}
