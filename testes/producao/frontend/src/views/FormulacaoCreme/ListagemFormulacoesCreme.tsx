import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import type { FormulacaoCreme } from '../../api/producaoApi'
import { formatDate, formatNumber } from '../../shared/formatters'

export function ListagemFormulacoesCreme({
  items,
  pagination,
  search,
  onSearchChange,
  onSearch,
  onPageChange,
  onOpenEdit,
  onCreateNew,
  onFinalize,
}: {
  items: FormulacaoCreme[]
  pagination: { current_page: number; per_page: number; total: number }
  search: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onPageChange: (page: number) => void
  onOpenEdit: (id: number) => void
  onCreateNew: () => void
  onFinalize: (id: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.per_page))
  const firstItem = pagination.total === 0 ? 0 : ((pagination.current_page - 1) * pagination.per_page) + 1
  const lastItem = Math.min(pagination.current_page * pagination.per_page, pagination.total)

  return (
    <div className="stack">
      <div className="toolbar">
        <form className="search" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar por lote, creme ou responsável" />
        </form>
        <button className="btn primary" type="button" onClick={onCreateNew}><Plus size={16} />Nova ficha</button>
      </div>
      <section className="panel">
        <h2>Fichas registradas</h2>
        <div className="table">
          <div className="table-head table-head-actions"><span>Data</span><span>Lote</span><span>Creme</span><span>Gordura final</span><span>Ação</span></div>
          {items.map((item) => {
            const isLocked = item.status === 'finalizada'
            return (
              <div className={`table-row table-row-actions row-button ${isLocked ? 'is-locked' : ''}`} key={item.id} role="button" tabIndex={0} onClick={() => onOpenEdit(item.id)}>
                <span>{formatDate(item.data_fabricacao)}</span>
                <strong>{item.lote_creme_produzido}</strong>
                <span>{item.tipo_creme ?? '-'}</span>
                <span>{formatNumber(item.gordura_final, '%')}</span>
                {isLocked
                  ? <span className="locked">Bloqueada</span>
                  : <span className="row-actions"><button className="btn secondary compact" type="button" onClick={(event) => { event.stopPropagation(); onFinalize(item.id) }}><CheckCircle2 size={15} />Finalizar</button></span>}
              </div>
            )
          })}
          {items.length === 0 && <div className="empty">Nenhuma ficha encontrada no banco.</div>}
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
