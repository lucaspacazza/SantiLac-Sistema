import { ArrowLeft, Pencil } from 'lucide-react'
import type { EstoqueItemDetalhe } from '../../api/estoqueApi'
import { formatDate, formatQuantity } from '../../shared/formatters'

type DetalheItemProps = {
  item: EstoqueItemDetalhe | null
  loading: boolean
  onBack: () => void
  onEdit: () => void
}

export function DetalheItem({ item, loading, onBack, onEdit }: DetalheItemProps) {
  if (loading) {
    return (
      <section className="panel detail-empty">
        <p className="empty-copy">Carregando item...</p>
      </section>
    )
  }

  if (item === null) {
    return (
      <section className="panel detail-empty">
        <p className="empty-copy">Item não encontrado.</p>
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
      </section>
    )
  }

  const details = [
    ['Categoria', item.categoria],
    ['Unidade', item.unidade],
    ['Saldo atual', formatQuantity(item.saldo_atual, item.unidade)],
    ['Estoque mínimo', formatQuantity(item.estoque_minimo, item.unidade)],
    ['Status', item.ativo ? 'Ativo' : 'Inativo'],
  ] as const

  return (
    <section className="detail-grid estoque-detail">
      <header className="detail-title">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div>
          <span>{item.codigo ?? 'Sem código'}</span>
          <h2>{item.nome}</h2>
          <p>{item.categoria} · {formatQuantity(item.saldo_atual, item.unidade)}</p>
        </div>
        <button className="btn primary detail-action" type="button" onClick={onEdit}>
          <Pencil size={16} />
          Editar
        </button>
      </header>

      <section className="detail-facts">
        {details.map(([label, value]) => (
          <div className="detail-fact" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="table-card estoque-movements">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Saldo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {item.movimentos.length === 0 ? (
                <tr><td colSpan={5}>Nenhum movimento registrado para este item.</td></tr>
              ) : item.movimentos.map((movimento) => (
                <tr key={movimento.id}>
                  <td>{formatDate(movimento.data_movimento)}</td>
                  <td>{movimento.tipo}</td>
                  <td>{formatQuantity(movimento.quantidade, item.unidade)}</td>
                  <td>{formatQuantity(movimento.saldo_depois, item.unidade)}</td>
                  <td>{movimento.motivo ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
