import type {
  DailyReportBatch,
  IndustrialProduct,
  MilkEntry,
  ProductionBatch,
  ProductionBatchItem,
  StockItem,
  StockMovement,
} from '../types/industrial'

const BASE = '/api/industrial'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...options,
  })
  const json: { success: boolean; data: T; error: { message: string } | null } = await res.json()
  if (!json.success) {
    throw new Error(json.error?.message ?? `Erro ${res.status}`)
  }
  return json.data
}

export const industrialApi = {
  products: {
    list: (params?: { q?: string; active?: boolean }) => {
      const qs = new URLSearchParams()
      if (params?.q) qs.set('q', params.q)
      if (params?.active !== undefined) qs.set('active', params.active ? '1' : '0')
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return request<{ items: IndustrialProduct[] }>(`/products${query}`)
    },
  },

  milkEntries: {
    list: (params?: { date_from?: string; date_to?: string }) => {
      const qs = new URLSearchParams()
      if (params?.date_from) qs.set('date_from', params.date_from)
      if (params?.date_to) qs.set('date_to', params.date_to)
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return request<{ items: MilkEntry[] }>(`/milk-entries${query}`)
    },
    get: (id: number) =>
      request<MilkEntry>(`/milk-entries/${id}`),
    create: (payload: {
      entry_date: string
      liters_received: number
      liters_processed: number
      liters_to_cream: number
      liters_surplus: number
      notes?: string
    }) =>
      request<MilkEntry>('/milk-entries', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: number, payload: {
      entry_date: string
      liters_received: number
      liters_processed: number
      liters_to_cream: number
      liters_surplus: number
      notes?: string
    }) =>
      request<MilkEntry>(`/milk-entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  },

  batches: {
    list: (params?: { date_from?: string; date_to?: string; status?: string }) => {
      const qs = new URLSearchParams()
      if (params?.date_from) qs.set('date_from', params.date_from)
      if (params?.date_to) qs.set('date_to', params.date_to)
      if (params?.status) qs.set('status', params.status)
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return request<{ items: ProductionBatch[] }>(`/production-batches${query}`)
    },
    get: (id: number) =>
      request<ProductionBatch>(`/production-batches/${id}`),
    create: (payload: {
      batch_date: string
      milk_entry_id?: number
      liters_processed: number
      notes?: string
    }) =>
      request<ProductionBatch>('/production-batches', {
        method: 'POST',
        body: JSON.stringify({ ...payload, status: 'draft' }),
      }),
    addItem: (batchId: number, payload: {
      product_id: number
      production_type: string
      pieces_count: number
      weight_kg: number
      notes?: string
    }) =>
      request<ProductionBatchItem>(`/production-batches/${batchId}/items`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteItem: (itemId: number) =>
      request<void>(`/production-items/${itemId}`, { method: 'DELETE' }),
    recalculate: (batchId: number) =>
      request<ProductionBatch>(`/production-batches/${batchId}/recalculate`, { method: 'POST' }),
    close: (batchId: number) =>
      request<ProductionBatch>(`/production-batches/${batchId}/close`, { method: 'POST' }),
    reopen: (batchId: number, reason: string) =>
      request<ProductionBatch>(`/production-batches/${batchId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },

  stock: {
    balance: () =>
      request<{ items: StockItem[] }>('/stock'),
    movements: (params?: { date_from?: string; date_to?: string; product_id?: number }) => {
      const qs = new URLSearchParams()
      if (params?.date_from) qs.set('date_from', params.date_from)
      if (params?.date_to) qs.set('date_to', params.date_to)
      if (params?.product_id) qs.set('product_id', String(params.product_id))
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return request<{ items: StockMovement[] }>(`/stock/movements${query}`)
    },
  },

  reports: {
    dailyProduction: (params?: { date_from?: string; date_to?: string }) => {
      const qs = new URLSearchParams()
      if (params?.date_from) qs.set('date_from', params.date_from)
      if (params?.date_to) qs.set('date_to', params.date_to)
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return request<{ items: DailyReportBatch[] }>(`/reports/daily-production${query}`)
    },
  },
}
