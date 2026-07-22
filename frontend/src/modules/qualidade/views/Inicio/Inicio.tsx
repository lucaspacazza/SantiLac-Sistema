import { Award, TrendingDown, UserPlus, Users } from 'lucide-react'
import type { Overview, ProducerRankingItem } from '../../api/qualidadeApi'
import { formatDecimal, formatNumber } from '../../shared/formatters'

type InicioProps = {
  overview: Overview
  onOpenProdutor: (codigo: string) => void
}

const litersFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function Inicio({ overview, onOpenProdutor }: InicioProps) {
  return (
    <div className="quality-summary">
      <section className="quality-summary-strip" aria-label="Resumo de produtores">
        <SummaryMetric icon={Users} label="Produtores" value={overview.total_produtores} />
        <SummaryMetric icon={UserPlus} label="Novos neste mês" value={overview.novos_no_mes} />
        <SummaryMetric icon={TrendingDown} label="Saíram nos últimos 2 meses" value={overview.saidas_ultimos_dois_meses} />
      </section>

      <section className="producer-ranking">
        <header className="producer-ranking-header">
          <div>
            <span>Produção + qualidade</span>
            <h2>Ranking de produtores</h2>
          </div>
          <small>Volume 50% · Qualidade 50%</small>
        </header>

        {overview.ranking.length === 0 ? (
          <div className="producer-ranking-empty">Ainda não há coletas suficientes neste mês para formar o ranking.</div>
        ) : (
          <div className="producer-ranking-table">
            <div className="producer-ranking-head">
              <span>Posição</span><span>Produtor</span><span>Leite no mês</span><span>Qualidade</span><span>Pontuação</span>
            </div>
            {overview.ranking.map((producer, index) => (
              <RankingRow key={producer.codigo} producer={producer} position={index + 1} onOpen={onOpenProdutor} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SummaryMetric({ icon: Icon, label, value }: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <article>
      <span aria-hidden="true"><Icon size={17} /></span>
      <div><small>{label}</small><strong>{formatNumber(value)}</strong></div>
    </article>
  )
}

function RankingRow({ producer, position, onOpen }: {
  producer: ProducerRankingItem
  position: number
  onOpen: (codigo: string) => void
}) {
  return (
    <button className={position === 1 ? 'is-winner' : ''} type="button" onClick={() => onOpen(producer.codigo)}>
      <span className="producer-rank-position">
        {position === 1 ? <Award size={17} aria-label="Melhor produtor" /> : position}
      </span>
      <strong>{producer.nome}<small>{position === 1 ? 'Melhor produtor do mês' : producer.codigo}</small></strong>
      <span>{litersFormat.format(producer.litros)} L</span>
      <span>{formatDecimal(producer.pontuacao_qualidade)}%</span>
      <b>{formatDecimal(producer.pontuacao_geral)}</b>
    </button>
  )
}
