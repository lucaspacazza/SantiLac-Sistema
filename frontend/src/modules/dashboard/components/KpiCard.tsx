import type { ReactNode } from 'react'

export function KpiCard({
  icon,
  label,
  value,
  hint,
  badge,
  tone = 'info',
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  badge?: string
  tone?: 'info' | 'ok' | 'warn' | 'danger'
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="kpi-topline">
        <span>{label}</span>
        {badge ? <em className={`mini-badge is-${tone}`}>{icon}{badge}</em> : <span className="kpi-icon">{icon}</span>}
      </span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </>
  )

  return onClick ? (
    <button className="metric-card dashboard-kpi" type="button" onClick={onClick}>{content}</button>
  ) : (
    <article className="metric-card dashboard-kpi">{content}</article>
  )
}
