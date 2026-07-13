import { ArrowLeft, Check, PackageCheck, Play, QrCode, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { carregamentoApi, type Carregamento, type CarregamentoResumo } from '../api/embalagemApi'

export function CarregamentoExpedicao() {
  const [ordens, setOrdens] = useState<CarregamentoResumo[]>([])
  const [ordem, setOrdem] = useState<Carregamento | null>(null)
  const [codigo, setCodigo] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ok'>('loading')
  const [mensagem, setMensagem] = useState('Carregando ordens.')
  const scannerRef = useRef<HTMLInputElement>(null)

  async function listar() {
    setStatus('loading')
    setMensagem('Carregando ordens.')
    try {
      const data = await carregamentoApi.listar()
      setOrdens(data.itens)
      setStatus('idle')
      setMensagem(data.itens.length ? 'Selecione uma ordem para iniciar.' : 'Nenhuma ordem disponível.')
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível carregar as ordens.')
    }
  }

  useEffect(() => { void listar() }, [])

  async function abrir(id: number) {
    setStatus('loading')
    setMensagem('Carregando ordem.')
    try {
      setOrdem(await carregamentoApi.detalhe(id))
      setStatus('ok')
      setMensagem('Ordem selecionada.')
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível abrir a ordem.')
    }
  }

  async function iniciar() {
    if (!ordem) return
    setStatus('loading')
    setMensagem('Iniciando carregamento.')
    try {
      setOrdem(await carregamentoApi.iniciar(ordem.id))
      setStatus('ok')
      setMensagem('Carregamento iniciado. Escaneie os paletes.')
      window.setTimeout(() => scannerRef.current?.focus(), 50)
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível iniciar.')
    }
  }

  async function escanear() {
    if (!ordem || !codigo.trim()) return
    setStatus('loading')
    setMensagem('Conferindo palete.')
    try {
      setOrdem(await carregamentoApi.escanear(ordem.id, codigo))
      setCodigo('')
      setStatus('ok')
      setMensagem('Palete conferido.')
      window.setTimeout(() => scannerRef.current?.focus(), 50)
    } catch (error) {
      setCodigo('')
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível conferir o palete.')
      window.setTimeout(() => scannerRef.current?.focus(), 50)
    }
  }

  async function concluir() {
    if (!ordem || !window.confirm('Concluir o carregamento desta ordem?')) return
    setStatus('loading')
    setMensagem('Concluindo carregamento.')
    try {
      await carregamentoApi.concluir(ordem.id)
      setOrdem(null)
      await listar()
      setStatus('ok')
      setMensagem('Carregamento concluído e estoque atualizado.')
    } catch (error) {
      setStatus('error')
      setMensagem(error instanceof Error ? error.message : 'Não foi possível concluir.')
    }
  }

  const carregados = ordem?.paletes.filter((item) => item.status_carregamento === 'carregado').length ?? 0
  const completo = Boolean(ordem && ordem.paletes_total > 0 && carregados === ordem.paletes_total)

  return (
    <main className="page expedition-loading-page">
      <div className={`status-line is-${status}`}><span />{mensagem}</div>

      {!ordem ? (
        <section className="panel loading-orders">
          <div className="panel-head">
            <div><span className="section-kicker">Expedição</span><h2>Ordens para carregamento</h2></div>
            <button className="icon-btn" type="button" onClick={() => void listar()} title="Atualizar"><RefreshCw size={17} /></button>
          </div>
          <div className="loading-order-list">
            {ordens.map((item) => (
              <button className="loading-order-row" type="button" key={item.id} onClick={() => void abrir(item.id)}>
                <div><strong>{item.codigo}</strong><span>{item.carregados}/{item.paletes_total} paletes conferidos</span></div>
                <div><strong>{formatWeight(item.peso_total)} kg</strong><span>{item.status === 'carregando' ? 'Em andamento' : 'Aguardando'}</span></div>
              </button>
            ))}
            {ordens.length === 0 ? <div className="loading-empty"><PackageCheck size={22} /><span>Nenhuma ordem lançada.</span></div> : null}
          </div>
        </section>
      ) : (
        <div className="loading-operation">
          <section className="summary-line loading-summary">
            <button className="icon-btn" type="button" onClick={() => setOrdem(null)} title="Voltar"><ArrowLeft size={17} /></button>
            <div><span className="section-kicker">Ordem</span><h2>{ordem.codigo}</h2></div>
            <Info label="Paletes" value={`${carregados}/${ordem.paletes_total}`} />
            <Info label="Caixas" value={String(ordem.caixas_total)} />
            <Info label="Peso total" value={`${formatWeight(ordem.peso_total)} kg`} />
          </section>

          {ordem.status === 'lancada' ? (
            <section className="panel loading-start">
              <PackageCheck size={34} />
              <div><h2>Ordem pronta para conferência</h2><p>Inicie o carregamento para liberar a leitura dos QR Codes.</p></div>
              <button className="btn primary" type="button" onClick={() => void iniciar()}><Play size={17} /> Iniciar carregamento</button>
            </section>
          ) : (
            <section className="grid-two loading-grid">
              <div className="panel">
                <div className="panel-head"><div><span className="section-kicker">Leitor</span><h2>Escanear palete</h2></div><QrCode size={24} /></div>
                <form className="scan-form loading-scan" onSubmit={(event) => { event.preventDefault(); void escanear() }}>
                  <label className="field"><span>QR Code do palete</span><input ref={scannerRef} autoFocus className="control scan-input" value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Aponte o leitor para a etiqueta" /></label>
                  <button className="btn primary" disabled={!codigo.trim() || status === 'loading'} type="submit">Conferir</button>
                </form>
                <div className="loading-progress"><span style={{ width: `${ordem.paletes_total ? (carregados / ordem.paletes_total) * 100 : 0}%` }} /></div>
                <button className="btn secondary loading-complete" disabled={!completo || status === 'loading'} type="button" onClick={() => void concluir()}><Check size={17} /> Concluir carregamento</button>
              </div>
              <div className="panel loading-pallets">
                <div className="panel-head"><div><span className="section-kicker">Conferência</span><h2>Paletes da ordem</h2></div></div>
                <div className="loading-pallet-list">
                  {ordem.paletes.map((item) => (
                    <article className={item.status_carregamento === 'carregado' ? 'checked' : ''} key={item.id}>
                      <div><strong>Palete #{item.id}</strong><span>{productName(item.produto)} · lote {item.lote}</span></div>
                      <div><strong>{formatWeight(item.peso_total)} kg</strong><span>{item.status_carregamento === 'carregado' ? 'Conferido' : 'Pendente'}</span></div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info"><span>{label}</span><strong>{value}</strong></div>
}
function formatWeight(value: number) { return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) }
function productName(value: string) { return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
