import { TrendingDown, UserPlus, Users } from 'lucide-react'
import type { Overview } from '../../api/qualidadeApi'
import { formatNumber } from '../../shared/formatters'

type InicioProps = { overview: Overview }

const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
const litersFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function Inicio({ overview }: InicioProps) {
  return (
    <div className="quality-summary">
      <section className="quality-summary-strip" aria-label="Resumo de produtores">
        <SummaryMetric icon={Users} label="Produtores" value={overview.produtores_ativos} />
        <SummaryMetric icon={UserPlus} label="Novos neste mês" value={overview.novos_no_mes} />
        <SummaryMetric icon={TrendingDown} label="Saíram nos últimos 2 meses" value={overview.saidas_ultimos_dois_meses} />
      </section>
      <MilkEvolution points={overview.evolucao_leite} />
    </div>
  )
}

function SummaryMetric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <article><span aria-hidden="true"><Icon size={17} /></span><div><small>{label}</small><strong>{formatNumber(value)}</strong></div></article>
}

function MilkEvolution({ points }: { points: Overview['evolucao_leite'] }) {
  const maximum = Math.max(...points.map((point) => point.litros), 1)

  return (
    <section className="milk-evolution">
      <header><h2>Evolução da quantidade de leite</h2></header>
      {points.length === 0 ? (
        <div className="milk-evolution-empty">Sem dados</div>
      ) : (
        <div className="milk-evolution-scroll">
          <div className="milk-evolution-bars" style={{ minWidth: `${Math.max(points.length * 76, 720)}px` }}>
            {points.map((point) => (
              <div className="milk-evolution-column" key={point.mes}>
                <strong>{litersFormat.format(point.litros)} L</strong>
                <span><i style={{ height: `${Math.max((point.litros / maximum) * 220, point.litros ? 3 : 0)}px` }} /></span>
                <small>{formatMonth(point.mes)}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function formatMonth(period: string): string {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period
  return monthFormat.format(new Date(year, month - 1, 1)).replace(' de ', '/').replace('.', '')
}
