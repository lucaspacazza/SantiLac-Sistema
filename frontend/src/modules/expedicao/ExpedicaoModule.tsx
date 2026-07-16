import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  Truck,
  UserRound,
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
type ExpedicaoRoute = { view: View; orderId: number | null }
type ResumoData = Awaited<ReturnType<typeof expedicaoApi.resumo>>

const OPEN_ORDER_STATUSES = ['rascunho', 'lancada', 'carregando'] as const

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
  const [route, setRoute] = useState<ExpedicaoRoute>(() => routeFromHash())

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <section className="exp-page">
      {route.view === 'resumo' ? <Resumo /> : null}
      {route.view === 'estoque' ? <Estoque /> : null}
      {route.view === 'ordens' && route.orderId === null ? <Ordens /> : null}
      {route.view === 'ordens' && route.orderId !== null ? <OrderDetailPage id={route.orderId} /> : null}
      {route.view === 'relatorios' ? <Relatorios /> : null}
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
  const [busca, setBusca] = useState('')
  const [editor, setEditor] = useState<number | 'new' | null>(null)
  const [cancelTarget, setCancelTarget] = useState<OrdemExpedicao | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await expedicaoApi.ordens({ busca })
      setOrdens(result.itens)
    } catch (err) {
      setFeedback(message(err))
    } finally {
      setLoading(false)
    }
  }, [busca])

  useEffect(() => { void load() }, [load])

  const ordensAbertas = useMemo(
    () => ordens.filter((ordem) => OPEN_ORDER_STATUSES.includes(ordem.status as (typeof OPEN_ORDER_STATUSES)[number])),
    [ordens],
  )
  const ordensHistorico = useMemo(
    () => ordens.filter((ordem) => !OPEN_ORDER_STATUSES.includes(ordem.status as (typeof OPEN_ORDER_STATUSES)[number])),
    [ordens],
  )

  async function action(ordem: OrdemExpedicao, type: 'lancar' | 'cancelar', reload = true): Promise<boolean> {
    try {
      type === 'lancar' ? await expedicaoApi.lancar(ordem.id) : await expedicaoApi.cancelar(ordem.id)
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
        {feedback ? <span className="exp-feedback">{feedback}</span> : null}
      </section>
      <div className="exp-order-kpis" aria-label="Resumo das ordens">
        <Kpi label="Abertas" value={integer(ordensAbertas.length)} />
        <Kpi label="Rascunhos" value={integer(ordensAbertas.filter((item) => item.status === 'rascunho').length)} />
        <Kpi label="Em carregamento" value={integer(ordensAbertas.filter((item) => item.status === 'carregando').length)} />
        <Kpi label="Concluídas" value={integer(ordensHistorico.filter((item) => item.status === 'concluida').length)} />
      </div>

      {loading ? <Loading text="Carregando ordens..." /> : <>
        <OrderSection
          title="Ordens abertas"
          subtitle="Cargas que ainda exigem preparação, emissão ou acompanhamento."
          ordens={ordensAbertas}
          empty="Nenhuma ordem aberta."
          onEdit={setEditor}
          onIssue={(ordem) => action(ordem, 'lancar', false)}
          onCancel={setCancelTarget}
          onReload={() => void load()}
        />
        <OrderSection
          title="Histórico"
          subtitle="Ordens concluídas e canceladas preservadas para consulta."
          ordens={ordensHistorico}
          empty="Nenhuma ordem no histórico."
        />
      </>}
      {editor ? <OrderEditor id={editor === 'new' ? null : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void load() }} /> : null}
      {cancelTarget ? <CancellationDialog
        ordem={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => action(cancelTarget, 'cancelar')}
      /> : null}
    </>
  )
}

