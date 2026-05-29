import { Plus, Search } from 'lucide-react'
import type { Cronograma } from '../../api/laboratorioApi'
import { monthName, typeLabel } from '../../shared/formatters'

export function ListagemCronogramasAnalises({
  items,
  year,
  onYearChange,
  onSearch,
  onCreateNew,
}: {
  items: Cronograma[]
  year: string
  onYearChange: (value: string) => void
  onSearch: () => void
  onCreateNew: () => void
}) {
  return (
    <div className="stack">
      <div className="toolbar">
        <form className="search" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
          <Search size={16} />
          <input value={year} onChange={(event) => onYearChange(event.target.value)} placeholder="Filtrar por ano" />
        </form>
        <button className="btn primary" type="button" onClick={onCreateNew}><Plus size={16} />Novo cronograma</button>
      </div>

      <section className="panel">
        <h2>Cronogramas registrados</h2>
        <div className="table">
          <div className="table-head"><span>Ano</span><span>Título</span><span>Itens</span><span>Próximas análises</span></div>
          {items.map((item) => (
            <div className="table-row" key={item.id}>
              <strong>{item.ano}</strong>
              <span>{item.titulo}</span>
              <span>{item.itens.length}</span>
              <span>{item.itens.slice(0, 3).map((cronogramaItem) => `${monthName(cronogramaItem.mes)} ${cronogramaItem.produto} ${typeLabel(cronogramaItem.tipo_analise)}`).join(' | ') || '-'}</span>
            </div>
          ))}
          {items.length === 0 && <div className="empty">Nenhum cronograma encontrado no banco.</div>}
        </div>
      </section>
    </div>
  )
}
