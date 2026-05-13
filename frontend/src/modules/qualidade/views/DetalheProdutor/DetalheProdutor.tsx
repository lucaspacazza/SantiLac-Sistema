import { ArrowLeft } from 'lucide-react'
import type { Produtor } from '../../api/qualidadeApi'
import { formatAnalysisMetric, resolveMetricStatus, type AnalysisMetricField } from '../../shared/analysisMetrics'
import { formatDate } from '../../shared/formatters'

type DetalheProdutorProps = {
  produtor: Produtor | null
  onBack: () => void
}

export function DetalheProdutor({ produtor, onBack }: DetalheProdutorProps) {
  const analysis = produtor?.ultima_analise ?? null

  if (!produtor) {
    return (
      <section className="detail-page">
        <button className="btn secondary" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="empty-state">Produtor não encontrado.</div>
      </section>
    )
  }

  return (
    <section className="detail-page">
      <button className="btn secondary" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar para produtores
      </button>

      <article className="detail-header">
        <span className="eyebrow">Produtor</span>
        <h2>{produtor.nome}</h2>
        <p>Código {produtor.codigo} - {produtor.cidade || 'Cidade não informada'}</p>
      </article>

      <section className="detail-grid">
        <InfoCard label="Status" value={produtor.ativo ? 'Ativo' : 'Inativo'} />
        <InfoCard label="Novo cadastro" value={produtor.novo ? 'Sim' : 'Não'} />
        <InfoCard label="Última análise" value={formatDate(analysis?.data)} />
        <MetricInfoCard label="CCS" field="CCS" value={analysis?.ccs} />
        <MetricInfoCard label="UFC" field="UFC" value={analysis?.ufc} />
        <MetricInfoCard label="Gordura" field="GORD" value={analysis?.gordura} />
        <MetricInfoCard label="Proteína" field="PROT" value={analysis?.proteina} />
        <MetricInfoCard label="Lactose" field="LACT" value={analysis?.lactose} />
      </section>

      <section className="panel-list">
        <span className="eyebrow">Histórico</span>
        <h2>Análises recentes</h2>
        <p className="empty-copy">O histórico de análises entra quando o fluxo de análises for ativado.</p>
      </section>
    </section>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function MetricInfoCard({ label, field, value }: { label: string; field: AnalysisMetricField; value: number | null | undefined }) {
  const status = resolveMetricStatus(field, value)

  return (
    <article className="info-card">
      <span>{label}</span>
      <strong className={`analysis-value is-${status}`}>{formatAnalysisMetric(field, value)}</strong>
    </article>
  )
}