function OrderSection({
  title,
  subtitle,
  ordens,
  empty,
  onEdit,
  onIssue,
  onCancel,
  onReload,
}: {
  title: string
  subtitle: string
  ordens: OrdemExpedicao[]
  empty: string
  onEdit?: (id: number) => void
  onIssue?: (ordem: OrdemExpedicao) => Promise<boolean>
  onCancel?: (ordem: OrdemExpedicao) => void
  onReload?: () => void
}) {
  return <section className="exp-order-section">
    <header className="exp-order-section-head">
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <span>{ordens.length} ordem(ns)</span>
    </header>
    <div className="exp-order-cards">
      {ordens.map((ordem) => <article className="exp-order-card" key={ordem.id}>
        <button className="exp-order-card-main" type="button" onClick={() => navigateOrder(ordem.id)} aria-label={`Abrir ${ordem.codigo}`}>
          <span className="exp-order-code"><strong>{ordem.codigo}</strong><Status value={ordem.status} /></span>
          <span><small>Cliente</small><strong>{ordem.cliente}</strong></span>
          <span><small>Destino</small><strong>{ordem.destino}</strong></span>
          <span><small>Previsão</small><strong>{date(ordem.data_prevista)}</strong></span>
          <span><small>Carga</small><strong>{integer(ordem.paletes_total)} palete(s) · {kg(ordem.peso_total)}</strong></span>
          <ChevronRight className="exp-order-arrow" size={18} />
        </button>
        {onEdit || onIssue || onCancel ? <div className="exp-order-card-actions">
          {ordem.status === 'rascunho' && onEdit ? <button className="exp-button subtle" type="button" onClick={() => onEdit(ordem.id)}><ClipboardCheck size={15} /> Editar</button> : null}
          {ordem.status === 'rascunho' && onIssue && onReload ? <IssueOrderButton onIssue={() => onIssue(ordem)} onComplete={onReload} /> : null}
          {OPEN_ORDER_STATUSES.includes(ordem.status as (typeof OPEN_ORDER_STATUSES)[number]) && onCancel ? <button className="exp-button danger" type="button" onClick={() => onCancel(ordem)}><Ban size={15} /> Cancelar</button> : null}
        </div> : null}
      </article>)}
      {ordens.length === 0 ? <Empty text={empty} /> : null}
    </div>
  </section>
}

function CancellationDialog({ ordem, onClose, onConfirm }: {
  ordem: OrdemExpedicao
  onClose: () => void
  onConfirm: () => Promise<boolean>
}) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  async function confirmCancellation() {
    if (busy) return
    setBusy(true)
    const success = await onConfirm()
    setBusy(false)
    if (success) onClose()
  }

  const loadingWarning = ordem.status === 'carregando'

  return <div
    className="exp-confirm-backdrop"
    role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}
  >
    <section className="exp-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="exp-cancel-title" aria-describedby="exp-cancel-description">
      <div className="exp-confirm-icon"><Ban size={20} /></div>
      <h2 id="exp-cancel-title">{loadingWarning ? 'Cancelar carregamento?' : 'Cancelar ordem?'}</h2>
      <p id="exp-cancel-description">
        {loadingWarning
          ? 'O carregamento em andamento será interrompido e os paletes voltarão para o estoque.'
          : 'Os paletes reservados voltarão para o estoque.'}
        {' '}A ordem continuará disponível no histórico para consulta.
      </p>
      <div className="exp-confirm-actions">
        <button className="exp-button subtle" type="button" disabled={busy} onClick={onClose} autoFocus>Não</button>
        <button className="exp-button danger" type="button" disabled={busy} onClick={() => void confirmCancellation()}>
          {busy ? 'Cancelando...' : 'Sim'}
        </button>
      </div>
    </section>
  </div>
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

