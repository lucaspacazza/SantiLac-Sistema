-- SantiLac Core - Testes
-- Modulo Producao: ordem de producao manual por data.

USE santilac_raw;

CREATE TABLE IF NOT EXISTS ordens_producao (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  codigo_ordem varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  data_ordem date NOT NULL,
  campos_json longtext COLLATE utf8mb4_unicode_ci NULL,
  origem varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  observacoes text COLLATE utf8mb4_unicode_ci NULL,
  created_at timestamp NULL DEFAULT NULL,
  updated_at timestamp NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_producao_ordens_codigo (codigo_ordem),
  UNIQUE KEY idx_producao_ordens_data (data_ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_codigo_ordem := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND COLUMN_NAME = 'codigo_ordem'
);

SET @add_codigo_ordem_sql := IF(
  @has_codigo_ordem = 0,
  'ALTER TABLE ordens_producao ADD COLUMN codigo_ordem varchar(32) COLLATE utf8mb4_unicode_ci NULL AFTER id',
  'SELECT 1'
);

PREPARE add_codigo_ordem_stmt FROM @add_codigo_ordem_sql;
EXECUTE add_codigo_ordem_stmt;
DEALLOCATE PREPARE add_codigo_ordem_stmt;

UPDATE ordens_producao
SET codigo_ordem = LOWER(CONCAT('op', DATE_FORMAT(data_ordem, '%Y%m%d')))
WHERE codigo_ordem IS NULL OR codigo_ordem = '';

ALTER TABLE ordens_producao
  MODIFY codigo_ordem varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL;

SET @has_idx_codigo := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND INDEX_NAME = 'idx_producao_ordens_codigo'
);

SET @add_idx_codigo_sql := IF(
  @has_idx_codigo = 0,
  'ALTER TABLE ordens_producao ADD UNIQUE KEY idx_producao_ordens_codigo (codigo_ordem)',
  'SELECT 1'
);

PREPARE add_idx_codigo_stmt FROM @add_idx_codigo_sql;
EXECUTE add_idx_codigo_stmt;
DEALLOCATE PREPARE add_idx_codigo_stmt;

SELECT 'ordens_producao_ok' AS status;
