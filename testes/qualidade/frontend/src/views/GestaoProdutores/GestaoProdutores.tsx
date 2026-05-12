import { Bell, ListFilter, Search } from 'lucide-react'
import type { Produtor } from '../../api/qualidadeApi'
import { formatDate, formatDecimal, formatNumber } from '../../shared/formatters'

type GestaoProdutoresProps = {
  produtores: Produtor[]
  search: string
  activeFilter: string
  onSearchChange: (value: string) => void
  onActiveFilterChange: (value: string) => void
  onOpenProdutor: (codigo: string) => void
}

export function GestaoProdutores({
  produtores,
  search,
  activeFilter,
  onSearchChange,
  onActiveFilterChange,
  onOpenProdutor,
}: GestaoProdutoresProps) {
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            type="search"
            placeholder="Buscar por nome, cidade, rota ou código"
          />
        </label>
        <select className="control" value={activeFilter} onChange={(event) => onActiveFilterChange(event.target.value)}>
          <option value="">Todos os produtores</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>
        <button className="icon-btn" type="button" aria-label="Filtros">
          <ListFilter size={16} />
        </button>
        <button className="icon-btn" type="button" aria-label="Alertas">
          <Bell size={16} />
        </button>
      </div>

      <section className="table-card">
        <div className="table-wrap">
          <table className="data-table">
            <colgroup>
              <col className="col-code" />
              <col className="col-producer" />
              <col className="col-city" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-metric" />
              <col className="col-flag" />
              <col className="col-flag" />
              <col className="col-metric" />
              <col className="col-date" />
            </colgroup>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produtor</th>
                <th>Cidade</th>
                <th>CCS</th>
                <th>UFC</th>
                <th>GORD</th>
                <th>PROT</th>
                <th>LACT</th>
                <th>SOL</th>
                <th>CASE</th>
                <th>SNG</th>
                <th>UREI</th>
                <th>ATB</th>
                <th>BCL</th>
                <th>TEMP</th>
                <th>Última</th>
              </tr>
            </thead>
            <tbody>
              {produtores.length === 0 ? (
                <tr>
                  <td colSpan={16}>Nenhum produtor encontrado.</td>
                </tr>
              ) : produtores.map((produtor) => (
                <ProducerRow key={produtor.codigo} produtor={produtor} onOpenProdutor={onOpenProdutor} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function ProducerRow({ produtor, onOpenProdutor }: { produtor: Produtor; onOpenProdutor: (codigo: string) => void }) {
  const analysis = produtor.ultima_analise

  return (
    <tr>
      <td>{produtor.codigo}</td>
      <td>
        <button className="producer-link" type="button" onClick={() => onOpenProdutor(produtor.codigo)}>
          <strong>{produtor.nome}</strong>
          <span>{produtor.ativo ? 'Ativo' : 'Inativo'}{produtor.novo ? ' / Novo' : ''}</span>
        </button>
      </td>
      <td>{produtor.cidade || '-'}</td>
      <td>{formatNumber(analysis?.ccs)}</td>
      <td>{formatNumber(analysis?.ufc)}</td>
      <td>{formatDecimal(analysis?.gordura)}</td>
      <td>{formatDecimal(analysis?.proteina)}</td>
      <td>{formatDecimal(analysis?.lactose)}</td>
      <td>{formatDecimal(analysis?.solidos_totais)}</td>
      <td>{formatDecimal(analysis?.caseina)}</td>
      <td>{formatDecimal(analysis?.sng)}</td>
      <td>{formatDecimal(analysis?.ureia)}</td>
      <td>{formatDecimal(analysis?.antibiotico)}</td>
      <td>{formatDecimal(analysis?.bacteria)}</td>
      <td>{formatDecimal(analysis?.temperatura)}</td>
      <td>{formatDate(analysis?.data)}</td>
    </tr>
  )
}
