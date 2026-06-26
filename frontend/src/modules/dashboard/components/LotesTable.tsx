import type { LoteProducao } from '../api/dashboardResumoTypes'
import { formatNumber } from '../shared/formatters'

export function LotesTable({ lotes, onClick }: { lotes: LoteProducao[]; onClick: () => void }) {
  return (
    <div className="dashboard-table">
      <div className="dashboard-table-head">
        <span>Tipo</span>
        <span>Lote</span>
        <span>Litros</span>
        <span>Etapa</span>
        <span>Destino</span>
      </div>
      {lotes.length ? lotes.map((lote) => (
        <button className="dashboard-table-row" type="button" key={lote.id} onClick={onClick}>
          <span>{lote.tipo || '-'}</span>
          <span>{lote.lote || '-'}</span>
          <span>{formatNumber(lote.litros, ' L')}</span>
          <span>{lote.status || '-'}</span>
          <span>-</span>
        </button>
      )) : (
        <div className="dashboard-table-empty">Nenhum lote registrado.</div>
      )}
    </div>
  )
}
