import { Bell, ListFilter, Search } from 'lucide-react'
import { formatAnalysisMetric, resolveMetricStatus, type AnalysisMetricField } from '../../shared/analysisMetrics'
import type { Produtor } from '../../api/qualidadeApi'
import { formatDate } from '../../shared/formatters'

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
          <table className="data-table quality-table">
            <colgroup>
              <col className="col-code" />
              <col className="col-producer" />
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
                  <td colSpan={15}>Nenhum produtor encontrado.</td>
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
          <span>{produtor.cidade || 'Cidade não informada'} / {produtor.ativo ? 'Ativo' : 'Inativo'}{produtor.novo ? ' / Novo' : ''}</span>
        </button>
      </td>
      <MetricCell field="CCS" value={analysis?.ccs} />
      <MetricCell field="UFC" value={analysis?.ufc} />
      <MetricCell field="GORD" value={analysis?.gordura} />
      <MetricCell field="PROT" value={analysis?.proteina} />
      <MetricCell field="LACT" value={analysis?.lactose} />
      <MetricCell field="SOL" value={analysis?.solidos_totais} />
      <MetricCell field="CASE" value={analysis?.caseina} />
      <MetricCell field="SNG" value={analysis?.sng} />
      <MetricCell field="UREI" value={analysis?.ureia} />
      <FlagCell value={analysis?.antibiotico} />
      <FlagCell value={analysis?.bacteria} />
      <MetricCell field="TEMP" value={analysis?.temperatura} />
      <td>{formatDate(analysis?.data)}</td>
    </tr>
  )
}

function MetricCell({ field, value }: { field: AnalysisMetricField; value: number | null | undefined }) {
  const status = resolveMetricStatus(field, value)

  return (
    <td>
      <span className={`analysis-value is-${status}`}>{formatAnalysisMetric(field, value)}</span>
    </td>
  )
}

function FlagCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <td><span className="analysis-value is-neutral">--</span></td>
  }

  const isPositive = Number(value) === 1
  return (
    <td>
      <span className={`analysis-flag ${isPositive ? 'is-bad' : 'is-good'}`}>{isPositive ? 'POS' : 'NEG'}</span>
    </td>
  )
}
