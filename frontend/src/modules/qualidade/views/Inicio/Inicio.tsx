import { ArrowRight, CircleUserRound, UserCheck, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { formatNumber } from '../../shared/formatters'

type InicioOverview = {
  total: number
  ativos: number
  novos: number
  inativos: number
  comAnalise: number
  semAnalise: number
  cidades: [string, number][]
}

type InicioProps = {
  overview: InicioOverview
  onOpenProdutores: () => void
}

export function Inicio({ overview, onOpenProdutores }: InicioProps) {
  return (
    <div className="home-grid">
      <section className="home-cards">
        <HomeCard icon={Users} label="Total de produtores" value={formatNumber(overview.total)} copy="Base carregada no módulo" featured />
        <HomeCard icon={UserCheck} label="Produtores ativos" value={formatNumber(overview.ativos)} copy="Aptos para acompanhamento" />
        <HomeCard icon={UserPlus} label="Novos produtores" value={formatNumber(overview.novos)} copy="Marcados como novo cadastro" />
        <HomeCard icon={CircleUserRound} label="Sem análise" value={formatNumber(overview.semAnalise)} copy="Aguardando fluxo de análises" />
      </section>

      <section className="home-columns">
        <article className="panel-list home-data-panel">
          <section className="home-data-section">
            <div className="panel-list-head">
              <div>
                <span className="eyebrow">Situação</span>
                <h2>Produtores</h2>
              </div>
            </div>
            <div className="summary-list">
              <SummaryRow label="Ativos" value={overview.ativos} />
              <SummaryRow label="Inativos" value={overview.inativos} />
              <SummaryRow label="Com análise" value={overview.comAnalise} />
              <SummaryRow label="Sem análise" value={overview.semAnalise} />
            </div>
          </section>

          <section className="home-data-section">
            <div className="panel-list-head">
              <div>
                <span className="eyebrow">Distribuição</span>
                <h2>Principais cidades</h2>
              </div>
            </div>
            <div className="summary-list">
              {overview.cidades.length === 0 ? (
                <p className="empty-copy">Nenhuma cidade encontrada.</p>
              ) : overview.cidades.map(([cidade, total]) => (
                <SummaryRow key={cidade} label={cidade} value={total} />
              ))}
            </div>
          </section>
        </article>

        <article className="panel-list action-panel">
          <div>
            <span className="action-panel-icon" aria-hidden="true"><Users size={20} /></span>
            <span className="eyebrow">Ação rápida</span>
            <h2>Gestão de produtores</h2>
            <p>Abra a lista completa para consultar produtores e acompanhar os campos de qualidade.</p>
          </div>
          <button className="btn primary" type="button" onClick={onOpenProdutores}>
            <Users size={16} />
            Abrir produtores
            <ArrowRight className="action-panel-arrow" size={16} />
          </button>
        </article>
      </section>
    </div>
  )
}

function HomeCard({ icon: Icon, label, value, copy, featured = false }: {
  icon: LucideIcon
  label: string
  value: string
  copy: string
  featured?: boolean
}) {
  return (
    <article className={`home-card${featured ? ' is-featured' : ''}`}>
      <div className="home-card-head">
        <span>{label}</span>
        <span className="home-card-icon" aria-hidden="true"><Icon size={17} /></span>
      </div>
      <div className="home-card-value">
        <strong>{value}</strong>
        <small>{copy}</small>
      </div>
    </article>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  )
}
