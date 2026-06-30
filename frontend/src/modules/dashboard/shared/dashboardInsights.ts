import type { Analise } from '../../qualidade/api/qualidadeApi'
import { resolveMetricStatus, type AnalysisMetricField } from '../../qualidade/shared/analysisMetrics'
import type { PasteurizadorResumo } from '../api/dashboardResumoTypes'

const monitoredFields: Array<{ field: AnalysisMetricField; key: keyof Analise; label: string }> = [
  { field: 'CCS', key: 'ccs', label: 'CCS' },
  { field: 'UFC', key: 'ufc', label: 'UFC' },
  { field: 'GORD', key: 'gordura', label: 'Gordura' },
  { field: 'PROT', key: 'proteina', label: 'Proteína' },
  { field: 'LACT', key: 'lactose', label: 'Lactose' },
  { field: 'SOL', key: 'solidos_totais', label: 'Sólidos' },
  { field: 'UREI', key: 'ureia', label: 'Ureia' },
  { field: 'TEMP', key: 'temperatura', label: 'Temperatura' },
]

export type QualitySummary = {
  percentage: number | null
  conforming: number
  evaluated: number
  deviations: Array<{ label: string; count: number }>
  trend: Array<{ label: string; value: number }>
  criticalAnalyses: Analise[]
}

export function buildQualitySummary(analises: Analise[]): QualitySummary {
  const evaluated = analises.filter((analysis) => monitoredFields.some(({ key }) => analysis[key] !== null && analysis[key] !== undefined))
  const criticalAnalyses = evaluated.filter((analysis) => monitoredFields.some(({ field, key }) => resolveMetricStatus(field, analysis[key] as number | null) === 'bad'))
  const conforming = evaluated.length - criticalAnalyses.length
  const deviations = monitoredFields
    .map(({ field, key, label }) => ({
      label,
      count: evaluated.filter((analysis) => resolveMetricStatus(field, analysis[key] as number | null) === 'bad').length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)

  const monthly = new Map<string, { total: number; conforming: number }>()
  evaluated.forEach((analysis) => {
    const date = new Date(`${analysis.data}T12:00:00`)
    if (Number.isNaN(date.getTime())) return
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const bucket = monthly.get(key) ?? { total: 0, conforming: 0 }
    bucket.total += 1
    if (!criticalAnalyses.includes(analysis)) bucket.conforming += 1
    monthly.set(key, bucket)
  })

  const trend = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, bucket]) => {
      const [year, month] = key.split('-').map(Number)
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(year, month - 1, 1)).replace('.', '')
      return { label, value: bucket.total ? (bucket.conforming / bucket.total) * 100 : 0 }
    })

  return {
    percentage: evaluated.length ? (conforming / evaluated.length) * 100 : null,
    conforming,
    evaluated: evaluated.length,
    deviations,
    trend,
    criticalAnalyses,
  }
}

export type PasteurizerSummary = {
  current: number | null
  average: number | null
  continuousMinutes: number | null
  inRange: boolean | null
  label: string
  series: Array<{ label: string; value: number }>
}

export function buildPasteurizerSummary(pasteurizer: PasteurizadorResumo): PasteurizerSummary {
  const ordered = pasteurizer.pontos
    .filter((point) => Number.isFinite(point.valor))
    .sort((a, b) => String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')))
  const current = ordered.at(-1)?.valor ?? pasteurizer.media
  const inRange = current === null ? null : current >= 72 && current <= 75
  let continuousStart: number | null = null
  let continuousMinutes: number | null = null

  ordered.forEach((point) => {
    const timestamp = point.timestamp ? new Date(point.timestamp.replace(' ', 'T')).getTime() : Number.NaN
    if (!Number.isFinite(timestamp)) return
    if (point.valor >= 72) {
      continuousStart ??= timestamp
      continuousMinutes = Math.max(0, Math.round((timestamp - continuousStart) / 60000))
    } else {
      continuousStart = null
      continuousMinutes = 0
    }
  })

  const step = Math.max(1, Math.floor(ordered.length / 24))
  const series = ordered.filter((_, index) => index % step === 0 || index === ordered.length - 1).slice(-24).map((point) => ({
    label: point.timestamp ? new Date(point.timestamp.replace(' ', 'T')).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    value: point.valor,
  }))

  return {
    current,
    average: pasteurizer.media,
    continuousMinutes,
    inRange,
    label: inRange === null ? 'Sem leitura' : inRange ? 'Dentro da faixa' : 'Fora da faixa',
    series,
  }
}

export function collectionMovement(series: Array<{ litros: number }>): number | null {
  if (series.length < 3) return null
  const current = series.at(-1)?.litros ?? 0
  const comparison = series.slice(-8, -1)
  const average = comparison.reduce((sum, item) => sum + item.litros, 0) / comparison.length
  return average > 0 ? ((current - average) / average) * 100 : null
}

export function formatCompactNumber(value: number, suffix = ''): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
