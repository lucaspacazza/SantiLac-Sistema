export type IndustrialProduct = {
  id: number
  code: string
  name: string
  category: string
  unit: string
  active: boolean
  created_at: string
  updated_at: string
}

export type MilkEntry = {
  id: number
  entry_date: string
  liters_received: number
  liters_processed: number
  liters_to_cream: number
  liters_surplus: number
  difference_liters: number
  milk_balance: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProductionBatchItem = {
  id: number
  production_batch_id: number
  product_id: number
  production_type: 'produced' | 'packed' | 'fractioned' | 'returned' | 'loss' | 'point' | 'adjustment'
  pieces_count: number
  weight_kg: number
  notes: string | null
  product?: IndustrialProduct
}

export type ProductionCalculation = {
  liters_processed: number
  total_produced_kg: number
  yield_liters_per_kg: number | null
  yield_kg_per_liter: number | null
  average_piece_weight: number | null
  items: unknown[]
  stock_movements: unknown[]
}

export type ProductionBatch = {
  id: number
  batch_date: string
  batch_code: string
  milk_entry_id: number | null
  liters_processed: number
  status: 'draft' | 'closed' | 'reopened' | 'cancelled'
  notes: string | null
  items?: ProductionBatchItem[]
  calculation?: ProductionCalculation | null
  created_at: string
  updated_at: string
}

export type StockItem = {
  product_id: number
  balance_kg: number
  balance_pieces: number
  product: IndustrialProduct | null
}

export type StockMovement = {
  id: number
  product_id: number
  movement_date: string
  movement_type: 'in' | 'out' | 'adjustment' | 'loss' | 'return' | 'inventory_adjustment'
  origin_type: 'production' | 'sale' | 'manual_adjustment' | 'physical_inventory'
  quantity_kg: number
  quantity_pieces: number
  notes: string | null
  product?: IndustrialProduct
}

export type DailyReportBatch = {
  id: number
  batch_date: string
  batch_code: string
  liters_processed: number
  status: string
  total_produced_kg: number | null
  yield_liters_per_kg: number | null
  items: ProductionBatchItem[]
}

export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  } | null
  meta: Record<string, unknown>
}
