import { CheckCircle2, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import type { AguaFilagem } from '../../api/laboratorioApi'

function formatDate(value: string | null): string {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-'
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function ListagemAguaFilagem({
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
  items: AguaFilagem[]
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
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar por responsável ou observação" />
        </form>
        <button className="btn primary" type="button" onClick={onCreateNew}><Plus size={16} />Nova ficha</button>
      </div>

      <section className="panel">
        <h2>Fichas registradas</h2>
        <div className="table">
          <div className="table-head table-head-actions"><span>Data</span><span>Seq.</span><span>pH</span><span>Acidez</span><span>Ação</span></div>
          {items.map((item) => {
            const isLocked = item.status === 'finalizada'

            return (
              <div className={`table-row table-row-actions row-button ${isLocked ? 'is-locked' : ''}`} key={item.id} role="button" tabIndex={isLocked ? -1 : 0} onClick={() => { if (!isLocked) onOpenEdit(item.id) }}>
                <span>{formatDate(item.data_monitoramento)}</span>
                <strong>{item.sequencia ?? '-'}</strong>
                <span>{formatNumber(item.ph)}</span>
                <span>{formatNumber(item.acidez)}</span>
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
