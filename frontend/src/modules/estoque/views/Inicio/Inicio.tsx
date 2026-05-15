import { AlertTriangle, Boxes } from 'lucide-react'
import type { Movimento, Overview } from '../../api/estoqueApi'
import { formatQuantity } from '../../shared/formatters'

type InicioProps = {
  overview: Overview
  movimentos: Movimento[]
  onOpenItens: () => void
}

export function Inicio({ overview, movimentos, onOpenItens }: InicioProps) {
  const cards = [
    ['Itens ativos', overview.totais.itens_ativos, `${overview.totais.itens} cadastrado(s)`],
    ['Movimentos no mês', overview.totais.movimentos_mes, 'lançado(s)'],
    ['Abaixo do mínimo', overview.totais.abaixo_minimo, 'atenção'],
  ] as const

  return (
    <section className="dashboard">
      <div className="kpi-row estoque-kpi-row">
        {cards.map(([label, value, hint]) => (
          <article className="kpi-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>

      <div className="split-grid">
        <section className="panel">
          <div className="panel-title">
            <AlertTriangle size={16} />
            <h2>Alertas de estoque</h2>
          </div>
          {overview.alertas.baixo_estoque.length === 0 ? (
            <p className="empty-copy">Nenhum item abaixo do mínimo.</p>
          ) : (
            <div className="compact-list">
              {overview.alertas.baixo_estoque.map((item) => (
                <button className="compact-row" key={item.id} type="button" onClick={onOpenItens}>
                  <span>
                    <strong>{item.nome}</strong>
                    <small>{item.categoria}</small>
                  </span>
                  <em>{formatQuantity(item.saldo_atual, item.unidade)}</em>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">
            <Boxes size={16} />
            <h2>Últimos movimentos</h2>
          </div>
          {movimentos.length === 0 ? (
            <p className="empty-copy">Nenhum movimento registrado.</p>
          ) : (
            <div className="compact-list">
              {movimentos.map((movimento) => (
                <div className="compact-row static" key={movimento.id}>
                  <span>
                    <strong>{movimento.item_nome}</strong>
                    <small>{movimento.tipo}</small>
                  </span>
                  <em>{formatQuantity(movimento.quantidade, movimento.unidade)}</em>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
