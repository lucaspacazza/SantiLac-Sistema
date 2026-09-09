import { useId } from 'react'

export type ChartSeries = { name: string; values: Array<number | null>; color: string }

const width = 600
const height = 220
const plot = { left: 48, right: 586, top: 12, bottom: 192 }

export function LineChart({ labels, series, format = compact, area = true, className = '' }: {
  labels: string[]
  series: ChartSeries[]
  format?: (value: number) => string
  area?: boolean
  className?: string
}) {
  const gradientPrefix = useId().replace(/:/g, '')
  const maximum = Math.max(1, ...series.flatMap((item) => item.values.map(number))) * 1.15
  return (
    <svg className={`owner-chart-svg ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Evolução: ${series.map((item) => item.name).join(', ')}`}>
      <Grid labels={labels} maximum={maximum} format={format} />
      {series.map((item, seriesIndex) => {
        const points = item.values.map((raw, index) => ({
          value: number(raw),
          x: plot.left + index * (plot.right - plot.left) / Math.max(1, labels.length - 1),
          y: plot.bottom - Math.max(0, number(raw)) * (plot.bottom - plot.top) / maximum,
        }))
        const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
        const gradient = `${gradientPrefix}-${seriesIndex}`
        return <g key={item.name}>
          {area && points.length ? <>
            <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop stopColor={item.color} stopOpacity=".18"/><stop offset="1" stopColor={item.color} stopOpacity="0"/></linearGradient></defs>
            <path d={`${path} L${points.at(-1)?.x},${plot.bottom} L${points[0].x},${plot.bottom} Z`} fill={`url(#${gradient})`} />
          </> : null}
          <path d={path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => <circle key={`${item.name}-${labels[index]}`} cx={point.x} cy={point.y} r="7" fill={item.color} fillOpacity=".001" tabIndex={0}>
            <title>{labels[index]} · {item.name}: {format(point.value)}</title>
          </circle>)}
        </g>
      })}
    </svg>
  )
}

export function BarChart({ labels, series, format = compact, stacked = false, className = '' }: {
  labels: string[]
  series: ChartSeries[]
  format?: (value: number) => string
  stacked?: boolean
  className?: string
}) {
  const totals = labels.map((_, index) => series.reduce((total, item) => total + Math.max(0, number(item.values[index])), 0))
  const maximum = Math.max(1, ...(stacked ? totals : series.flatMap((item) => item.values.map(number)))) * 1.15
  const slot = (plot.right - plot.left) / Math.max(1, labels.length)
  const groupWidth = slot * .65
  return (
    <svg className={`owner-chart-svg ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${stacked ? 'Barras empilhadas' : 'Comparativo'}: ${series.map((item) => item.name).join(', ')}`}>
      <Grid labels={labels} maximum={maximum} format={format} centered />
      {labels.map((label, index) => {
        let accumulated = 0
        return <g key={label}>{series.map((item, seriesIndex) => {
          const value = Math.max(0, number(item.values[index]))
          const barWidth = stacked ? groupWidth : groupWidth / Math.max(1, series.length)
          const x = plot.left + slot * index + (slot - groupWidth) / 2 + (stacked ? 0 : barWidth * seriesIndex)
          const barHeight = value / maximum * (plot.bottom - plot.top)
          const y = plot.bottom - barHeight - (stacked ? accumulated / maximum * (plot.bottom - plot.top) : 0)
          accumulated += value
          return <rect key={item.name} x={x} y={y} width={Math.max(1, barWidth - (stacked ? 0 : 2))} height={Math.max(value > 0 ? 1 : 0, barHeight)} rx={stacked ? 1 : 3} fill={item.color} tabIndex={0}>
            <title>{label} · {item.name}: {format(value)}</title>
          </rect>
        })}</g>
      })}
    </svg>
  )
}

function Grid({ labels, maximum, format, centered = false }: { labels: string[]; maximum: number; format: (value: number) => string; centered?: boolean }) {
  const step = Math.max(1, Math.ceil(labels.length / 7))
  return <g>
    {Array.from({ length: 5 }, (_, index) => {
      const y = plot.top + (plot.bottom - plot.top) * index / 4
      return <g key={index}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="var(--owner-grid)" strokeDasharray="3 4"/><text x={plot.left - 8} y={y + 3} textAnchor="end">{format(maximum * (1 - index / 4))}</text></g>
    })}
    {labels.map((label, index) => {
      if (index % step !== 0 && index !== labels.length - 1) return null
      const x = centered
        ? plot.left + (index + .5) * (plot.right - plot.left) / Math.max(1, labels.length)
        : plot.left + index * (plot.right - plot.left) / Math.max(1, labels.length - 1)
      return <text key={`${label}-${index}`} x={x} y="213" textAnchor="middle">{label}</text>
    })}
  </g>
}

export function DonutChart({ items, center, unit }: { items: Array<{ name: string; value: number; color: string }>; center: string; unit: string }) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  const circumference = Math.PI * 144
  let offset = 0
  return <div className="owner-donut-layout">
    <div className="owner-donut-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="Distribuição">
      <circle cx="100" cy="100" r="72" fill="none" stroke="var(--owner-grid)" strokeWidth="22"/>
      {items.map((item) => {
        const fraction = total ? Math.max(0, item.value) / total : 0
        const length = fraction * circumference
        const dashOffset = -offset
        offset += length
        return <circle key={item.name} cx="100" cy="100" r="72" fill="none" stroke={item.color} strokeWidth="22" strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`} strokeDashoffset={dashOffset} transform="rotate(-90 100 100)" tabIndex={0}><title>{item.name}: {formatNumber(item.value)} {unit} · {formatNumber(fraction * 100, 1)}%</title></circle>
      })}
      <text x="100" y="98" textAnchor="middle" className="owner-donut-total">{center}</text>
      <text x="100" y="119" textAnchor="middle">{unit}</text>
    </svg></div>
    <div className="owner-donut-key">{items.map((item) => <div className="owner-donut-key-row" key={item.name}><i style={{ background: item.color }}/><span>{item.name}</span><strong>{formatNumber(item.value)} {unit}</strong></div>)}</div>
  </div>
}

export function Sparkline({ values, color }: { values: Array<number | null>; color: string }) {
  const clean = values.map(number)
  const minimum = Math.min(0, ...clean)
  const maximum = Math.max(1, ...clean)
  const path = clean.map((value, index) => `${index ? 'L' : 'M'}${(index * 120 / Math.max(1, clean.length - 1)).toFixed(2)},${(35 - (value - minimum) / Math.max(1, maximum - minimum) * 30).toFixed(2)}`).join(' ')
  return <svg className="owner-sparkline" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>
}

function number(value: number | null | undefined) { return Number.isFinite(Number(value)) ? Number(value) : 0 }
export function formatNumber(value: number, digits = 0) { return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) }
export function compact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)} mi`
  if (Math.abs(value) >= 1_000) return `${formatNumber(value / 1_000, 1)} mil`
  return formatNumber(value)
}
