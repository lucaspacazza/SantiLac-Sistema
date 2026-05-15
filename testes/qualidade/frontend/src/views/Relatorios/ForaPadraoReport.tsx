import { AlertTriangle } from 'lucide-react'
import type { GrupoForaPadrao } from '../../api/relatoriosApi'
import { ExportFormatMenu, type ExportFormat } from '../../shared/ExportFormatMenu'
import { formatDecimal, formatNumber } from '../../shared/formatters'

type ForaPadraoReportProps = {
  grupos: GrupoForaPadrao[]
  exportingTarget: string | null
  onExport: (format: ExportFormat) => void
  onOpenGrupo: (codigo: string) => void
}

export function ForaPadraoReport({ grupos, exportingTarget, onExport, onOpenGrupo }: ForaPadraoReportProps) {
  if (grupos.length === 0) {
    return <section className="empty-state">Nenhum produtor fora do padrão neste período.</section>
  }

  return (
    <section className="deviation-menu">
      <div className="deviation-menu-head">
        <div className="deviation-title">
          <span className="panel-icon"><AlertTriangle size={17} /></span>
          <div>
            <span className="eyebrow">Fora do padrão</span>
            <h2>Escolha o indicador</h2>
          </div>
        </div>

        <ExportFormatMenu
          isExporting={exportingTarget === 'fora-geral-excel' || exportingTarget === 'fora-geral-pdf'}
          disabled={exportingTarget !== null}
          onExport={onExport}
        />
      </div>

      <div className="deviation-options">
        {grupos.map((grupo) => (
          <button className="deviation-option" type="button" key={grupo.codigo} onClick={() => onOpenGrupo(grupo.codigo)}>
            <span>
              <strong>{grupo.label}</strong>
              <small>
                Média: {formatIssueValue(grupo.media, grupo.pior?.unidade ?? null)}
                {' · '}
                Pior: {grupo.pior ? `${grupo.pior.codigo} - ${formatIssueValue(grupo.pior.valor, grupo.pior.unidade)}` : '--'}
              </small>
            </span>
            <em>{formatNumber(grupo.total)}</em>
          </button>
        ))}
      </div>
    </section>
  )
}

function formatIssueValue(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) return '--'
  return `${formatDecimal(value)}${unit ? ` ${unit}` : ''}`
}
