import { ArrowLeft } from 'lucide-react'
import type { GrupoForaPadrao } from '../../api/relatoriosApi'
import { ExportFormatMenu, type ExportFormat } from '../../shared/ExportFormatMenu'
import { formatDecimal, formatNumber } from '../../shared/formatters'

type DetalheDesvioReportProps = {
  grupo: GrupoForaPadrao
  exportingTarget: string | null
  onBack: () => void
  onExport: (format: ExportFormat) => void
  onOpenProdutor: (codigo: string) => void
}

export function DetalheDesvioReport({ grupo, exportingTarget, onBack, onExport, onOpenProdutor }: DetalheDesvioReportProps) {
  const excelTarget = `indicador-${grupo.codigo}-excel`
  const pdfTarget = `indicador-${grupo.codigo}-pdf`

  return (
    <section className="deviation-detail-page">
      <button className="btn secondary compact-action" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar
      </button>

      <section className="deviation-detail-head">
        <div>
          <span className="eyebrow">Indicador</span>
          <h2>{grupo.label}</h2>
        </div>

        <div className="deviation-detail-actions">
          <span>{formatNumber(grupo.total)} produtor(es)</span>
          <ExportFormatMenu
            isExporting={exportingTarget === excelTarget || exportingTarget === pdfTarget}
            disabled={exportingTarget !== null}
            onExport={onExport}
          />
        </div>
      </section>

      <section className="deviation-detail-table">
        <div className="deviation-detail-meta">
          <span>Média: {formatIssueValue(grupo.media, grupo.pior?.unidade ?? null)}</span>
          <span>Pior: {grupo.pior ? `${grupo.pior.codigo} - ${formatIssueValue(grupo.pior.valor, grupo.pior.unidade)}` : '--'}</span>
        </div>

        <div className="deviation-table-head">
          <span>Código</span>
          <span>Produtor</span>
          <span>Cidade</span>
          <span>Valor</span>
        </div>

        {grupo.items.map((item) => (
          <button className="deviation-row" type="button" key={`${grupo.codigo}-${item.codigo}`} onClick={() => onOpenProdutor(item.codigo)}>
            <span>{item.codigo}</span>
            <strong>{item.nome}</strong>
            <span>{item.cidade || '--'}</span>
            <em>{formatIssueValue(item.valor, item.unidade)}</em>
          </button>
        ))}
      </section>
    </section>
  )
}

function formatIssueValue(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) return '--'
  return `${formatDecimal(value)}${unit ? ` ${unit}` : ''}`
}
