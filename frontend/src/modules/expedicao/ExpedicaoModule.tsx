import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  PackageCheck,
  Plus,
  Search,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  expedicaoApi,
  type OrdemExpedicao,
  type OrdemPayload,
  type PaleteEstoque,
  type RelatorioItem,
} from './api/expedicaoApi'
import './expedicao.css'

type View = 'resumo' | 'estoque' | 'ordens' | 'relatorios'
type ResumoData = Awaited<ReturnType<typeof expedicaoApi.resumo>>

const emptyPayload: OrdemPayload = {
  cliente: '',
  destino: '',
  data_prevista: '',
  placa: '',
  motorista: '',
  observacoes: '',
  paletes: [],
}

export function ExpedicaoModule() {
  const [view, setView] = useState<View>(() => viewFromHash())

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <section className="exp-page">
      {view === 'resumo' ? <Resumo /> : null}
      {view === 'estoque' ? <Estoque /> : null}
      {view === 'ordens' ? <Ordens /> : null}
      {view === 'relatorios' ? <Relatorios /> : null}
    </section>
  )
}

function Resumo() {
  const [data, setData] = useState<ResumoData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    expedicaoApi.resumo().then(setData).catch((err) => setError(message(err)))
  }, [])

  if (!data) return <Loading text={error || 'Carregando resumo da expedição...'} />

  return (
    <>
      <PageHeader title="Expedição" subtitle="Estoque final e carregamentos." action={
        <button className="exp-button primary" type="button" onClick={() => navigate('ordens')}>
          <Plus size={16} /> Nova ordem
        </button>
      } />

      <div className="exp-kpis">
        <Kpi label="Peso em estoque" value={kg(data.totais.peso_total)} />
        <Kpi label="Paletes" value={integer(data.totais.paletes)} />
        <Kpi label="Caixas" value={integer(data.totais.caixas)} />
        <Kpi label="Reservados" value={integer(data.totais.reservados)} />
        <Kpi label="Ordens abertas" value={integer(data.totais.ordens_abertas)} />
      </div>

      <div className="exp-layout-main">
        <section className="exp-panel">
          <PanelHeader title="Estoque por produto" count={`${data.produtos.length} produto(s)`} />
          <div className="exp-product-list">
            {data.produtos.map((produto) => (
              <article className="exp-product-row" key={produto.produto}>
                <div>
                  <strong>{productName(produto.produto)}</strong>
                  <span>{integer(produto.caixas)} caixas</span>
                </div>
                <div>
                  <strong>{kg(produto.peso_total)}</strong>
                  <span>{integer(produto.paletes)} paletes</span>
                </div>
              </article>
            ))}
            {data.produtos.length === 0 ? <Empty text="Nenhum palete disponível." /> : null}
          </div>
        </section>

        <section className="exp-panel">
          <PanelHeader title="Ordens recentes" count={`${data.ordens_recentes.length} registro(s)`} />
          <div className="exp-order-list">
            {data.ordens_recentes.map((ordem) => <OrderRow ordem={ordem} key={ordem.id} />)}
            {data.ordens_recentes.length === 0 ? <Empty text="Nenhuma ordem criada." /> : null}
          </div>
        </section>
      </div>
    </>
  )
}

