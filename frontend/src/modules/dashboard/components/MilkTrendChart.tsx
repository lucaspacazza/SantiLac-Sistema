import type { LeiteIndicador } from '../api/leiteIndicadorApi'

type MilkPoint = LeiteIndicador['serie_mensal'][number]

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const numberFormatter = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

export function MilkTrendChart({ data }: { data: MilkPoint[] }) {
  const width = 760
  const height = 238
  const padding = { top: 18, right: 18, bottom: 38, left: 58 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const displayMax = Math.max(...data.map((point) => point.litros), 0)
  const maxValue = Math.max(displayMax, 1)
  const coordinates = data.map((point, index) => ({
    x: padding.left + (data.length > 1 ? (index / (data.length - 1)) * chartWidth : chartWidth / 2),
    y: padding.top + chartHeight - (point.litros / maxValue) * chartHeight,
    point,
  }))
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(' ')
  const area = coordinates.length
    ? `M ${coordinates[0].x} ${padding.top + chartHeight} L ${coordinates.map(({ x, y }) => `${x} ${y}`).join(' L ')} L ${coordinates.at(-1)?.x ?? 0} ${padding.top + chartHeight} Z`
    : ''

  return (
    <div className="dashboard-chart-wrap">
      <svg className="dashboard-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução mensal do leite recebido nos últimos doze meses">
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight - chartHeight * ratio
          return (
            <g key={ratio}>
              <line className="dashboard-chart-gridline" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="dashboard-chart-axis-label" x={padding.left - 10} y={y + 4} textAnchor="end">
                {numberFormatter.format(displayMax * ratio)}
              </text>
            </g>
          )
        })}
        {area ? <path className="dashboard-chart-area" d={area} /> : null}
        {line ? <polyline className="dashboard-chart-line" points={line} /> : null}
        {coordinates.map(({ x, y, point }) => (
          <g key={point.periodo}>
            <circle className="dashboard-chart-point" cx={x} cy={y} r="3.5">
              <title>{`${formatMonth(point.periodo)}: ${numberFormatter.format(point.litros)} litros`}</title>
            </circle>
            <text className="dashboard-chart-label" x={x} y={height - 12} textAnchor="middle">
              {formatMonth(point.periodo)}
            </text>
          </g>
        ))}
      </svg>
      <dl className="dashboard-sr-only">
        {data.map((point) => (
          <div key={point.periodo}><dt>{formatMonth(point.periodo)}</dt><dd>{point.litros} litros</dd></div>
        ))}
      </dl>
    </div>
  )
}

function formatMonth(period: string) {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) return period
  return monthFormatter.format(new Date(year, month - 1, 1)).replace('.', '')
}
