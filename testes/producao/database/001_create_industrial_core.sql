PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS industrial_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_industrial_products_name ON industrial_products (name);
CREATE INDEX IF NOT EXISTS idx_industrial_products_category ON industrial_products (category);
CREATE INDEX IF NOT EXISTS idx_industrial_products_active ON industrial_products (active);

CREATE TABLE IF NOT EXISTS milk_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL UNIQUE,
  liters_received REAL NOT NULL DEFAULT 0 CHECK (liters_received >= 0),
  liters_processed REAL NOT NULL DEFAULT 0 CHECK (liters_processed >= 0),
  liters_to_cream REAL NOT NULL DEFAULT 0 CHECK (liters_to_cream >= 0),
  liters_surplus REAL NOT NULL DEFAULT 0 CHECK (liters_surplus >= 0),
  difference_liters REAL NOT NULL DEFAULT 0,
  milk_balance REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries (entry_date);

CREATE TABLE IF NOT EXISTS production_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_date TEXT NOT NULL,
  milk_entry_id INTEGER,
  liters_processed REAL NOT NULL DEFAULT 0 CHECK (liters_processed >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed', 'reopened', 'cancelled')),
  notes TEXT,
  closed_at TEXT,
  reopened_at TEXT,
  reopen_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (milk_entry_id) REFERENCES milk_entries (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_production_batches_date ON production_batches (batch_date);
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches (status);
CREATE INDEX IF NOT EXISTS idx_production_batches_milk_entry ON production_batches (milk_entry_id);

CREATE TABLE IF NOT EXISTS production_batch_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  production_type TEXT NOT NULL DEFAULT 'produced' CHECK (production_type IN ('produced', 'packed', 'fractioned', 'returned', 'loss', 'point', 'adjustment')),
  pieces_count REAL NOT NULL DEFAULT 0 CHECK (pieces_count >= 0),
  weight_kg REAL NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES industrial_products (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_production_batch_items_batch ON production_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_production_batch_items_product ON production_batch_items (product_id);
CREATE INDEX IF NOT EXISTS idx_production_batch_items_type ON production_batch_items (production_type);

CREATE TABLE IF NOT EXISTS production_calculation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL UNIQUE,
  liters_processed REAL NOT NULL DEFAULT 0,
  total_produced_kg REAL NOT NULL DEFAULT 0,
  yield_liters_per_kg REAL,
  yield_kg_per_liter REAL,
  average_piece_weight REAL,
  result_payload TEXT NOT NULL,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_calculation_results_batch ON production_calculation_results (batch_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'loss', 'return', 'inventory_adjustment')),
  origin_type TEXT NOT NULL CHECK (origin_type IN ('production', 'sale', 'manual_adjustment', 'physical_inventory')),
  origin_id INTEGER,
  movement_date TEXT NOT NULL,
  quantity_kg REAL NOT NULL DEFAULT 0 CHECK (quantity_kg >= 0),
  quantity_pieces REAL NOT NULL DEFAULT 0 CHECK (quantity_pieces >= 0),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES industrial_products (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements (movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_origin ON stock_movements (origin_type, origin_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movements_production_close
  ON stock_movements (origin_type, origin_id, product_id, movement_type)
  WHERE origin_type = 'production' AND movement_type = 'in';

CREATE TABLE IF NOT EXISTS production_batch_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_batch_audit_batch ON production_batch_audit_logs (batch_id);
