export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatLitros(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })} L`
}

export function formatKm(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${formatNumber(value, 2)} km`
}

export function formatKmh(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${formatNumber(value, 1)} km/h`
}

export function secondsLabel(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '-'
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}min`
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`
}

export function durationLabel(inicio: string, fim: string | null) {
  if (!inicio || !fim) return '-'
  const start = new Date(inicio.replace(' ', 'T')).getTime()
  const end = new Date(fim.replace(' ', 'T')).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '-'
  const totalMinutes = Math.round((end - start) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`
}
