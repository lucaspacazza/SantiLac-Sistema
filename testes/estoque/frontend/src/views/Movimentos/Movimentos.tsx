import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine } from 'lucide-react'
import type { Movimento } from '../../api/estoqueApi'
import { formatDate, formatQuantity } from '../../shared/formatters'

export function MovimentosView({ movimentos }: { movimentos: Movimento[] }) {
  return (
    <section className="table-card">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Item</th>
              <th>Quantidade</th>
              <th>Saldo</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movimentos.length === 0 ? (
              <tr><td colSpan={6}>Nenhum movimento registrado.</td></tr>
            ) : movimentos.map((movimento) => (
              <tr key={movimento.id}>
                <td>{formatDate(movimento.data_movimento)}</td>
                <td><MovementType tipo={movimento.tipo} /></td>
                <td>{movimento.item_nome}</td>
                <td>{formatQuantity(movimento.quantidade, movimento.unidade)}</td>
                <td>{formatQuantity(movimento.saldo_depois, movimento.unidade)}</td>
                <td>{movimento.motivo ?? '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MovementType({ tipo }: { tipo: Movimento['tipo'] }) {
  const icon = tipo === 'entrada'
    ? <ArrowDownToLine size={13} />
    : tipo === 'saida'
      ? <ArrowUpFromLine size={13} />
      : <ArrowRightLeft size={13} />

  return <span className={`movement-type is-${tipo}`}>{icon}{tipo}</span>
}
