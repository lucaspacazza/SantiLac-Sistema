import { PackageCheck, Pencil } from 'lucide-react'
import type { ExportFormat, SoroRefrigerado } from '../../api/producaoApi'
import { ExportFormatMenu } from '../../shared/ExportFormatMenu'
import { formatDate, formatNumber } from '../../shared/formatters'

export function VisualizacaoSoroRefrigerado({
  item,
  onEdit,
  onExport,
  onControlarEstoque,
}: {
  item: SoroRefrigerado
  onEdit: () => void
  onExport: (format: ExportFormat) => void
  onControlarEstoque: () => void
}) {
  return (
    <section className="document-view">
      <div className="document-actions">
        {item.status !== 'finalizada' && <button className="btn secondary" type="button" onClick={onEdit}><Pencil size={16} />Editar</button>}
        <button className="btn secondary" type="button" onClick={onControlarEstoque}><PackageCheck size={16} />Estoque</button>
        <ExportFormatMenu onExport={onExport} />
      </div>
      <article className="document-sheet">
        <header className="document-header"><div><h2>Controle de produção de soro refrigerado</h2><span>{formatDate(item.data_registro)}</span></div></header>
        <section className="document-section">
          <h3>Registro</h3>
          <div className="document-grid">
            <Field label="Entrada diária no estoque" value={formatNumber(item.entrada_diaria_estoque, ' L')} />
            <Field label="Estoque total" value={formatNumber(item.estoque_total, ' L')} />
            <Field label="Litragem vendida" value={formatNumber(item.litragem_vendida, ' L')} />
            <Field label="Sobra calculada no estoque" value={formatNumber(item.sobra_estoque, ' L')} />
            <Field label="Silo armazenado" value={item.silo_armazenado} />
            <Field label="Responsável" value={item.responsavel} />
          </div>
        </section>
        <section className="document-section"><h3>Observações</h3><p>{item.observacoes || 'Sem observações.'}</p></section>
      </article>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="document-field"><span>{label}</span><strong>{value === null || value === undefined || value === '' ? '-' : value}</strong></div>
}
