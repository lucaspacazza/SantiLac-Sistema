import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Users,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { relatoriosApi, type ExportacaoDownload, type ProdutorRelatorio, type RelatoriosResumo } from '../../api/relatoriosApi'
import { formatDate, formatDecimal, formatNumber } from '../../shared/formatters'
import { DetalheDesvioReport } from './DetalheDesvioReport'
import { ForaPadraoReport } from './ForaPadraoReport'

type RelatoriosProps = {
  reloadKey: number
  onOpenProdutor: (codigo: string) => void
  onOpenPendencias: (codigo: string) => void
}

type LoadStatus = 'loading' | 'live' | 'error'
type Tab = 'resumo' | 'fora'
type ExportFormat = 'excel' | 'pdf'
type ExportTarget = 'fora-geral-excel' | 'fora-geral-pdf' | `indicador-${string}-${ExportFormat}`

export function Relatorios({ reloadKey, onOpenProdutor, onOpenPendencias }: RelatoriosProps) {
  const [report, setReport] = useState<RelatoriosResumo | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [statusText, setStatusText] = useState('Carregando relatórios...')
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [exportMonth, setExportMonth] = useState('')
  const [exportingTarget, setExportingTarget] = useState<ExportTarget | null>(null)
  const [exportResult, setExportResult] = useState<ExportacaoDownload | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [selectedDeviationCode, setSelectedDeviationCode] = useState<string | null>(null)

  async function loadReport() {
    setStatus('loading')
    setStatusText('Carregando relatórios...')

    try {
      const data = await relatoriosApi.resumo()
      setReport(data)
      setExportMonth(toMonthYear(data.periodo.inicio.slice(0, 7)))
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

  const selectedDeviation = selectedDeviationCode
    ? report?.fora_padrao.find((grupo) => grupo.codigo === selectedDeviationCode) ?? null
    : null

  function resolveExportMonth(): string | null {
    if (!exportMonth) return null

    const normalizedMonth = monthYearToApi(exportMonth)
    if (!normalizedMonth) {
      setExportError('Informe o mês no formato MM/AAAA.')
      return null
    }

    return normalizedMonth
  }

  async function handleExportForaPadrao(format: ExportFormat) {
    const normalizedMonth = resolveExportMonth()
    if (!normalizedMonth) return

    const target: ExportTarget = format === 'pdf' ? 'fora-geral-pdf' : 'fora-geral-excel'
    setExportingTarget(target)
    setExportResult(null)
    setExportError(null)

    try {
      const result = format === 'pdf'
        ? await relatoriosApi.exportarForaPadraoPdf(normalizedMonth)
        : await relatoriosApi.exportarForaPadrao(normalizedMonth)
      setExportResult(result)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao gerar exportação.')
    } finally {
      setExportingTarget(null)
    }
  }

  async function handleExportIndicador(codigo: string, format: ExportFormat) {
    const normalizedMonth = resolveExportMonth()
    if (!normalizedMonth) return

    const target: ExportTarget = `indicador-${codigo}-${format}`
    setExportingTarget(target)
    setExportResult(null)
    setExportError(null)

    try {
      const result = format === 'pdf'
        ? await relatoriosApi.exportarIndicadorForaPadraoPdf(codigo, normalizedMonth)
        : await relatoriosApi.exportarIndicadorForaPadrao(codigo, normalizedMonth)
      setExportResult(result)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao gerar exportação.')
    } finally {
      setExportingTarget(null)
    }
  }

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
              <TabButton active={activeTab === 'resumo'} onClick={() => {
                setActiveTab('resumo')
                setSelectedDeviationCode(null)
              }}>Resumo</TabButton>
              <TabButton active={activeTab === 'fora'} onClick={() => setActiveTab('fora')}>Fora do padrão</TabButton>
            </div>

            <div className="export-control">
              <input
                aria-label="Mês de referência"
                className="month-input"
                type="text"
                inputMode="numeric"
                placeholder="MM/AAAA"
                value={exportMonth}
                onChange={(event) => setExportMonth(event.target.value)}
              />
            </div>
          </section>

          {(exportResult || exportError) && (
            <section className={`status-line ${exportError ? 'is-error' : 'is-live'}`}>
              <span className="status-dot" />
              <span>
                {exportError
                  ? exportError
                  : `Download iniciado: ${exportResult?.arquivo}`}
              </span>
            </section>
          )}

          {activeTab === 'resumo' && (
            <ResumoReport report={report} onOpenPendencias={onOpenPendencias} />
          )}

          {activeTab === 'fora' && (
            selectedDeviation ? (
              <DetalheDesvioReport
                grupo={selectedDeviation}
                exportingTarget={exportingTarget}
                onBack={() => setSelectedDeviationCode(null)}
                onExport={(format) => handleExportIndicador(selectedDeviation.codigo, format)}
                onOpenProdutor={onOpenProdutor}
              />
            ) : (
              <ForaPadraoReport
                grupos={report.fora_padrao}
                exportingTarget={exportingTarget}
                onExport={handleExportForaPadrao}
                onOpenGrupo={setSelectedDeviationCode}
              />
            )
          )}

        </section>
      )}
    </>
  )
}

function toMonthYear(value: string): string {
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

function monthYearToApi(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{4})$/)
  if (!match) return null

  const month = Number(match[1])
  if (month < 1 || month > 12) return null

  return `${match[2]}-${match[1]}`
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
