export function formatQuantity(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 3,
    maximumFractionDigits: 3,
  }).format(value)

  return unit ? `${formatted} ${unit}` : formatted
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '--'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
