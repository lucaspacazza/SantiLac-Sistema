-- SantiLac Core - Testes
-- Módulo Produção: adiciona gordura inicial na formulação de queijo.

USE santilac_raw;

SET @has_gordura_inicial := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'producao_formulacoes_queijo'
    AND COLUMN_NAME = 'gordura_inicial'
);

SET @add_gordura_inicial_sql := IF(
  @has_gordura_inicial = 0,
  'ALTER TABLE producao_formulacoes_queijo ADD COLUMN gordura_inicial decimal(6,2) DEFAULT NULL AFTER peroxidase',
  'SELECT 1'
);

PREPARE add_gordura_inicial_stmt FROM @add_gordura_inicial_sql;
EXECUTE add_gordura_inicial_stmt;
DEALLOCATE PREPARE add_gordura_inicial_stmt;

SELECT 'producao_formulacao_queijo_gordura_inicial_ok' AS status;
