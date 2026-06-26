export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = value.split(' ')[0]
  const parts = date.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value
}

export function formatDateTime(value: string): string {
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatNumber(value: number, suffix = ''): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`
}
