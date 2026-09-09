export type DashboardDateRange = {
  data_inicio: string
  data_fim: string
}

export function withDashboardDateRange(path: string, range: DashboardDateRange): string {
  const params = new URLSearchParams(range)
  return `${path}?${params.toString()}`
}

export function quickDashboardDateRange(days: number, endDate = localDate(new Date())): DashboardDateRange {
  const end = parseLocalDate(endDate)
  const start = new Date(end)
  start.setDate(start.getDate() - Math.max(1, days) + 1)

  return { data_inicio: localDate(start), data_fim: localDate(end) }
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
