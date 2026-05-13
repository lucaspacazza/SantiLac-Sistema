import { decimalFormat } from './formatters'

const temperatureFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const integerMetricFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})

export type AnalysisMetricField =
  | 'CCS'
  | 'UFC'
  | 'GORD'
  | 'PROT'
  | 'LACT'
  | 'SOL'
  | 'CASE'
  | 'SNG'
  | 'UREI'
  | 'ATB'
  | 'BCL'
  | 'TEMP'

export type MetricStatus = 'good' | 'warn' | 'bad' | 'neutral'

export function normalizeAnalysisValue(field: AnalysisMetricField, value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return field === 'CCS' || field === 'UFC' ? value / 100 : value
}

export function resolveMetricStatus(field: AnalysisMetricField, value: number | null | undefined): MetricStatus {
  const normalized = normalizeAnalysisValue(field, value)
  if (normalized === null) return 'neutral'

  switch (field) {
    case 'GORD':
      return normalized < 3.5 ? 'bad' : 'good'
    case 'PROT':
      return normalized < 3.2 ? 'bad' : normalized === 3.2 ? 'warn' : 'good'
    case 'LACT':
      return normalized < 4.5 ? 'bad' : normalized === 4.5 ? 'warn' : 'good'
    case 'SOL':
      return normalized < 12.2 ? 'bad' : normalized === 12.2 ? 'warn' : 'good'
    case 'CCS':
      return normalized > 500 ? 'bad' : normalized === 500 ? 'warn' : 'good'
    case 'UFC':
      return normalized > 300 ? 'bad' : normalized === 300 ? 'warn' : 'good'
    case 'UREI':
      return normalized < 11 || normalized > 15 ? 'bad' : normalized === 11 || normalized === 15 ? 'warn' : 'good'
    case 'TEMP':
      return normalized < 2 || normalized > 8 ? 'bad' : 'good'
    default:
      return 'neutral'
  }
}

export function formatAnalysisMetric(field: AnalysisMetricField, value: number | null | undefined): string {
  if (value === null || value === undefined) return '--'
  if (field === 'CCS' || field === 'UFC') {
    return integerMetricFormat.format(value)
  }

  const normalized = normalizeAnalysisValue(field, value)
  if (normalized === null) return '--'
  if (field === 'TEMP') {
    return temperatureFormat.format(normalized)
  }
  return decimalFormat.format(normalized)
}
