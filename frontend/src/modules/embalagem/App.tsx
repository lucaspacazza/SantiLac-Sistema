import { useEffect, useRef, useState } from 'react'
import { embalagemApi, type OperacaoEmbalagem, type OrdemDisponivel } from './api/embalagemApi'
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
  const operacaoRef = useRef<OperacaoEmbalagem | null>(null)
  const registrandoRef = useRef(false)
  const filaCodigosRef = useRef<string[]>([])

  useEffect(() => {
    void import('./styles.css')
  }, [])

  useEffect(() => {
    operacaoRef.current = operacao
  }, [operacao])

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
        setOperacao(data)
        setUltimoCodigo(data.historico[0]?.codigo_barra ?? '')
        setStatus('ok')
        setMensagem('Lote carregado.')
      })
      .catch(() => {
        window.localStorage.removeItem('embalagem-lote-id')
        void carregarOrdensDisponiveis()
      })
  }, [])

  async function carregarOrdensDisponiveis() {
    setStatus('loading')
    setMensagem('Carregando OPs disponíveis.')

    try {
      const data = await embalagemApi.ordensDisponiveis()
      setOrdensDisponiveis(data)
      setStatus(data.length > 0 ? 'ok' : 'idle')
      setMensagem(data.length === 1 ? '1 OP disponível.' : `${data.length} OPs disponíveis.`)
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível carregar as OPs disponíveis.')
    }
  }

  async function validarOrdem(codigoOrdem: string) {
    setStatus('loading')
    setMensagem('Validando OP.')

    try {
      const data = await embalagemApi.validarOrdem(codigoOrdem)
      setOperacao(data)
      setCodigoBarra('')
      setUltimoCodigo(data.historico[0]?.codigo_barra ?? '')
      navegarOperacao(true)
      setPecasAvulsas(0)
      setStatus('ok')
      setMensagem('OP validada.')
      window.localStorage.setItem('embalagem-lote-id', String(data.lote.id))
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível validar a OP.')
    }
  }

  async function registrarCaixa(codigo: string) {
    const operacaoAtual = operacaoRef.current
    if (!operacaoAtual) return

    setStatus('loading')
    setMensagem('Registrando caixa.')

    try {
      const data = await embalagemApi.registrarCaixa(operacaoAtual.lote.id, codigo)
      setOperacao(data)
      operacaoRef.current = data
      setUltimoCodigo(codigo)
      setCodigoBarra('')
      setStatus('ok')
      const caixaRegistrada = data.historico[0]
      const palete = caixaRegistrada
        ? data.paletes.find((item) => item.id === caixaRegistrada.palete_id)
        : data.palete_atual
      const peso = caixaRegistrada?.peso ?? extrairPesoCodigo(codigo, data.barcode)
      const detalhePeso = peso === null || peso === undefined ? '' : ` de ${formatPesoInput(peso)} kg`
      const detalhePalete = palete ? ` no palete ${palete.numero} (${palete.caixas}/${data.lote.caixas_por_palete})` : ''
      setMensagem(`Caixa${detalhePeso} registrada${detalhePalete}.`)
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível registrar a caixa.')
    }
  }

  async function processarFilaCodigos() {
    if (registrandoRef.current) return
    registrandoRef.current = true

    try {
      while (filaCodigosRef.current.length > 0) {
        const codigo = filaCodigosRef.current.shift()
        if (codigo) {
          await registrarCaixa(codigo)
        }
      }
    } finally {
      registrandoRef.current = false
    }
  }

  function atualizarCodigoBarra(value: string) {
    const operacaoAtual = operacaoRef.current
    if (!operacaoAtual || operacaoAtual.lote.status === 'finalizado') return

    const tamanho = operacaoAtual.barcode.length
    const digits = value.replace(/\D/g, '')
    const codigos: string[] = []
    let index = 0

    while (index + tamanho <= digits.length) {
      codigos.push(digits.slice(index, index + tamanho))
      index += tamanho
    }

    const resto = digits.slice(index)
    setCodigoBarra(resto)

    if (codigos.length > 0) {
      filaCodigosRef.current.push(...codigos)
      void processarFilaCodigos()
    }
  }

  async function finalizar(
    pesoPecasAvulsas = 0,
    confirmar = true,
    paleteParcial: 'preencher' | 'finalizar' = decisaoPaleteParcial,
  ) {
    if (!operacao) return
    if (confirmar) {
      const confirmou = window.confirm('Finalizar a embalagem desta OP?')
      if (!confirmou) return
    }

    setStatus('loading')
    setMensagem('Finalizando OP.')

    try {
      await embalagemApi.finalizar(operacao.lote.id, pecasAvulsas, pesoPecasAvulsas, paleteParcial)
      setOperacao(null)
      operacaoRef.current = null
      setCodigoBarra('')
      setUltimoCodigo('')
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
    const palete = operacao?.palete_atual
    if (palete && palete.caixas > 0 && palete.caixas < operacao.lote.caixas_por_palete) {
      setModalPaleteParcialAberto(true)
      return
    }

    continuarFinalizacao('preencher', false)
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
    setCodigoBarra('')
    setUltimoCodigo('')
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
      <div className={`status-line is-${status}`} aria-live="polite" aria-atomic="true">
        <span />
        {mensagem}
      </div>

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
          onCodigoChange={atualizarCodigoBarra}
          onPecasAvulsasChange={setPecasAvulsas}
          onFinalizar={solicitarFinalizacao}
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
