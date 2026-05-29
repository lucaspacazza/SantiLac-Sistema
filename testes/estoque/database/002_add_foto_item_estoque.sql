-- SantiLac Core - Testes
-- Módulo Estoque: foto do item.

USE santilac_raw;

SET @has_foto_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'estoque'
    AND COLUMN_NAME = 'foto_path'
);

SET @add_foto_path_sql := IF(
  @has_foto_path = 0,
  'ALTER TABLE estoque ADD COLUMN foto_path varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER descricao',
  'SELECT 1'
);

PREPARE add_foto_path_stmt FROM @add_foto_path_sql;
EXECUTE add_foto_path_stmt;
DEALLOCATE PREPARE add_foto_path_stmt;

SELECT 'estoque_item_foto_ok' AS status;
