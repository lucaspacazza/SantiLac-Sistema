export type PeriodDay = { date: string }
export type PeriodLot = { id: string; date: string; productId: string; state: string }
export type DashboardProduct = { id: string; name: string }

export function normalizeProductName(value: string): string {
  return value.replace(/mu[cç]arela/giu, 'Mussarela')
}

export function dashboardPeriod<TDay extends PeriodDay, TLot extends PeriodLot>(
  allDays: TDay[],
  allLots: TLot[],
  startDate: string,
  endDate: string,
  selectedProduct: string,
) {
  const days = allDays.filter((day) => day.date >= startDate && day.date <= endDate)
  const lots = allLots.filter((lot) => lot.date >= startDate && lot.date <= endDate && (selectedProduct === 'all' || lot.productId === selectedProduct))
  return { days, lots }
}

export function filterLots<TLot extends PeriodLot>(
  lots: TLot[],
  products: DashboardProduct[],
  filters: { state: string; date: string | null; search: string },
): TLot[] {
  const names = new Map(products.map((product) => [product.id, product.name]))
  const search = fold(filters.search.trim())
  return lots.filter((lot) => {
    const stateMatches = filters.state === 'all'
      || (filters.state === 'open' && lot.state !== 'closed')
      || lot.state === filters.state
    const dateMatches = !filters.date || lot.date === filters.date
    const haystack = fold(`${lot.id} ${names.get(lot.productId) ?? ''}`)
    return stateMatches && dateMatches && (!search || haystack.includes(search))
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function closureDays<TDay extends PeriodDay, TLot extends PeriodLot>(days: TDay[], lots: TLot[]): TDay[] {
  const datesWithLots = new Set(lots.map((lot) => lot.date))
  return days.filter((day) => datesWithLots.has(day.date))
}

export function paginateItems<T>(items: T[], requestedPage: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageCount,
  }
}

function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function sumBy<T>(items: T[], select: (item: T) => number | null | undefined): number {
  return items.reduce((total, item) => total + (Number(select(item)) || 0), 0)
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}
