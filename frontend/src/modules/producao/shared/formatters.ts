export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(value: string | null): string {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function formatNumber(value: number | null, suffix = ''): string {
  if (value === null || Number.isNaN(value)) return '-'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${suffix}`
}
