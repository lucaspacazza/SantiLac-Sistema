import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { relatoriosApi } from '../../api/relatoriosApi'
import type { Produtor } from '../../api/qualidadeApi'
import { formatAnalysisMetric, resolveMetricStatus, type AnalysisMetricField } from '../../shared/analysisMetrics'
import { ExportFormatMenu, type ExportFormat } from '../../shared/ExportFormatMenu'
import { formatDate } from '../../shared/formatters'

type DetalheProdutorProps = {
  produtor: Produtor | null
  onBack: () => void
}

export function DetalheProdutor({ produtor, onBack }: DetalheProdutorProps) {
  const analysis = produtor?.ultima_analise ?? null
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  if (!produtor) {
    return (
      <section className="detail-page">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="empty-state">Produtor não encontrado.</div>
      </section>
    )
  }

  async function handleExport(format: ExportFormat) {
    if (!produtor) return

    const defaultMonth = analysis?.data ? toMonthYear(analysis.data.slice(0, 7)) : toMonthYear(new Date().toISOString().slice(0, 7))
    const month = window.prompt('Mês de referência para exportação (MM/AAAA)', defaultMonth)
    if (month === null) return

    const normalizedMonth = monthYearToApi(month)
    if (!normalizedMonth) {
      setExportMessage(null)
      setExportError('Informe o mês no formato MM/AAAA.')
      return
    }

    setExportingFormat(format)
    setExportMessage(null)
    setExportError(null)

    try {
      const result = format === 'pdf'
        ? await relatoriosApi.exportarProdutorAnalisesPdf(produtor.codigo, normalizedMonth)
        : await relatoriosApi.exportarProdutorAnalises(produtor.codigo, normalizedMonth)
      setExportMessage(`Download iniciado: ${result.arquivo}`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Falha ao gerar exportação individual.')
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <section className="detail-page">
      <div className="detail-actions">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar para produtores
        </button>
        <ExportFormatMenu
          isExporting={exportingFormat !== null}
          onExport={handleExport}
        />
      </div>

      {(exportMessage || exportError) && (
        <section className={`status-line ${exportError ? 'is-error' : 'is-live'}`}>
          <span className="status-dot" />
          <span>{exportError ?? exportMessage}</span>
        </section>
      )}

      <article className="detail-header">
        <span className="eyebrow">Produtor</span>
        <h2>{produtor.nome}</h2>
        <p>Código {produtor.codigo} - {produtor.cidade || 'Cidade não informada'}</p>
      </article>

      <section className="detail-grid">
        <InfoCard label="Status" value={produtor.ativo ? 'Ativo' : 'Inativo'} />
        <InfoCard label="Novo cadastro" value={produtor.novo ? 'Sim' : 'Não'} />
        <InfoCard label="Última análise" value={formatDate(analysis?.data)} />
        <MetricInfoCard label="CCS" field="CCS" value={analysis?.ccs} />
        <MetricInfoCard label="UFC" field="UFC" value={analysis?.ufc} />
        <MetricInfoCard label="Gordura" field="GORD" value={analysis?.gordura} />
        <MetricInfoCard label="Proteína" field="PROT" value={analysis?.proteina} />
        <MetricInfoCard label="Lactose" field="LACT" value={analysis?.lactose} />
      </section>

      <section className="panel-list">
        <span className="eyebrow">Histórico</span>
        <h2>Análises recentes</h2>
        <p className="empty-copy">O histórico de análises entra quando o fluxo de análises for ativado.</p>
      </section>
    </section>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function MetricInfoCard({ label, field, value }: { label: string; field: AnalysisMetricField; value: number | null | undefined }) {
  const status = resolveMetricStatus(field, value)

  return (
    <article className="info-card">
      <span>{label}</span>
      <strong className={`analysis-value is-${status}`}>{formatAnalysisMetric(field, value)}</strong>
    </article>
  )
}
