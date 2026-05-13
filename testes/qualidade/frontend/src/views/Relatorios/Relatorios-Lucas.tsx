import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Users,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { relatoriosApi, type GrupoForaPadrao, type ProdutorRelatorio, type RelatoriosResumo } from '../../api/relatoriosApi'
import { formatDate, formatDecimal, formatNumber } from '../../shared/formatters'

type RelatoriosProps = {
  reloadKey: number
  onOpenProdutor: (codigo: string) => void
  onOpenPendencias: (codigo: string) => void
}

type LoadStatus = 'loading' | 'live' | 'error'
type Tab = 'resumo' | 'fora'

export function Relatorios({ reloadKey, onOpenProdutor, onOpenPendencias }: RelatoriosProps) {
  const [report, setReport] = useState<RelatoriosResumo | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando relatórios...')
  const [activeTab, setActiveTab] = useState<Tab>('resumo')

  async function loadReport() {
    setStatus('loading')
    setStatusText('Carregando relatórios...')

    try {
      const data = await relatoriosApi.resumo()
      setReport(data)
      setStatus('live')
      setStatusText(`Relatório de ${data.periodo.label} carregado com ${formatNumber(data.totais.analises)} análise(s).`)
    } catch {
      setReport(null)
      setStatus('error')
      setStatusText('Não foi possível carregar os relatórios.')
    }
  }

  useEffect(() => {
    void loadReport()
  }, [reloadKey])

  return (
    <>
      <section className={`status-line is-${status}`}>
        <span className="status-dot" />
        <span>{statusText}</span>
      </section>

      {!report ? (
        <section className="empty-state">Aguardando dados dos relatórios.</section>
      ) : (
        <section className="reports-page">
          <section className="reports-toolbar">
            <div className="segmented-control" aria-label="Tipos de relatório">
              <TabButton active={activeTab === 'resumo'} onClick={() => setActiveTab('resumo')}>Resumo</TabButton>
              <TabButton active={activeTab === 'fora'} onClick={() => setActiveTab('fora')}>Fora do padrão</TabButton>
            </div>

            <button className="btn secondary" type="button" disabled>
              <Download size={16} />
              Exportar depois
            </button>
          </section>

          {activeTab === 'resumo' && (
            <ResumoReport report={report} onOpenPendencias={onOpenPendencias} />
          )}

          {activeTab === 'fora' && (
            <ForaPadraoReport grupos={report.fora_padrao} onOpenProdutor={onOpenProdutor} />
          )}

        </section>
      )}
    </>
  )
}

function ResumoReport({ report, onOpenPendencias }: { report: RelatoriosResumo; onOpenPendencias: (codigo: string) => void }) {
  const principal = report.ranking_atencao.slice(0, 8)

  return (
    <div className="reports-grid">
      <section className="report-kpis">
        <ReportCard icon={<Users size={17} />} label="Produtores ativos" value={formatNumber(report.totais.ativos)} detail={`${formatNumber(report.totais.inativos)} inativo(s)`} />
        <ReportCard icon={<Database size={17} />} label="Análises no período" value={formatNumber(report.totais.analises)} detail={report.periodo.label} />
        <ReportCard icon={<CheckCircle2 size={17} />} label="Dentro do padrão" value={`${formatDecimal(report.totais.percentual_dentro)}%`} detail={`${formatNumber(report.totais.dentro_padrao)} de ${formatNumber(report.totais.produtores_com_analise)} analisado(s)`} tone="good" />
        <ReportCard icon={<AlertTriangle size={17} />} label="Fora do padrão" value={`${formatDecimal(report.totais.percentual_fora)}%`} detail={`${formatNumber(report.totais.fora_padrao)} de ${formatNumber(report.totais.produtores_com_analise)} analisado(s)`} tone="bad" />
        <ReportCard icon={<FileSpreadsheet size={17} />} label="Última análise" value={formatDate(report.ultima_analise)} detail="Data da coleta" />
      </section>

      <section className="report-panel report-wide">
        <PanelHeading eyebrow="Atenção" title="Produtores com mais pendências" />
        <CompactProducerTable produtores={principal} emptyText="Nenhum produtor fora do padrão neste período." onOpenProdutor={onOpenPendencias} />
      </section>
    </div>
  )
}

function ForaPadraoReport({ grupos, onOpenProdutor }: { grupos: GrupoForaPadrao[]; onOpenProdutor: (codigo: string) => void }) {
  if (grupos.length === 0) {
    return <section className="empty-state">Nenhum produtor fora do padrão neste período.</section>
  }

  return (
    <div className="report-groups">
      {grupos.map((grupo) => (
        <section className="report-panel" key={grupo.codigo}>
          <div className="issue-group-head">
            <div>
              <span className="eyebrow">Desvio</span>
              <h2>{grupo.label}</h2>
            </div>
            <strong>{formatNumber(grupo.total)}</strong>
          </div>
          <div className="issue-group-meta">
            <span>Média: {formatIssueValue(grupo.media, grupo.pior?.unidade ?? null)}</span>
            <span>Pior: {grupo.pior ? `${grupo.pior.codigo} · ${formatIssueValue(grupo.pior.valor, grupo.pior.unidade)}` : '--'}</span>
          </div>
          <div className="issue-producer-list">
            {grupo.items.map((item) => (
              <button className="issue-producer" type="button" key={`${grupo.codigo}-${item.codigo}`} onClick={() => onOpenProdutor(item.codigo)}>
                <span>
                  <strong>{item.codigo}</strong>
                  {item.nome}
                </span>
                <em>{formatIssueValue(item.valor, item.unidade)}</em>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function CompactProducerTable({ produtores, emptyText, onOpenProdutor }: { produtores: ProdutorRelatorio[]; emptyText: string; onOpenProdutor: (codigo: string) => void }) {
  if (produtores.length === 0) {
    return <span className="empty-copy">{emptyText}</span>
  }

  return (
    <div className="attention-table">
      <div className="attention-table-head">
        <span>Código</span>
        <span>Produtor</span>
        <span>Pendências</span>
      </div>
      {produtores.map((produtor) => (
        <button className="attention-row" type="button" key={produtor.codigo} onClick={() => onOpenProdutor(produtor.codigo)}>
          <span>{produtor.codigo}</span>
          <strong>{produtor.nome}</strong>
          <em>{formatNumber(produtor.total_pendencias)}</em>
        </button>
      ))}
    </div>
  )
}


function ReportCard({ icon, label, value, detail, tone = 'neutral' }: { icon: ReactNode; label: string; value: string; detail: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  return (
    <article className={`report-card is-${tone}`}>
      <span className="panel-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-title compact">
      <span className="panel-icon"><BarChart3 size={17} /></span>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={active ? 'is-active' : ''} type="button" onClick={onClick}>
      {children}
    </button>
  )
}

function formatIssueValue(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) return '--'
  return `${formatDecimal(value)}${unit ? ` ${unit}` : ''}`
}
