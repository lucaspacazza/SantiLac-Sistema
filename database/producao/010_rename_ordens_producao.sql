-- SantiLac Core - Testes
-- Modulo Producao: tabela de ordens de producao com nome final.

USE santilac_raw;

SET @has_old_ordens := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'producao_ordens_producao'
);

SET @has_new_ordens := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ordens_producao'
);

SET @rename_ordens_sql := IF(
  @has_old_ordens = 1 AND @has_new_ordens = 0,
  'RENAME TABLE producao_ordens_producao TO ordens_producao',
  'SELECT 1'
);

PREPARE rename_ordens_stmt FROM @rename_ordens_sql;
EXECUTE rename_ordens_stmt;
DEALLOCATE PREPARE rename_ordens_stmt;

SELECT 'ordens_producao_nome_ok' AS status;
