import { Database, FileDown, Radio, Thermometer } from 'lucide-react'
import type { Overview } from '../../api/pasteurizadorApi'

export function Inicio({
  overview,
  onNavigateHistorico,
}: {
  overview: Overview | null
  onNavigateHistorico: () => void
}) {
  const ultima = overview?.ultima_coleta

  return (
    <div className="dashboard">
      <section className="panel hero-panel">
        <div>
          <span className="section-kicker">FieldLogger</span>
          <h2>Monitoramento do pasteurizador</h2>
          <p>
            Consulta das coletas históricas gravadas pelo processador do módulo.
          </p>
        </div>
        <button className="btn primary" type="button" onClick={onNavigateHistorico}>
          <FileDown size={16} />Abrir histórico
        </button>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <Database size={18} />
          <span>Coletas</span>
          <strong>{overview?.totais.coletas ?? 0}</strong>
        </article>
        <article className="metric-card">
          <Thermometer size={18} />
          <span>Amostras</span>
          <strong>{overview?.totais.amostras ?? 0}</strong>
        </article>
        <article className="metric-card">
          <Radio size={18} />
          <span>Canais</span>
          <strong>{overview?.totais.canais ?? 0}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="section-kicker">Última coleta</span>
            <h3>Resumo do processamento</h3>
          </div>
        </div>

        {ultima ? (
          <div className="summary-list">
            <div><span>Data</span><strong>{ultima.coletado_em ?? '-'}</strong></div>
            <div><span>Arquivo remoto</span><strong>{ultima.arquivo_remoto}</strong></div>
            <div><span>Bytes baixados</span><strong>{ultima.bytes_baixados.toLocaleString('pt-BR')}</strong></div>
            <div><span>Amostras</span><strong>{ultima.total_amostras.toLocaleString('pt-BR')}</strong></div>
            <div><span>Status</span><strong>{ultima.status}</strong></div>
          </div>
        ) : (
          <div className="empty-state">
            Nenhuma coleta salva ainda.
          </div>
        )}
      </section>
    </div>
  )
}
