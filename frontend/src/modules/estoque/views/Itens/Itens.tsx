import { Search, SlidersHorizontal } from 'lucide-react'
import type { FormEvent } from 'react'
import type { EstoqueItem } from '../../api/estoqueApi'
import { formatQuantity } from '../../shared/formatters'

type ItensViewProps = {
  itens: EstoqueItem[]
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenItem: (id: number) => void
}

export function ItensView({ itens, search, onSearchChange, onSearchSubmit, onOpenItem }: ItensViewProps) {
  return (
    <section className="module-grid">
      <form className="toolbar" onSubmit={onSearchSubmit}>
        <label className="search-field">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar por item, categoria ou código"
          />
        </label>
        <button className="icon-btn" type="submit" title="Filtrar">
          <SlidersHorizontal size={16} />
        </button>
      </form>
      <ItensTable itens={itens} onOpenItem={onOpenItem} />
    </section>
  )
}

function ItensTable({ itens, onOpenItem }: { itens: EstoqueItem[]; onOpenItem: (id: number) => void }) {
  return (
    <section className="table-card">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Item</th>
              <th>Categoria</th>
              <th>Saldo</th>
              <th>Mínimo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr><td colSpan={6}>Nenhum item cadastrado.</td></tr>
            ) : itens.map((item) => (
              <tr key={item.id}>
                <td>{item.codigo ?? '--'}</td>
                <td>
                  <button className="table-link" type="button" onClick={() => onOpenItem(item.id)}>
                    {item.nome}
                  </button>
                </td>
                <td>{item.categoria}</td>
                <td>{formatQuantity(item.saldo_atual, item.unidade)}</td>
                <td>{formatQuantity(item.estoque_minimo, item.unidade)}</td>
                <td>
                  <span className={`status-badge ${item.abaixo_minimo ? 'is-warn' : 'is-good'}`}>
                    {item.abaixo_minimo ? 'Atenção' : 'Normal'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
