import { AlertTriangle, Check, FilterX, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { relatoriosApi, type ProdutorPrioridade, type RelatoriosFiltros, type RelatoriosResumoV2 } from '../../api/relatoriosApi'
import { formatDate, formatDecimal, formatNumber } from '../../shared/formatters'

type RelatoriosProps = {
  reloadKey: number
  onOpenProdutor: (codigo: string) => void
  onOpenPendencias: (codigo: string) => void
}

type QueueFilter = 'criticos' | 'fora_padrao' | 'sem_analise'

function defaultPeriod(): RelatoriosFiltros {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1)
  return { data_inicio: isoDate(start), data_fim: isoDate(end) }
}

function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function Relatorios({ reloadKey, onOpenProdutor, onOpenPendencias }: RelatoriosProps) {
  const [draft, setDraft] = useState<RelatoriosFiltros>(defaultPeriod)
  const [filters, setFilters] = useState<RelatoriosFiltros>(defaultPeriod)
  const [report, setReport] = useState<RelatoriosResumoV2 | null>(null)
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [message, setMessage] = useState('Carregando relatórios...')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('criticos')
  const requestRef = useRef(0)

  async function loadReport(nextFilters = filters) {
    const requestId = ++requestRef.current
    setStatus('loading')
    setMessage('Atualizando visão operacional...')
    try {
      const data = await relatoriosApi.resumo(nextFilters)
      if (requestId !== requestRef.current) return
      setReport(data)
      setStatus('live')
      setMessage(`Visão atualizada em ${new Date(data.contexto.gerado_em).toLocaleString('pt-BR')}.`)
    } catch (error) {
      if (requestId !== requestRef.current) return
      setStatus('error')
      const reason = error instanceof Error ? error.message : 'Não foi possível carregar os relatórios.'
      setMessage(report ? `${reason} Os dados anteriores permanecem visíveis.` : reason)
    }
  }

  useEffect(() => { void loadReport(filters) }, [filters, reloadKey])

  const queue = report?.prioridades[queueFilter] ?? []

  return (
    <section className="reports-page reports-v2">
      <div className={`status-line is-${status}`} role="status" aria-live="polite">
        <span className="status-dot" /><span>{message}</span>
      </div>

      <form className="reports-context" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft }) }}>
        <label><span>De</span><input type="date" value={draft.data_inicio} max={draft.data_fim} onChange={(e) => setDraft({ ...draft, data_inicio: e.target.value })} /></label>
        <label><span>Até</span><input type="date" value={draft.data_fim} min={draft.data_inicio} onChange={(e) => setDraft({ ...draft, data_fim: e.target.value })} /></label>
        <label><span>Rota</span><select value={draft.rota ?? ''} onChange={(e) => setDraft({ ...draft, rota: e.target.value || undefined, cidade: undefined })}><option value="">Todas</option>{report?.opcoes.rotas.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Cidade</span><select value={draft.cidade ?? ''} onChange={(e) => setDraft({ ...draft, cidade: e.target.value || undefined })}><option value="">Todas</option>{report?.opcoes.cidades.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="reports-context-actions">
          <button className="secondary-button" type="button" onClick={() => { const clean = defaultPeriod(); setDraft(clean); setFilters(clean) }}><FilterX size={16} />Limpar</button>
          <button className="primary-button" type="submit"><RefreshCw size={16} />Aplicar</button>
        </div>
      </form>

      {status === 'loading' && !report ? <ReportSkeleton /> : report?.executivo.total_produtores === 0 ? (
        <div className="reports-empty"><FilterX size={24} /><strong>Nenhum produtor neste recorte</strong><span>Altere o período ou limpe os filtros territoriais.</span><button type="button" onClick={() => { const clean = defaultPeriod(); setDraft(clean); setFilters(clean) }}><FilterX size={16} />Limpar filtros</button></div>
      ) : report ? (
        <>
          <ExecutiveStrip report={report} />
          <IndicatorMatrix report={report} />
          <section className="report-section">
            <SectionTitle icon={<AlertTriangle size={18} />} eyebrow="Prioridade operacional" title="Quem precisa de atenção agora" />
            <div className="queue-filters" role="group" aria-label="Filtrar fila operacional">
              {(['criticos', 'fora_padrao', 'sem_analise'] as QueueFilter[]).map((item) => <button type="button" key={item} aria-pressed={queueFilter === item} className={queueFilter === item ? 'is-active' : ''} onClick={() => setQueueFilter(item)}>{queueLabel(item)} <span>{formatNumber(report.prioridades[item].length)}</span></button>)}
            </div>
            <PriorityTable items={queue} onOpen={queueFilter === 'fora_padrao' ? onOpenPendencias : onOpenProdutor} />
          </section>
        </>
      ) : <div className="reports-empty"><AlertTriangle size={24} /><strong>Relatório indisponível</strong><span>Revise os filtros ou tente atualizar novamente.</span><button type="button" onClick={() => void loadReport()}><RefreshCw size={16} />Tentar novamente</button></div>}
    </section>
  )
}

