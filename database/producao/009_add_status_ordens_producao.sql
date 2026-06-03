-- SantiLac Core - Testes
-- Modulo Producao: status da ordem de producao.

USE santilac_raw;

SET @has_status_ordem := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
    AND COLUMN_NAME = 'status'
);

SET @add_status_ordem_sql := IF(
  @has_status_ordem = 0,
  'ALTER TABLE ordens_producao ADD COLUMN status enum(''rascunho'',''finalizada'',''cancelada'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''rascunho'' AFTER origem',
  'SELECT 1'
);

PREPARE add_status_ordem_stmt FROM @add_status_ordem_sql;
EXECUTE add_status_ordem_stmt;
DEALLOCATE PREPARE add_status_ordem_stmt;

UPDATE ordens_producao
SET status = 'finalizada'
WHERE origem = 'automatica';

SELECT 'producao_ordens_status_ok' AS status;