function Estoque() {
  const [data, setData] = useState<{ itens: PaleteEstoque[]; produtos: string[] }>({ itens: [], produtos: [] })
  const [busca, setBusca] = useState('')
  const [produto, setProduto] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await expedicaoApi.estoque({ busca, produto }))
    } finally {
      setLoading(false)
    }
  }, [busca, produto])

  useEffect(() => { void load() }, [load])

  return (
    <>
      <PageHeader title="Estoque de expedição" subtitle="Paletes, lotes e caixas disponíveis." />
      <section className="exp-toolbar">
        <label className="exp-search"><Search size={15} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Produto, lote ou OP" /></label>
        <select value={produto} onChange={(event) => setProduto(event.target.value)}>
          <option value="">Todos os produtos</option>
          {data.produtos.map((item) => <option key={item} value={item}>{productName(item)}</option>)}
        </select>
        <span className="exp-toolbar-count">{data.itens.length} palete(s)</span>
      </section>
      <section className="exp-panel exp-table-panel">
        {loading ? <Loading text="Carregando estoque..." /> : (
          <div className="exp-table-wrap">
            <table className="exp-table">
              <thead><tr><th>Palete</th><th>Produto</th><th>Lote inicial</th><th>Fabricação</th><th>Validade</th><th>Caixas</th><th>Peso</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {data.itens.map((item) => (
                  <tr key={item.id}>
                    <td><strong>#{item.id}</strong></td>
                    <td>{productName(item.produto)}</td>
                    <td>{item.lote}</td>
                    <td>{date(item.data_fabricacao)}</td>
                    <td>{date(item.data_validade)}</td>
                    <td>{integer(item.caixas)}</td>
                    <td>{kg(item.peso_total)}</td>
                    <td><Status value={item.ordem_expedicao ? 'reservado' : 'disponível'} /></td>
                    <td><IconButton label="Consultar palete" onClick={() => setSelected(item.id)}><Eye size={16} /></IconButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.itens.length === 0 ? <Empty text="Nenhum palete encontrado." /> : null}
          </div>
        )}
      </section>
      {selected ? <PalletDetail id={selected} onClose={() => setSelected(null)} /> : null}
    </>
  )
}

function Ordens() {
  const [ordens, setOrdens] = useState<OrdemExpedicao[]>([])
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [editor, setEditor] = useState<number | 'new' | null>(null)
  const [detail, setDetail] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    const result = await expedicaoApi.ordens({ busca, status })
    setOrdens(result.itens)
  }, [busca, status])

  useEffect(() => { void load() }, [load])

  async function action(id: number, type: 'lancar' | 'cancelar', reload = true): Promise<boolean> {
    if (type === 'cancelar' && !window.confirm('Cancelar esta ordem de expedição?')) return false
    try {
      type === 'lancar' ? await expedicaoApi.lancar(id) : await expedicaoApi.cancelar(id)
      setFeedback(type === 'lancar' ? 'Ordem lançada para a embalagem.' : 'Ordem cancelada.')
      if (reload) await load()
      return true
    } catch (err) {
      setFeedback(message(err))
      return false
    }
  }

  return (
    <>
      <PageHeader title="Ordens de expedição" subtitle="Planejamento, separação e acompanhamento dos carregamentos." action={
        <button className="exp-button primary" type="button" onClick={() => setEditor('new')}><Plus size={16} /> Nova ordem</button>
      } />
      <section className="exp-toolbar">
        <label className="exp-search"><Search size={15} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Ordem, cliente ou destino" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option><option value="lancada">Lançada</option>
          <option value="carregando">Carregando</option><option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        {feedback ? <span className="exp-feedback">{feedback}</span> : null}
      </section>
      <section className="exp-panel exp-table-panel">
        <div className="exp-table-wrap">
          <table className="exp-table">
            <thead><tr><th>Ordem</th><th>Cliente</th><th>Destino</th><th>Data prevista</th><th>Paletes</th><th>Peso</th><th>Status</th><th /></tr></thead>
            <tbody>
              {ordens.map((ordem) => (
                <tr key={ordem.id}>
                  <td><strong>{ordem.codigo}</strong></td><td>{ordem.cliente}</td><td>{ordem.destino}</td>
                  <td>{date(ordem.data_prevista)}</td><td>{integer(ordem.paletes_total)}</td><td>{kg(ordem.peso_total)}</td>
                  <td><Status value={ordem.status} /></td>
                  <td><div className="exp-row-actions">
                    <IconButton label="Ver ordem" onClick={() => setDetail(ordem.id)}><Eye size={16} /></IconButton>
                    {ordem.status === 'rascunho' ? <IconButton label="Editar ordem" onClick={() => setEditor(ordem.id)}><ClipboardCheck size={16} /></IconButton> : null}
                    {ordem.status === 'rascunho' ? <IssueOrderButton onIssue={() => action(ordem.id, 'lancar', false)} onComplete={() => void load()} /> : null}
                    {['rascunho', 'lancada'].includes(ordem.status) ? <IconButton label="Cancelar ordem" onClick={() => void action(ordem.id, 'cancelar')}><X size={16} /></IconButton> : null}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordens.length === 0 ? <Empty text="Nenhuma ordem encontrada." /> : null}
        </div>
      </section>
      {editor ? <OrderEditor id={editor === 'new' ? null : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void load() }} /> : null}
      {detail ? <OrderDetail id={detail} onClose={() => setDetail(null)} /> : null}
    </>
  )
}

