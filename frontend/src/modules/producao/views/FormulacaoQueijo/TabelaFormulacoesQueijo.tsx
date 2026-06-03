import { CheckCircle2, XCircle } from 'lucide-react'
import type { FormulacaoQueijo } from '../../api/producaoApi'
import { formatDate, formatNumber } from '../../shared/formatters'

export function TabelaFormulacoesQueijo({
  items,
  emptyText,
  onOpenItem,
  onFinalize,
  onCancel,
}: {
  items: FormulacaoQueijo[]
  emptyText: string
  onOpenItem: (item: FormulacaoQueijo) => void
  onFinalize: (id: number) => void
  onCancel: (id: number) => void
}) {
  return (
    <div className="table table-compact-6">
      <div className="table-head table-head-actions"><span>Código</span><span>Data</span><span>Queijo</span><span>Lote</span><span>Leite</span><span>Ação</span></div>
      {items.map((item) => {
        const isOpen = item.status === 'rascunho'

        return (
          <div
            className={`table-row table-row-actions row-button ${!isOpen ? 'is-locked' : ''}`}
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenItem(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onOpenItem(item)
            }}
          >
            <strong>{item.codigo_formulacao}</strong>
            <span>{formatDate(item.data_formulacao)}</span>
            <strong>{item.tipo_queijo}</strong>
            <span>{item.lote_queijo}</span>
            <span>{formatNumber(item.quantidade_leite, ' L')}</span>
            {isOpen
              ? <span className="row-actions">
                  <button className="btn secondary compact" type="button" onClick={(event) => { event.stopPropagation(); onCancel(item.id) }}><XCircle size={15} />Cancelar</button>
                  <button className="btn secondary compact" type="button" onClick={(event) => { event.stopPropagation(); onFinalize(item.id) }}><CheckCircle2 size={15} />Finalizar</button>
                </span>
              : <span className="locked">{item.status === 'cancelada' ? 'Cancelada' : 'Bloqueada'}</span>}
          </div>
        )
      })}
      {items.length === 0 && <div className="empty">{emptyText}</div>}
    </div>
  )
}
