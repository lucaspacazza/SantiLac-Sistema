import { ChevronRight, ClipboardList, RefreshCw } from 'lucide-react'
import type { OrdemDisponivel } from '../api/embalagemApi'

export function IniciarEmbalagem({
  ordens,
  carregando,
  onAtualizar,
  onSelecionar,
}: {
  ordens: OrdemDisponivel[]
  carregando: boolean
  onAtualizar: () => void
  onSelecionar: (ordem: OrdemDisponivel) => void
}) {
  return (
    <section className="panel start-panel" aria-labelledby="available-orders-title">
      <header className="start-panel-head">
        <div>
          <span className="section-kicker">OPs disponíveis</span>
          <h2 id="available-orders-title">Iniciar embalagem</h2>
        </div>
        <button
          className="icon-btn"
          type="button"
          title="Atualizar OPs"
          aria-label="Atualizar OPs disponíveis"
          disabled={carregando}
          onClick={onAtualizar}
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </header>

      {ordens.length > 0 ? (
        <div className="available-orders" aria-busy={carregando}>
          <div className="available-order-head" aria-hidden="true">
            <span>Nome</span>
            <span>Lote</span>
            <span>Tipo de queijo</span>
            <span />
          </div>
          <ul className="available-order-list">
            {ordens.map((ordem) => (
              <li key={ordem.id}>
                <button
                  className="available-order-row"
                  type="button"
                  disabled={carregando}
                  aria-label={`Iniciar ${ordem.nome}, lote ${ordem.lote}, queijo ${ordem.tipo_queijo}`}
                  onClick={() => onSelecionar(ordem)}
                >
                  <span className="available-order-cell">
                    <small>Nome</small>
                    <strong>{ordem.nome}</strong>
                  </span>
                  <span className="available-order-cell">
                    <small>Lote</small>
                    <strong>{ordem.lote || '-'}</strong>
                  </span>
                  <span className="available-order-cell">
                    <small>Tipo de queijo</small>
                    <strong>{ordem.tipo_queijo}</strong>
                  </span>
                  <ChevronRight className="available-order-arrow" size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="available-order-empty" aria-busy={carregando}>
          <ClipboardList size={24} aria-hidden="true" />
          <strong>{carregando ? 'Carregando OPs' : 'Nenhuma OP disponível'}</strong>
          <span>{carregando ? 'Aguarde um instante.' : 'Atualize a lista para consultar novamente.'}</span>
        </div>
      )}
    </section>
  )
}