function OrderEditor({ id, onClose, onSaved }: { id: number | null; onClose: () => void; onSaved: () => void }) {
  const [payload, setPayload] = useState<OrdemPayload>(emptyPayload)
  const [paletes, setPaletes] = useState<PaleteEstoque[]>([])
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([expedicaoApi.estoque({ disponivel: true }), id ? expedicaoApi.ordem(id) : Promise.resolve(null)])
      .then(([stock, ordem]) => {
        let available = stock.itens
        if (ordem?.paletes) {
          const current = ordem.paletes.map((item) => ({
            ...item,
            codigo_ordem: '',
            data_fabricacao: '',
            data_validade: '',
            status: '',
            expedicao_status: 'reservado',
            etiqueta_status: '',
            ordem_expedicao: ordem.codigo,
            ordem_status: ordem.status,
          }) as PaleteEstoque)
          available = [...current, ...available.filter((item) => !current.some((selected) => selected.id === item.id))]
          setPayload({
            cliente: ordem.cliente,
            destino: ordem.destino,
            data_prevista: ordem.data_prevista ?? '',
            placa: ordem.placa ?? '',
            motorista: ordem.motorista ?? '',
            observacoes: ordem.observacoes ?? '',
            paletes: ordem.paletes.map((item) => item.id),
          })
        }
        setPaletes(available)
      })
      .catch((err) => setError(message(err)))
      .finally(() => setLoading(false))
  }, [id])

  const selected = useMemo(() => paletes.filter((item) => payload.paletes.includes(item.id)), [paletes, payload.paletes])
  const total = selected.reduce((sum, item) => sum + item.peso_total, 0)

  function toggle(id: number) {
    setPayload((current) => ({
      ...current,
      paletes: current.paletes.includes(id) ? current.paletes.filter((item) => item !== id) : [...current.paletes, id],
    }))
  }

  function review() {
    if (!payload.cliente.trim() || !payload.destino.trim()) return setError('Informe o cliente e o destino.')
    if (payload.paletes.length === 0) return setError('Selecione ao menos um palete.')
    setError('')
    setStep('review')
  }

  async function save() {
    setLoading(true)
    try {
      id ? await expedicaoApi.atualizar(id, payload) : await expedicaoApi.criar(payload)
      onSaved()
    } catch (err) {
      setError(message(err))
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={step === 'review' ? 'Revisar carga' : id ? 'Editar carga' : 'Montar carga'} onClose={onClose} wide builder={step === 'form'}>
      {loading ? <Loading text="Carregando dados..." /> : step === 'form' ? (
        <div className="exp-load-builder">
          <section className="exp-builder-products">
            <header className="exp-builder-head">
              <div><span>Produtos disponíveis</span><strong>Selecione os paletes da carga</strong></div>
              <span>{paletes.length} disponível(is)</span>
            </header>
            <div className="exp-pallet-selector">
              {paletes.map((palete) => (
                <label className={`exp-pallet-option ${payload.paletes.includes(palete.id) ? 'selected' : ''}`} key={palete.id}>
                  <input type="checkbox" checked={payload.paletes.includes(palete.id)} onChange={() => toggle(palete.id)} />
                  <span><strong>Palete #{palete.id}</strong><small>{productName(palete.produto)} · lote {palete.lote}</small></span>
                  <b>{kg(palete.peso_total)}</b>
                </label>
              ))}
              {paletes.length === 0 ? <Empty text="Nenhum palete disponível." /> : null}
            </div>
          </section>

          <aside className="exp-builder-summary">
            <header className="exp-builder-head">
              <div><span>Detalhes</span><strong>Informações da carga</strong></div>
            </header>
            <div className="exp-form-grid">
              <Field label="Cliente" required><input value={payload.cliente} onChange={(e) => setPayload({ ...payload, cliente: e.target.value })} /></Field>
              <Field label="Destino" required><input value={payload.destino} onChange={(e) => setPayload({ ...payload, destino: e.target.value })} /></Field>
              <Field label="Data prevista"><input type="date" value={payload.data_prevista} onChange={(e) => setPayload({ ...payload, data_prevista: e.target.value })} /></Field>
              <Field label="Placa"><input value={payload.placa} onChange={(e) => setPayload({ ...payload, placa: e.target.value.toUpperCase() })} /></Field>
              <Field label="Motorista"><input value={payload.motorista} onChange={(e) => setPayload({ ...payload, motorista: e.target.value })} /></Field>
              <Field label="Observações"><input value={payload.observacoes} onChange={(e) => setPayload({ ...payload, observacoes: e.target.value })} /></Field>
            </div>
            <div className="exp-builder-totals" aria-live="polite">
              <Review label="Paletes selecionados" value={integer(selected.length)} />
              <Review label="Peso da carga" value={kg(total)} />
            </div>
            {error ? <p className="exp-error">{error}</p> : null}
            <div className="exp-modal-actions">
              <button className="exp-button" type="button" onClick={onClose}>Cancelar</button>
              <button className="exp-button primary" type="button" onClick={review}><Check size={16} /> Concluir montagem</button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="exp-review">
          <div className="exp-review-grid">
            <Review label="Cliente" value={payload.cliente} /><Review label="Destino" value={payload.destino} />
            <Review label="Data prevista" value={date(payload.data_prevista)} /><Review label="Motorista" value={payload.motorista || '-'} />
            <Review label="Placa" value={payload.placa || '-'} /><Review label="Peso total" value={kg(total)} />
          </div>
          <div className="exp-review-list">{selected.map((item) => <div key={item.id}><span>Palete #{item.id} · {productName(item.produto)}</span><strong>{kg(item.peso_total)}</strong></div>)}</div>
          <div className="exp-modal-actions"><button className="exp-button" onClick={() => setStep('form')}><ArrowLeft size={16} /> Voltar</button><button className="exp-button primary" onClick={() => void save()}><Check size={16} /> Salvar rascunho</button></div>
        </div>
      )}
    </Modal>
  )
}

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [ordem, setOrdem] = useState<OrdemExpedicao | null>(null)
  useEffect(() => { expedicaoApi.ordem(id).then(setOrdem) }, [id])
  return <Modal title={ordem?.codigo ?? 'Ordem de expedição'} onClose={onClose} wide>
    {!ordem ? <Loading text="Carregando ordem..." /> : <div className="exp-review">
      <div className="exp-review-grid"><Review label="Cliente" value={ordem.cliente} /><Review label="Destino" value={ordem.destino} /><Review label="Data prevista" value={date(ordem.data_prevista)} /><Review label="Status" value={statusLabel(ordem.status)} /><Review label="Motorista" value={ordem.motorista || '-'} /><Review label="Placa" value={ordem.placa || '-'} /><Review label="Iniciado por" value={ordem.operadores?.iniciado_por || '-'} /><Review label="Concluído por" value={ordem.operadores?.concluido_por || '-'} /></div>
      <div className="exp-review-list">{ordem.paletes?.map((item) => <div key={item.id}><span>Palete #{item.id} · {productName(item.produto)} <Status value={item.status_carregamento} /></span><strong>{kg(item.peso_total)}</strong></div>)}</div>
    </div>}
  </Modal>
}

function PalletDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof expedicaoApi.palete>> | null>(null)
  useEffect(() => { expedicaoApi.palete(id).then(setData) }, [id])
  return <Modal title={`Palete #${id}`} onClose={onClose} wide>
    {!data ? <Loading text="Carregando palete..." /> : <>
      <div className="exp-review-grid"><Review label="Produto" value={productName(data.produto)} /><Review label="Peso total" value={kg(data.peso_total)} /><Review label="Caixas" value={integer(data.caixas)} /><Review label="Etiqueta" value={statusLabel(data.etiqueta_status)} /></div>
      <h3 className="exp-subtitle">Lotes no palete</h3>
      <div className="exp-review-list">{data.lotes.map((item) => <div key={`${item.codigo_ordem}-${item.lote}`}><span>{item.lote} · OP {item.codigo_ordem} · {integer(item.caixas)} caixas</span><strong>{kg(item.peso_total)}</strong></div>)}</div>
      <h3 className="exp-subtitle">Caixas</h3>
      <div className="exp-mini-table">{data.caixas.map((item) => <div key={item.id}><span>#{item.sequencia}</span><span>{item.codigo_barra}</span><span>Lote {item.lote}</span><strong>{kg(item.peso)}</strong></div>)}</div>
    </>}
  </Modal>
}

function Relatorios() {
  const [filters, setFilters] = useState({ inicio: '', fim: '', status: '' })
  const [items, setItems] = useState<RelatorioItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await expedicaoApi.relatorio(filters)).itens) } finally { setLoading(false) }
  }, [filters])
  useEffect(() => { void load() }, [load])

  return (
    <>
      <PageHeader title="Relatórios de expedição" subtitle="Ordens, produtos, pesos e rastreabilidade dos paletes." action={<div className="exp-header-actions">
        <button className="exp-button" onClick={() => void expedicaoApi.exportar('xlsx', filters)}><FileSpreadsheet size={16} /> Excel</button>
        <button className="exp-button primary" onClick={() => void expedicaoApi.exportar('pdf', filters)}><Download size={16} /> PDF</button>
      </div>} />
      <section className="exp-toolbar"><input type="date" value={filters.inicio} onChange={(e) => setFilters({ ...filters, inicio: e.target.value })} /><input type="date" value={filters.fim} onChange={(e) => setFilters({ ...filters, fim: e.target.value })} /><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Todos os status</option><option value="rascunho">Rascunho</option><option value="lancada">Lançada</option><option value="carregando">Carregando</option><option value="concluida">Concluída</option></select><span className="exp-toolbar-count">{items.length} linha(s)</span></section>
      <section className="exp-panel exp-table-panel">{loading ? <Loading text="Carregando relatório..." /> : <div className="exp-table-wrap"><table className="exp-table"><thead><tr><th>Ordem</th><th>Cliente</th><th>Produto</th><th>Palete</th><th>Caixas</th><th>Peso</th><th>Operador</th><th>QR Code</th><th>Status</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.ordem}-${item.palete}-${index}`}><td><strong>{item.ordem}</strong></td><td>{item.cliente}</td><td>{productName(item.produto)}</td><td>{item.palete ? `#${item.palete}` : '-'}</td><td>{integer(item.caixas)}</td><td>{kg(item.peso_total)}</td><td>{item.operador_conferencia || '-'}</td><td className="exp-token">{item.qr_code || '-'}</td><td><Status value={item.status} /></td></tr>)}</tbody></table>{items.length === 0 ? <Empty text="Nenhum registro no período." /> : null}</div>}</section>
    </>
  )
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <header className="exp-page-head"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>
}
function PanelHeader({ title, count }: { title: string; count: string }) { return <header className="exp-panel-head"><h2>{title}</h2><span>{count}</span></header> }
function Kpi({ label, value }: { label: string; value: string }) { return <article className="exp-kpi"><span>{label}</span><strong>{value}</strong></article> }
function Empty({ text }: { text: string }) { return <div className="exp-empty"><PackageCheck size={18} /><span>{text}</span></div> }
function Loading({ text }: { text: string }) { return <div className="exp-loading"><span />{text}</div> }
function Status({ value }: { value: string }) { return <span className={`exp-status is-${value}`}>{statusLabel(value)}</span> }
function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) { return <button className="exp-icon-button" type="button" title={label} aria-label={label} onClick={onClick}>{children}</button> }
function IssueOrderButton({ onIssue, onComplete }: { onIssue: () => Promise<boolean>; onComplete: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'animate'>('idle')
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  async function issue() {
    if (phase !== 'idle') return
    setPhase('loading')
    const issued = await onIssue()
    if (!issued) {
      setPhase('idle')
      return
    }
    setPhase('animate')
    timer.current = window.setTimeout(onComplete, 3800)
  }

  return (
    <button className={`exp-issue-order ${phase === 'animate' ? 'animate' : ''}`} type="button" disabled={phase !== 'idle'} onClick={() => void issue()} aria-label="Emitir ordem">
      <span className="default">{phase === 'loading' ? 'Emitindo…' : 'Emitir ordem'}</span>
      <span className="success">Ordem emitida <svg viewBox="0 0 12 10" aria-hidden="true"><polyline points="1.5 6 4.5 9 10.5 1" /></svg></span>
      <span className="box" aria-hidden="true" />
      <span className="truck" aria-hidden="true"><span className="back" /><span className="front"><span className="window" /></span><span className="light top" /><span className="light bottom" /></span>
      <span className="lines" aria-hidden="true" />
    </button>
  )
}
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) { return <label className="exp-field"><span>{label}{required ? ' *' : ''}</span>{children}</label> }
function Review({ label, value }: { label: string; value: string }) { return <div className="exp-review-item"><span>{label}</span><strong>{value}</strong></div> }
function OrderRow({ ordem }: { ordem: OrdemExpedicao }) { return <article className="exp-order-row"><div><strong>{ordem.codigo}</strong><span>{ordem.cliente} · {ordem.destino}</span></div><div><Status value={ordem.status} /><strong>{kg(ordem.peso_total)}</strong></div></article> }
function Modal({ title, onClose, children, wide = false, builder = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; builder?: boolean }) { return <div className="exp-modal-backdrop" role="presentation"><section className={`exp-modal ${wide ? 'wide' : ''} ${builder ? 'is-builder' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><IconButton label="Fechar" onClick={onClose}><X size={18} /></IconButton></header><div className="exp-modal-body">{children}</div></section></div> }

function viewFromHash(): View {
  const path = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (path.includes('/estoque')) return 'estoque'
  if (path.includes('/ordens')) return 'ordens'
  if (path.includes('/relatorios')) return 'relatorios'
  return 'resumo'
}
function navigate(view: View) { window.location.hash = view === 'resumo' ? '#/expedicao' : `#/expedicao/${view}` }
function integer(value: number) { return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }
function kg(value: number) { return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg` }
function date(value?: string | null) { if (!value) return '-'; const plain = value.slice(0, 10).split('-'); return plain.length === 3 ? `${plain[2]}/${plain[1]}/${plain[0]}` : value }
function productName(value: string) { return value ? value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-' }
function statusLabel(value: string) { return ({ rascunho: 'Rascunho', lancada: 'Lançada', carregando: 'Carregando', concluida: 'Concluída', cancelada: 'Cancelada', reservado: 'Reservado', carregado: 'Carregado', disponível: 'Disponível', pendente: 'Pendente', impressa: 'Impressa', erro: 'Erro' } as Record<string, string>)[value] ?? value }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }
