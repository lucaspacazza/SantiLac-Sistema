import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type DashboardTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'violet'

export function DashboardKpi({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'neutral',
  onClick,
  trend,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone?: DashboardTone
  onClick?: () => void
  trend?: Array<{ value: number }>
}) {
  const content = (
    <>
      <div className="od-kpi-head">
        <span>{label}</span>
        <span className={`od-icon is-${tone}`}><Icon size={15} /></span>
      </div>
      <div className="od-kpi-value-row">
        <strong>{value}</strong>
        {trend?.length ? <Sparkline values={trend.map((item) => item.value)} tone={tone} /> : null}
      </div>
      <small className={`od-kpi-detail is-${tone}`}>{detail}</small>
    </>
  )

  return onClick ? (
    <button className="od-kpi od-interactive" type="button" onClick={onClick}>{content}</button>
  ) : (
    <article className="od-kpi">{content}</article>
  )
}

export function Panel({
  title,
  subtitle,
  action,
  className = '',
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <article className={`od-panel ${className}`}>
      <header className="od-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="od-panel-action">{action}</div> : null}
      </header>
      {children}
    </article>
  )
}

export function StatusPill({ tone, children }: { tone: DashboardTone; children: ReactNode }) {
  return <span className={`od-pill is-${tone}`}><i />{children}</span>
}

export function TextAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="od-text-action" type="button" onClick={onClick}>{children}<ArrowUpRight size={13} /></button>
}

export function ProgressBar({ value, tone = 'info' }: { value: number; tone?: DashboardTone }) {
  const safe = Math.max(0, Math.min(value, 100))
  return <div className="od-progress" aria-label={`${safe.toFixed(0)}%`}><span className={`is-${tone}`} style={{ width: `${safe}%` }} /></div>
}

export function TrendChart({
  points,
  tone = 'info',
  unit = '',
  benchmark,
  onClick,
}: {
  points: Array<{ label: string; value: number }>
  tone?: DashboardTone
  unit?: string
  benchmark?: number
  onClick?: () => void
}) {
  if (points.length < 3) {
    return (
      <div className="od-chart-fallback">
        {points.length ? points.map((point) => (
          <div key={point.label}><span>{point.label}</span><strong>{formatChartValue(point.value, unit)}</strong></div>
        )) : <span>Dados insuficientes para exibir tendência.</span>}
      </div>
    )
  }

  const values = points.map((point) => point.value)
  const minValue = Math.min(...values, benchmark ?? Number.POSITIVE_INFINITY)
  const maxValue = Math.max(...values, benchmark ?? Number.NEGATIVE_INFINITY)
  const padding = Math.max((maxValue - minValue) * 0.15, 1)
  const min = minValue - padding
  const max = maxValue + padding
  const coords = points.map((point, index) => ({
    x: 24 + (index / (points.length - 1)) * 652,
    y: 16 + (1 - (point.value - min) / (max - min || 1)) * 138,
    ...point,
  }))
  const line = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const benchmarkY = benchmark === undefined ? null : 16 + (1 - (benchmark - min) / (max - min || 1)) * 138
  const chart = (
    <>
      <svg className={`od-trend-chart is-${tone}`} viewBox="0 0 700 178" role="img" aria-label={points.map((point) => `${point.label}: ${formatChartValue(point.value, unit)}`).join(', ')}>
        {[16, 62, 108, 154].map((y) => <line className="od-chart-grid" key={y} x1="24" x2="676" y1={y} y2={y} />)}
        {benchmarkY !== null ? <line className="od-chart-benchmark" x1="24" x2="676" y1={benchmarkY} y2={benchmarkY} /> : null}
        <path className="od-chart-line" d={line} />
        {coords.map((point) => (
          <circle className="od-chart-point" key={`${point.label}-${point.value}`} cx={point.x} cy={point.y} r="4">
            <title>{point.label}: {formatChartValue(point.value, unit)}</title>
          </circle>
        ))}
      </svg>
      <div className="od-chart-labels">
        {points.map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </>
  )

  return onClick ? <button className="od-chart-button" type="button" onClick={onClick}>{chart}</button> : <div className="od-chart-button">{chart}</div>
}

export function EmptyMessage({ children }: { children: ReactNode }) {
  return <div className="od-empty">{children}</div>
}

function Sparkline({ values, tone }: { values: number[]; tone: DashboardTone }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const path = values.map((value, index) => {
    const x = 2 + (index / Math.max(values.length - 1, 1)) * 76
    const y = 4 + (1 - (value - min) / (max - min || 1)) * 26
    return `${index ? 'L' : 'M'} ${x} ${y}`
  }).join(' ')
  return <svg className={`od-sparkline is-${tone}`} viewBox="0 0 80 34" aria-hidden="true"><path d={path} /></svg>
}

function formatChartValue(value: number, unit: string) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit}`
}
