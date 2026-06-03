import { List, Plus, Search } from 'lucide-react'
import type { FormulacaoQueijo } from '../../api/producaoApi'
import { TabelaFormulacoesQueijo } from './TabelaFormulacoesQueijo'

export function ListagemFormulacoesQueijo({
  items,
  selectedDate,
  hasSearched,
  onDateChange,
  onSearch,
  onShowAll,
  onOpenItem,
  onCreateNew,
  onFinalize,
  onCancel,
}: {
  items: FormulacaoQueijo[]
  selectedDate: string
  hasSearched: boolean
  onDateChange: (value: string) => void
  onSearch: () => void
  onShowAll: () => void
  onOpenItem: (item: FormulacaoQueijo) => void
  onCreateNew: () => void
  onFinalize: (id: number) => void
  onCancel: (id: number) => void
}) {
  const emptyText = hasSearched ? 'Nenhuma ficha encontrada para a data selecionada.' : 'Escolha uma data para consultar as fichas.'

  return (
    <div className="stack">
      <div className="toolbar toolbar-date-query">
        <form className="date-search" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
          <label>
            Data da formulação
            <input type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} />
          </label>
          <button className="btn primary" type="submit"><Search size={16} />Buscar</button>
        </form>
        <button className="btn secondary subtle" type="button" onClick={onShowAll}><List size={16} />Mostrar todos</button>
        <button className="btn primary" type="button" onClick={onCreateNew}><Plus size={16} />Nova ficha</button>
      </div>

      <section className="panel">
        <h2>{hasSearched && selectedDate ? `Fichas de ${formatDateInput(selectedDate)}` : 'Consulta por data'}</h2>
        <TabelaFormulacoesQueijo
          items={items}
          emptyText={emptyText}
          onOpenItem={onOpenItem}
          onFinalize={onFinalize}
          onCancel={onCancel}
        />
      </section>
    </div>
  )
}

function formatDateInput(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('-')

  return `${day}/${month}/${year}`
}
