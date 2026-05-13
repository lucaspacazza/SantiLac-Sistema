export const numberFormat = new Intl.NumberFormat('pt-BR')

export const decimalFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--'
  return numberFormat.format(value)
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return '--'
  return decimalFormat.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '--'
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}
