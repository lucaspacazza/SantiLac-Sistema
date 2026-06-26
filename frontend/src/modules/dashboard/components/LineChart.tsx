export function LineChart({ points, onClick }: { points: Array<{ label: string; value: number }>; onClick: () => void }) {
  const max = Math.max(...points.map((point) => point.value), 1)

  return (
    <button className="bar-chart" type="button" onClick={onClick}>
      <div className="bar-chart-bars" aria-hidden="true">
        {points.map((point) => (
          <span key={point.label} style={{ height: `${Math.max((point.value / max) * 100, 6)}%` }} />
        ))}
      </div>
      <div className="chart-labels">
        {points.map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </button>
  )
}
