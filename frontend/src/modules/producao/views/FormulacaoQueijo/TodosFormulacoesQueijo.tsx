import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import type { FormulacaoQueijo } from '../../api/producaoApi'
import { TabelaFormulacoesQueijo } from './TabelaFormulacoesQueijo'

export function TodosFormulacoesQueijo({
  items,
  pagination,
  search,
  onSearchChange,
  onSearch,
  onPageChange,
  onBack,
  onOpenItem,
  onCreateNew,
  onFinalize,
  onCancel,
}: {
  items: FormulacaoQueijo[]
  pagination: {
    current_page: number
    per_page: number
    total: number
  }
  search: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onPageChange: (page: number) => void
  onBack: () => void
  onOpenItem: (item: FormulacaoQueijo) => void
  onCreateNew: () => void
  onFinalize: (id: number) => void
  onCancel: (id: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.per_page))
  const firstItem = pagination.total === 0 ? 0 : ((pagination.current_page - 1) * pagination.per_page) + 1
  const lastItem = Math.min(pagination.current_page * pagination.per_page, pagination.total)

  return (
    <div className="stack">
      <div className="toolbar">
        <button className="btn secondary subtle" type="button" onClick={onBack}><ArrowLeft size={16} />Voltar</button>
        <form className="search" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar por código, queijo ou lote" />
        </form>
        <button className="btn primary" type="button" onClick={onCreateNew}><Plus size={16} />Nova ficha</button>
      </div>

      <section className="panel">
        <h2>Todos os registros</h2>
        <TabelaFormulacoesQueijo
          items={items}
          emptyText="Nenhuma ficha encontrada."
          onOpenItem={onOpenItem}
          onFinalize={onFinalize}
          onCancel={onCancel}
        />

        <div className="pagination">
          <span>{firstItem}-{lastItem} de {pagination.total}</span>
          <div className="pagination-actions">
            <button className="icon-btn" type="button" title="Página anterior" disabled={pagination.current_page <= 1} onClick={() => onPageChange(pagination.current_page - 1)}><ChevronLeft size={16} /></button>
            <strong>Página {pagination.current_page} de {totalPages}</strong>
            <button className="icon-btn" type="button" title="Próxima página" disabled={pagination.current_page >= totalPages} onClick={() => onPageChange(pagination.current_page + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>
    </div>
  )
}
