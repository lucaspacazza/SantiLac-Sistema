import type { OperacaoEmbalagem } from '../api/embalagemApi'

export function HistoricoCaixas({
  operacao,
  onVoltar,
}: {
  operacao: OperacaoEmbalagem
  onVoltar: () => void
}) {
  return (
    <section className="history-page">
      <button className="btn secondary compact-btn back-btn" type="button" onClick={onVoltar}>
        Voltar
      </button>

      <div>
        <span className="section-kicker">Histórico</span>
        <h2>Últimas caixas</h2>
      </div>

      <div className="panel table-wrap history-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Código</th>
              <th>Peso</th>
              <th>Hora</th>
            </tr>
          </thead>
          <tbody>
            {operacao.historico.length ? (
              operacao.historico.map((caixa) => (
                <tr key={caixa.id}>
                  <td>{caixa.sequencia}</td>
                  <td>{caixa.codigo_barra}</td>
                  <td>{formatWeight(caixa.peso)} kg</td>
                  <td>{formatTime(caixa.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4}>Nenhuma caixa registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatWeight(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: false })
}

function formatTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