function ExecutiveStrip({ report }: { report: RelatoriosResumoV2 }) {
  const item = report.executivo
  return <section className="executive-strip" aria-label="Resumo executivo">
    <Metric label="Cobertura" value={`${formatDecimal(item.cobertura_percentual)}%`} detail={`${formatNumber(item.produtores_analisados)} de ${formatNumber(item.total_produtores)} produtores`} />
    <Metric label="Conformidade" value={`${formatDecimal(item.conformidade_percentual)}%`} detail={`${formatNumber(item.conformes)} produtores conformes`} tone="good" />
    <Metric label="Amostragem" value={formatNumber(item.total_analises)} detail={`${formatDecimal(item.media_analises_por_produtor)} por produtor analisado`} />
    <Metric label="Críticos" value={formatNumber(item.criticos)} detail="produtores com risco sanitário" tone={item.criticos > 0 ? 'bad' : 'good'} />
  </section>
}

function Metric({ label, value, detail, tone = '' }: { label: string; value: string; detail: string; tone?: string }) {
  return <div className={`executive-metric ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function IndicatorMatrix({ report }: { report: RelatoriosResumoV2 }) {
  return <section className="report-section indicator-panel"><SectionTitle icon={<Check size={18} />} eyebrow="Causas" title="Matriz de indicadores" />
    <div className="indicator-matrix" role="table" aria-label="Indicadores fora do padrão"><div className="indicator-head" role="row"><span role="columnheader">Indicador</span><span role="columnheader">Fora</span><span role="columnheader">Prevalência</span></div>{report.indicadores.map((item) => <div className="indicator-row" role="row" key={item.codigo}><strong role="rowheader">{item.label}<small>{item.unidade || 'resultado qualitativo'}</small></strong><span role="cell">{item.fora_padrao}/{item.total_avaliados}</span><span role="cell" className="prevalence-cell"><i style={{ width: `${Math.min(item.prevalencia_percentual, 100)}%` }} />{formatDecimal(item.prevalencia_percentual)}%</span></div>)}</div>
  </section>
}

function PriorityTable({ items, onOpen }: { items: ProdutorPrioridade[]; onOpen: (codigo: string) => void }) {
  if (!items.length) return <span className="empty-copy">Nenhum produtor nesta condição.</span>
  return <div className="operational-table" role="table"><div className="operational-head" role="row"><span role="columnheader">Produtor</span><span role="columnheader">Local</span><span role="columnheader">Motivo</span><span role="columnheader">Análise</span><span role="columnheader">Ação</span></div>{items.map((item) => <div className="operational-row" role="row" key={item.codigo}><strong role="rowheader">{item.nome}<small>{item.codigo}</small></strong><span role="cell">{item.rota || 'Sem rota'}<small>{item.cidade || 'Sem cidade'}</small></span><span role="cell"><b>{item.status === 'sem_analise' ? 'Sem análise' : `${item.total_desvios} desvio(s)`}</b><small>{item.indicadores_fora_padrao.join(', ') || 'Coleta pendente'}</small></span><span role="cell">{formatDate(item.data_analise)}</span><button type="button" onClick={() => onOpen(item.codigo)}>Ver produtor</button></div>)}</div>
}

function SectionTitle({ icon, eyebrow, title }: { icon: ReactNode; eyebrow: string; title: string }) { return <header className="report-section-title"><span>{icon}</span><div><small>{eyebrow}</small><h2>{title}</h2></div></header> }
function queueLabel(item: QueueFilter) { return item === 'criticos' ? 'Críticos' : item === 'fora_padrao' ? 'Fora do padrão' : 'Sem análise' }
function ReportSkeleton() { return <div className="reports-skeleton" aria-label="Carregando"><span /><span /><span /></div> }
