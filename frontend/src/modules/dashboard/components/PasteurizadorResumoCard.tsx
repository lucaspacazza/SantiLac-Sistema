import { useMemo } from 'react'
import type { PasteurizadorResumo } from '../api/dashboardResumoTypes'

export function PasteurizadorResumoCard({ pasteurizador, large = false, onClick }: { pasteurizador: PasteurizadorResumo; large?: boolean; onClick: () => void }) {
  return (
    <button className={`pasteurizador-summary ${large ? 'is-large' : ''}`} type="button" onClick={onClick}>
      <div className="pasteurizador-metrics">
        <span><small>Média <em className="mini-status ok">OK</em></small><strong>{pasteurizador.media === null ? '-' : pasteurizador.media.toFixed(2)}</strong></span>
        <span><small>Mín. <em className="mini-status warn">MIN</em></small><strong>{pasteurizador.minima === null ? '-' : pasteurizador.minima.toFixed(2)}</strong></span>
        <span><small>Máx. <em className="mini-status warn">MAX</em></small><strong>{pasteurizador.maxima === null ? '-' : pasteurizador.maxima.toFixed(2)}</strong></span>
      </div>
      <MiniTemperatureChart points={pasteurizador.pontos.map((item) => item.valor)} />
      <em>abrir módulo: #/pasteurizador/historico</em>
    </button>
  )
}

function MiniTemperatureChart({ points }: { points: number[] }) {
  const sample = useMemo(() => {
    if (points.length <= 80) return points
    const step = Math.ceil(points.length / 80)
    return points.filter((_, index) => index % step === 0)
  }, [points])

  if (!sample.length) return <div className="mini-chart-empty">Sem amostras</div>

  const max = Math.max(...sample, 1)
  const min = Math.min(...sample, 0)
  const range = Math.max(max - min, 1)
  const path = sample.map((value, index) => {
    const x = sample.length <= 1 ? 0 : (index / (sample.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  return (
    <svg className="mini-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}
