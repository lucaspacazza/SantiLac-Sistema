import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  FlaskConical,
  MapPin,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { formatNumber } from '../../shared/formatters'

export type QualityPriority = {
  codigo: string
  nome: string
  cidade: string
  issues: string[]
}

type InicioOverview = {
  total: number
  novos: number
  inativos: number
  comAnalise: number
  semAnalise: number
  emAlerta: number
  cidades: [string, number][]
  prioridades: QualityPriority[]
}

type InicioProps = {
  overview: InicioOverview
  onOpenProdutores: () => void
  onOpenProdutor: (codigo: string) => void
  onOpenAnalises: () => void
  onOpenRelatorios: () => void
}

export function Inicio({
  overview,
  onOpenProdutores,
  onOpenProdutor,
  onOpenAnalises,
  onOpenRelatorios,
}: InicioProps) {
  const analysisCoverage = overview.total > 0
    ? Math.round((overview.comAnalise / overview.total) * 100)
    : 0
  const largestCityTotal = overview.cidades[0]?.[1] ?? 1

  return (
    <div className="quality-home">
      <section className="quality-home-hero">
        <div className="quality-home-intro">
          <span className="eyebrow">Painel operacional</span>
          <h2>O que precisa de atenção hoje</h2>
          <p>Priorize desvios, acompanhe a cobertura das análises e acesse rapidamente os fluxos de qualidade.</p>
        </div>
        <div className="quality-home-hero-actions">
          <button className="btn secondary" type="button" onClick={onOpenRelatorios}>
            <ClipboardList size={16} />
            Ver relatórios
          </button>
          <button className="btn primary" type="button" onClick={onOpenProdutores}>
            <Users size={16} />
            Abrir produtores
          </button>
        </div>
      </section>

      <section className="quality-kpi-grid" aria-label="Indicadores operacionais">
        <MetricCard icon={CircleAlert} label="Produtores em alerta" value={overview.emAlerta} tone="danger" />
        <MetricCard icon={FlaskConical} label="Sem análise" value={overview.semAnalise} tone="warning" />
        <MetricCard icon={UserPlus} label="Novos cadastros" value={overview.novos} tone="accent" />
        <MetricCard icon={UserMinus} label="Inativos" value={overview.inativos} />
      </section>

      <section className="quality-home-main">
        <article className="quality-home-panel quality-priority-panel">
          <PanelHeading
            icon={CircleAlert}
            eyebrow="Fila de atenção"
            title="Produtores com desvios"
            action={overview.emAlerta > overview.prioridades.length ? `${overview.emAlerta} no total` : undefined}
          />

          {overview.prioridades.length === 0 ? (
            <div className="quality-home-empty">
              <span aria-hidden="true"><CircleCheck size={22} /></span>
              <strong>Nenhum desvio encontrado</strong>
              <p>As análises mais recentes não apresentam indicadores críticos.</p>
            </div>
          ) : (
            <div className="quality-priority-list">
              {overview.prioridades.map((priority) => (
                <button
                  className="quality-priority-row"
                  type="button"
                  key={priority.codigo}
                  onClick={() => onOpenProdutor(priority.codigo)}
                >
                  <span className="quality-priority-marker" aria-hidden="true" />
                  <span className="quality-priority-person">
                    <strong>{priority.nome}</strong>
                    <small><MapPin size={12} />{priority.cidade || 'Cidade não informada'}</small>
                  </span>
                  <span className="quality-priority-issues">
                    {priority.issues.slice(0, 2).map((issue) => <span key={issue}>{issue}</span>)}
                    {priority.issues.length > 2 && <small>+{priority.issues.length - 2}</small>}
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </article>

        <aside className="quality-home-side">
          <article className="quality-home-panel quality-coverage-card">
            <PanelHeading icon={ChartNoAxesColumnIncreasing} eyebrow="Cobertura" title="Análises registradas" />
            <div className="quality-coverage-value">
              <strong>{analysisCoverage}%</strong>
              <span>{formatNumber(overview.comAnalise)} de {formatNumber(overview.total)} produtores</span>
            </div>
            <div
              className="quality-progress"
              role="progressbar"
              aria-label="Cobertura de análises"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={analysisCoverage}
            >
              <span style={{ width: `${analysisCoverage}%` }} />
            </div>
          </article>

          <article className="quality-home-panel quality-cities-card">
            <PanelHeading icon={MapPin} eyebrow="Origem" title="Produtores por cidade" />
            <div className="quality-city-list">
              {overview.cidades.length === 0 ? (
                <p className="empty-copy">Nenhuma cidade informada.</p>
              ) : overview.cidades.slice(0, 5).map(([city, total]) => (
                <div className="quality-city-row" key={city}>
                  <span><strong>{city}</strong><small>{formatNumber(total)}</small></span>
                  <i aria-hidden="true"><span style={{ width: `${(total / largestCityTotal) * 100}%` }} /></i>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="quality-quick-actions" aria-label="Ações rápidas">
        <QuickAction icon={FlaskConical} label="Importar análises" onClick={onOpenAnalises} />
        <QuickAction icon={Users} label="Consultar produtores" onClick={onOpenProdutores} />
        <QuickAction icon={ClipboardList} label="Investigar indicadores" onClick={onOpenRelatorios} />
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone = 'neutral' }: {
  icon: LucideIcon
  label: string
  value: number
  tone?: 'neutral' | 'danger' | 'warning' | 'accent'
}) {
  return (
    <article className={`quality-kpi-card is-${tone}`}>
      <span className="quality-kpi-icon" aria-hidden="true"><Icon size={18} /></span>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  )
}

function PanelHeading({ icon: Icon, eyebrow, title, action }: {
  icon: LucideIcon
  eyebrow: string
  title: string
  action?: string
}) {
  return (
    <header className="quality-panel-heading">
      <span className="quality-panel-icon" aria-hidden="true"><Icon size={17} /></span>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      {action && <small>{action}</small>}
    </header>
  )
}

function QuickAction({ icon: Icon, label, onClick }: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick}>
      <span aria-hidden="true"><Icon size={17} /></span>
      <strong>{label}</strong>
      <ArrowRight size={15} aria-hidden="true" />
    </button>
  )
}
