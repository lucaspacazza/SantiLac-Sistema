import type { EstoqueSoroResumo } from '../../api/producaoApi'
import { formatDate, formatNumber } from '../../shared/formatters'

export function EstoqueSoroRefrigerado({ resumo }: { resumo: EstoqueSoroResumo | null }) {
  const estoque = resumo?.estoque ?? null
  const ultimaEntrada = resumo?.ultima_entrada ?? null
  const movimentos = resumo?.movimentos ?? []

  return (
    <section className="stack">
      <div className="kpi-row compact-kpis">
        <article className="kpi">
          <span>Litragem atual</span>
          <strong>{formatNumber(estoque?.saldo_atual ?? null, ` ${estoque?.unidade ?? 'L'}`)}</strong>
        </article>
        <article className="kpi">
          <span>Última entrada</span>
          <strong>{formatNumber(ultimaEntrada?.quantidade ?? null, ` ${estoque?.unidade ?? 'L'}`)}</strong>
          <small>{ultimaEntrada?.data_movimento ? formatDate(ultimaEntrada.data_movimento) : '-'}</small>
        </article>
        <article className="kpi">
          <span>Item de estoque</span>
          <strong>{estoque?.nome ?? '-'}</strong>
          <small>{estoque ? 'Soro refrigerado' : 'Sem movimentação registrada'}</small>
        </article>
      </div>

      <section className="panel">
        <h2>Últimas movimentações</h2>
        <div className="table stock-table">
          <div className="table-head stock-table-head">
            <span>Data</span>
            <span>Tipo</span>
            <span>Quantidade</span>
            <span>Saldo</span>
          </div>
          {movimentos.map((movimento) => (
            <div className="table-row stock-table-row" key={movimento.id}>
              <span>{formatDate(movimento.data_movimento)}</span>
              <strong>{tipoMovimento(movimento.tipo)}</strong>
              <span>{formatNumber(movimento.quantidade, ` ${estoque?.unidade ?? 'L'}`)}</span>
              <span>{formatNumber(movimento.saldo_depois, ` ${estoque?.unidade ?? 'L'}`)}</span>
            </div>
          ))}
          {movimentos.length === 0 && <div className="empty">Nenhuma movimentação registrada para o soro refrigerado.</div>}
        </div>
      </section>
    </section>
  )
}

function tipoMovimento(tipo: EstoqueSoroResumo['movimentos'][number]['tipo']) {
  if (tipo === 'entrada') return 'Entrada'
  if (tipo === 'saida') return 'Saída'

  return 'Ajuste'
}
