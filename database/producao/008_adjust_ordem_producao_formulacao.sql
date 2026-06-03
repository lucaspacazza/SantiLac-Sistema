-- SantiLac Core - Testes
-- Modulo Producao: permite OP gerada por formulacao.

USE santilac_raw;

SET @has_formulacao_queijo_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND COLUMN_NAME = 'formulacao_queijo_id'
);

SET @add_formulacao_queijo_id_sql := IF(
  @has_formulacao_queijo_id = 0,
  'ALTER TABLE ordens_producao ADD COLUMN formulacao_queijo_id bigint unsigned NULL AFTER codigo_ordem',
  'SELECT 1'
);

PREPARE add_formulacao_queijo_id_stmt FROM @add_formulacao_queijo_id_sql;
EXECUTE add_formulacao_queijo_id_stmt;
DEALLOCATE PREPARE add_formulacao_queijo_id_stmt;

SET @has_unique_data := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND INDEX_NAME = 'idx_producao_ordens_data'
    AND NON_UNIQUE = 0
);

SET @drop_unique_data_sql := IF(
  @has_unique_data > 0,
  'ALTER TABLE ordens_producao DROP INDEX idx_producao_ordens_data',
  'SELECT 1'
);

PREPARE drop_unique_data_stmt FROM @drop_unique_data_sql;
EXECUTE drop_unique_data_stmt;
DEALLOCATE PREPARE drop_unique_data_stmt;

SET @has_idx_data := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND INDEX_NAME = 'idx_producao_ordens_data'
);

SET @add_idx_data_sql := IF(
  @has_idx_data = 0,
  'ALTER TABLE ordens_producao ADD KEY idx_producao_ordens_data (data_ordem)',
  'SELECT 1'
);

PREPARE add_idx_data_stmt FROM @add_idx_data_sql;
EXECUTE add_idx_data_stmt;
DEALLOCATE PREPARE add_idx_data_stmt;

SET @has_unique_formulacao := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND INDEX_NAME = 'idx_producao_ordens_formulacao'
);

SET @add_unique_formulacao_sql := IF(
  @has_unique_formulacao = 0,
  'ALTER TABLE ordens_producao ADD UNIQUE KEY idx_producao_ordens_formulacao (formulacao_queijo_id)',
  'SELECT 1'
);

PREPARE add_unique_formulacao_stmt FROM @add_unique_formulacao_sql;
EXECUTE add_unique_formulacao_stmt;
DEALLOCATE PREPARE add_unique_formulacao_stmt;

SELECT 'producao_ordens_formulacao_ok' AS status;
