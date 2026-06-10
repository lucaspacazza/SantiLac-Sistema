import { List, Plus, Search } from 'lucide-react'
import type { OrdemExportFormat, OrdemProducaoResumo } from '../../api/producaoApi'
import { OrdemExportMenu } from '../../shared/OrdemExportMenu'

export function ConsultaOrdemProducao({
  data,
  ordens,
  consultou,
  onDataChange,
  onSearch,
  onCreate,
  onOpen,
  onExport,
}: {
  data: string
  ordens: OrdemProducaoResumo[]
  consultou: boolean
  onDataChange: (value: string) => void
  onSearch: () => void
  onCreate: () => void
  onOpen: (id: number) => void
  onExport: (format: OrdemExportFormat) => void
}) {
  const pendentes = ordens.filter((ordem) => ordem.pendencia_formato).length

  function statusLabel(ordem: OrdemProducaoResumo): string {
    if (ordem.pendencia_formato) return 'Aguardando formato'
    if (ordem.status === 'finalizada') return 'Finalizada'
    if (ordem.status === 'rascunho') return 'Rascunho'
    if (ordem.status === 'cancelada') return 'Cancelada'

    return ordem.status ?? '-'
  }

  return (
    <div className="stack">
      <div className="toolbar toolbar-date-query">
        <form className="date-search" onSubmit={(event) => { event.preventDefault(); onSearch() }}>
          <label>
            Data da produção
            <input type="date" value={data} onChange={(event) => onDataChange(event.target.value)} />
          </label>
          <button className="btn primary" type="submit"><Search size={16} />Buscar</button>
          <button className="btn" type="button" onClick={onCreate}><Plus size={16} />Criar OP</button>
          <OrdemExportMenu disabled={!data || ordens.length === 0} onExport={onExport} />
        </form>
      </div>

      <section className="panel">
        <div className="section-title-row compact-title">
          <div>
            <h2>Consulta por data</h2>
          </div>
        </div>

        {consultou && ordens.length > 0 && (
          <div className="table-list compact-list">
            {pendentes > 0 && (
              <div className="inline-alert">
                {pendentes} OP(s) de mussarela aguardando escolha de formato.
              </div>
            )}
            <div className="table-head op-list-grid">
              <span>Código</span>
              <span>Queijo</span>
              <span>Lote</span>
              <span>Status</span>
            </div>
            {ordens.map((ordem) => (
              <button className="table-row op-list-grid clickable-row" type="button" key={ordem.id} onClick={() => onOpen(ordem.id)}>
                <strong>{ordem.codigo_ordem}</strong>
                <span>{ordem.tipo_queijo}</span>
                <span>{ordem.lote_queijo ?? '-'}</span>
                <span>{statusLabel(ordem)}</span>
              </button>
            ))}
          </div>
        )}

        {consultou && ordens.length === 0 && <div className="empty">Sem OP para essa data.</div>}
        {!consultou && <div className="empty"><List size={16} />Escolha uma data.</div>}
      </section>
    </div>
  )
}
