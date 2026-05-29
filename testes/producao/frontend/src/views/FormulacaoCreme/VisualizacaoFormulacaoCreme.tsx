import { Pencil } from 'lucide-react'
import type { ExportFormat, FormulacaoCreme } from '../../api/producaoApi'
import { ExportFormatMenu } from '../../shared/ExportFormatMenu'
import { formatDate, formatNumber } from '../../shared/formatters'

export function VisualizacaoFormulacaoCreme({
  item,
  onEdit,
  onExport,
}: {
  item: FormulacaoCreme
  onEdit: () => void
  onExport: (format: ExportFormat) => void
}) {
  return (
    <section className="document-view">
      <div className="document-actions">
        {item.status !== 'finalizada' && <button className="btn secondary" type="button" onClick={onEdit}><Pencil size={16} />Editar</button>}
        <ExportFormatMenu onExport={onExport} />
      </div>
      <article className="document-sheet">
        <header className="document-header"><div><h2>Controle de formulação creme</h2><span>{formatDate(item.data_fabricacao)}</span></div></header>
        <section className="document-section">
          <h3>Registro</h3>
          <div className="document-grid">
            <Field label="Responsável pelo monitoramento" value={item.responsavel_monitoramento} />
            <Field label="Mês" value={item.mes} />
            <Field label="Ano" value={item.ano} />
            <Field label="Tipo de creme" value={item.tipo_creme} />
            <Field label="Lote do creme produzido" value={item.lote_creme_produzido} />
            <Field label="Gordura inicial" value={formatNumber(item.gordura_inicial, ' %')} />
            <Field label="Gordura final" value={formatNumber(item.gordura_final, ' %')} />
            <Field label="Acidez" value={formatNumber(item.acidez, ' °D')} />
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