function OrderDetailPage({ id }: { id: number }) {
  const [ordem, setOrdem] = useState<OrdemExpedicao | null>(null)
  const [editor, setEditor] = useState(false)
  const [cancelDialog, setCancelDialog] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOrdem(await expedicaoApi.ordem(id))
      setFeedback('')
    } catch (err) {
      setFeedback(message(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function issue() {
    try {
      await expedicaoApi.lancar(id)
      setFeedback('Ordem lançada para a embalagem.')
      await load()
      return true
    } catch (err) {
      setFeedback(message(err))
      return false
    }
  }

  async function cancel(): Promise<boolean> {
    if (!ordem) return false
    try {
      await expedicaoApi.cancelar(id)
      setFeedback('Ordem cancelada e preservada no histórico.')
      await load()
      return true
    } catch (err) {
      setFeedback(message(err))
      return false
    }
  }

  if (loading && !ordem) return <Loading text={feedback || 'Carregando ordem...'} />
  if (!ordem) return <div className="exp-detail-error"><Empty text={feedback || 'Ordem não encontrada.'} /><button className="exp-button" onClick={() => navigate('ordens')}><ArrowLeft size={16} /> Voltar</button></div>

  const paletes = ordem.paletes ?? []
  const carregados = paletes.filter((item) => item.status_carregamento === 'carregado').length
  const progresso = paletes.length > 0 ? Math.round((carregados / paletes.length) * 100) : 0
  const timeline = [
    { label: 'Ordem criada', at: ordem.criada_em, operator: ordem.operadores?.criado_por },
    { label: 'Ordem lançada', at: ordem.lancada_em, operator: ordem.operadores?.lancado_por },
    { label: 'Carregamento iniciado', at: ordem.iniciada_em, operator: ordem.operadores?.iniciado_por },
    { label: 'Carregamento concluído', at: ordem.concluida_em, operator: ordem.operadores?.concluido_por },
    { label: 'Ordem cancelada', at: ordem.cancelada_em, operator: ordem.operadores?.cancelado_por },
  ].filter((item) => item.at)

  return <>
    <header className="exp-detail-header">
      <button className="exp-button subtle" type="button" onClick={() => navigate('ordens')}><ArrowLeft size={16} /> Ordens</button>
      <div className="exp-detail-title">
        <span>Ordem de expedição</span>
        <div><h1>{ordem.codigo}</h1><Status value={ordem.status} /></div>
        <p>{ordem.cliente} · {ordem.destino}</p>
      </div>
      <div className="exp-detail-actions">
        {ordem.status === 'rascunho' ? <button className="exp-button" type="button" onClick={() => setEditor(true)}><ClipboardCheck size={16} /> Editar</button> : null}
        {ordem.status === 'rascunho' ? <IssueOrderButton onIssue={issue} onComplete={() => void load()} /> : null}
        {OPEN_ORDER_STATUSES.includes(ordem.status as (typeof OPEN_ORDER_STATUSES)[number]) ? <button className="exp-button danger" type="button" onClick={() => setCancelDialog(true)}><Ban size={16} /> Cancelar ordem</button> : null}
      </div>
    </header>

    {feedback ? <div className="exp-detail-feedback" role="status">{feedback}</div> : null}

    <div className="exp-detail-layout">
      <main className="exp-detail-main">
        <section className="exp-panel exp-detail-summary">
          <PanelHeader title="Resumo da carga" count={statusLabel(ordem.status)} />
          <div className="exp-detail-kpis">
            <Kpi label="Paletes" value={integer(ordem.paletes_total)} />
            <Kpi label="Caixas" value={integer(ordem.caixas_total)} />
            <Kpi label="Peso total" value={kg(ordem.peso_total)} />
            <Kpi label="Conferidos" value={`${integer(carregados)}/${integer(ordem.paletes_total)}`} />
          </div>
          {ordem.status === 'carregando' || ordem.status === 'concluida' ? <div className="exp-progress-block">
            <div><span>Progresso do carregamento</span><strong>{progresso}%</strong></div>
            <div className="exp-progress-track"><span style={{ width: `${progresso}%` }} /></div>
          </div> : null}
        </section>

        <section className="exp-panel">
          <PanelHeader title="Produtos da carga" count={`${ordem.produtos?.length ?? 0} produto(s)`} />
          <div className="exp-product-list">
            {ordem.produtos?.map((produto) => <article className="exp-product-row" key={produto.produto}>
              <div><strong>{productName(produto.produto)}</strong><span>{integer(produto.carregados)} de {integer(produto.paletes)} conferido(s)</span></div>
              <div><strong>{kg(produto.peso_total)}</strong><span>{integer(produto.paletes)} palete(s)</span></div>
            </article>)}
            {!ordem.produtos?.length ? <Empty text="Nenhum produto registrado nesta ordem." /> : null}
          </div>
        </section>

        <section className="exp-panel exp-table-panel">
          <PanelHeader title="Paletes da ordem" count={`${paletes.length} palete(s)`} />
          <div className="exp-table-wrap">
            <table className="exp-table exp-pallet-detail-table">
              <thead><tr><th>Palete</th><th>Produto</th><th>Lote</th><th>Caixas</th><th>Peso</th><th>Conferência</th><th>Operador</th></tr></thead>
              <tbody>{paletes.map((palete) => <tr key={palete.id}>
                <td><strong>#{palete.numero || palete.id}</strong></td>
                <td>{productName(palete.produto)}</td>
                <td>{palete.lote || '-'}</td>
                <td>{integer(palete.caixas)}</td>
                <td>{kg(palete.peso_total)}</td>
                <td><Status value={palete.status_carregamento} />{palete.escaneado_em ? <small>{dateTime(palete.escaneado_em)}</small> : null}</td>
                <td>{palete.operador_conferencia || '-'}</td>
              </tr>)}</tbody>
            </table>
            {paletes.length === 0 ? <Empty text={ordem.status === 'cancelada' ? 'Esta ordem foi cancelada antes da preservação detalhada dos paletes.' : 'Nenhum palete registrado nesta ordem.'} /> : null}
          </div>
        </section>
      </main>

      <aside className="exp-detail-aside">
        <section className="exp-panel exp-info-panel">
          <PanelHeader title="Dados de entrega" />
          <InfoLine icon={<UserRound size={17} />} label="Cliente" value={ordem.cliente} />
          <InfoLine icon={<MapPin size={17} />} label="Destino" value={ordem.destino} />
          <InfoLine icon={<CalendarDays size={17} />} label="Data prevista" value={date(ordem.data_prevista)} />
          <InfoLine icon={<Truck size={17} />} label="Motorista" value={ordem.motorista || '-'} />
          <InfoLine icon={<Truck size={17} />} label="Placa" value={ordem.placa || '-'} />
          {ordem.observacoes ? <div className="exp-observations"><span>Observações</span><p>{ordem.observacoes}</p></div> : null}
        </section>

        <section className="exp-panel exp-timeline-panel">
          <PanelHeader title="Histórico da ordem" />
          <div className="exp-timeline">
            {timeline.map((item) => <div className="exp-timeline-item" key={item.label}>
              <span className="exp-timeline-dot"><Clock3 size={14} /></span>
              <div><strong>{item.label}</strong><span>{dateTime(item.at)}</span>{item.operator ? <small>{item.operator}</small> : null}</div>
            </div>)}
          </div>
        </section>
      </aside>
    </div>
    {editor ? <OrderEditor id={id} onClose={() => setEditor(false)} onSaved={() => { setEditor(false); void load() }} /> : null}
    {cancelDialog ? <CancellationDialog ordem={ordem} onClose={() => setCancelDialog(false)} onConfirm={cancel} /> : null}
  </>
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
function PanelHeader({ title, count }: { title: string; count?: string }) { return <header className="exp-panel-head"><h2>{title}</h2>{count ? <span>{count}</span> : null}</header> }
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
function InfoLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="exp-info-line"><span className="exp-info-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div> }
function OrderRow({ ordem }: { ordem: OrdemExpedicao }) { return <article className="exp-order-row"><div><strong>{ordem.codigo}</strong><span>{ordem.cliente} · {ordem.destino}</span></div><div><Status value={ordem.status} /><strong>{kg(ordem.peso_total)}</strong></div></article> }
function Modal({ title, onClose, children, wide = false, builder = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; builder?: boolean }) { return <div className="exp-modal-backdrop" role="presentation"><section className={`exp-modal ${wide ? 'wide' : ''} ${builder ? 'is-builder' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><IconButton label="Fechar" onClick={onClose}><X size={18} /></IconButton></header><div className="exp-modal-body">{children}</div></section></div> }

function routeFromHash(): ExpedicaoRoute {
  const path = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const orderMatch = path.match(/^expedicao\/ordens\/(\d+)$/)
  if (orderMatch) return { view: 'ordens', orderId: Number(orderMatch[1]) }
  if (path.includes('/estoque')) return { view: 'estoque', orderId: null }
  if (path.includes('/ordens')) return { view: 'ordens', orderId: null }
  if (path.includes('/relatorios')) return { view: 'relatorios', orderId: null }
  return { view: 'resumo', orderId: null }
}
function navigate(view: View) { window.location.hash = view === 'resumo' ? '#/expedicao' : `#/expedicao/${view}` }
function navigateOrder(id: number) { window.location.hash = `#/expedicao/ordens/${id}` }
function integer(value: number) { return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }
function kg(value: number) { return `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg` }
function date(value?: string | null) { if (!value) return '-'; const plain = value.slice(0, 10).split('-'); return plain.length === 3 ? `${plain[2]}/${plain[1]}/${plain[0]}` : value }
function dateTime(value?: string | null) { if (!value) return '-'; const parsed = new Date(value.replace(' ', 'T')); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }
function productName(value: string) { return value ? value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '-' }
function statusLabel(value: string) { return ({ rascunho: 'Rascunho', lancada: 'Lançada', carregando: 'Carregando', concluida: 'Concluída', cancelada: 'Cancelada', reservado: 'Reservado', carregado: 'Carregado', disponível: 'Disponível', pendente: 'Pendente', impressa: 'Impressa', erro: 'Erro' } as Record<string, string>)[value] ?? value }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }
