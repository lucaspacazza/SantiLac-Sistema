SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS industrial_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_industrial_products_name (name),
  INDEX idx_industrial_products_category (category),
  INDEX idx_industrial_products_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS milk_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL UNIQUE,
  liters_received DECIMAL(12,3) NOT NULL DEFAULT 0,
  liters_processed DECIMAL(12,3) NOT NULL DEFAULT 0,
  liters_to_cream DECIMAL(12,3) NOT NULL DEFAULT 0,
  liters_surplus DECIMAL(12,3) NOT NULL DEFAULT 0,
  difference_liters DECIMAL(12,3) NOT NULL DEFAULT 0,
  milk_balance DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_milk_entries_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_date DATE NOT NULL,
  milk_entry_id BIGINT UNSIGNED NULL,
  liters_processed DECIMAL(12,3) NOT NULL DEFAULT 0,
  status ENUM('draft', 'closed', 'reopened', 'cancelled') NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  closed_at DATETIME NULL,
  reopened_at DATETIME NULL,
  reopen_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_production_batches_date (batch_date),
  INDEX idx_production_batches_status (status),
  INDEX idx_production_batches_milk_entry (milk_entry_id),
  CONSTRAINT fk_production_batches_milk_entry FOREIGN KEY (milk_entry_id) REFERENCES milk_entries (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_batch_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  production_type ENUM('produced', 'packed', 'fractioned', 'returned', 'loss', 'point', 'adjustment') NOT NULL DEFAULT 'produced',
  pieces_count DECIMAL(12,3) NOT NULL DEFAULT 0,
  weight_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_production_batch_items_batch (batch_id),
  INDEX idx_production_batch_items_product (product_id),
  INDEX idx_production_batch_items_type (production_type),
  CONSTRAINT fk_production_batch_items_batch FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE,
  CONSTRAINT fk_production_batch_items_product FOREIGN KEY (product_id) REFERENCES industrial_products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_calculation_results (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL UNIQUE,
  liters_processed DECIMAL(12,3) NOT NULL DEFAULT 0,
  total_produced_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  yield_liters_per_kg DECIMAL(12,6) NULL,
  yield_kg_per_liter DECIMAL(12,6) NULL,
  average_piece_weight DECIMAL(12,6) NULL,
  result_payload JSON NOT NULL,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_production_calculation_results_batch (batch_id),
  CONSTRAINT fk_production_calculation_results_batch FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('in', 'out', 'adjustment', 'loss', 'return', 'inventory_adjustment') NOT NULL,
  origin_type ENUM('production', 'sale', 'manual_adjustment', 'physical_inventory') NOT NULL,
  origin_id BIGINT UNSIGNED NULL,
  movement_date DATE NOT NULL,
  quantity_kg DECIMAL(12,3) NOT NULL DEFAULT 0,
  quantity_pieces DECIMAL(12,3) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stock_movements_product (product_id),
  INDEX idx_stock_movements_date (movement_date),
  INDEX idx_stock_movements_origin (origin_type, origin_id),
  UNIQUE KEY uq_stock_movements_production_close (origin_type, origin_id, product_id, movement_type),
  CONSTRAINT fk_stock_movements_product FOREIGN KEY (product_id) REFERENCES industrial_products (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS production_batch_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(60) NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_production_batch_audit_batch (batch_id),
  CONSTRAINT fk_production_batch_audit_batch FOREIGN KEY (batch_id) REFERENCES production_batches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
