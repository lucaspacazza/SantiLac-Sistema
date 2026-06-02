import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Search, XCircle } from 'lucide-react'
import type { FormulacaoQueijo } from '../../api/producaoApi'
import { formatDate, formatNumber } from '../../shared/formatters'

export function ListagemFormulacoesQueijo({
  items,
  pagination,
  search,
  onSearchChange,
  onSearch,
  onPageChange,
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
        <form className="search" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar por código, queijo ou lote" />
        </form>
        <button className="btn primary" type="button" onClick={onCreateNew}><Plus size={16} />Nova ficha</button>
      </div>

      <section className="panel">
        <h2>Fichas registradas</h2>
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
          {items.length === 0 && <div className="empty">Nenhuma ficha encontrada.</div>}
        </div>

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
