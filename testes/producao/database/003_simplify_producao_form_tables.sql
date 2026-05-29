-- SantiLac Core - Testes
-- Módulo Produção: limpeza para manter somente uma tabela por formulário.

USE santilac_raw;

SET @fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'producao_formulacoes_queijo'
    AND REFERENCED_TABLE_NAME = 'producao_ordens'
  LIMIT 1
);
SET @drop_fk_sql := IF(@fk_name IS NULL, 'SELECT 1', CONCAT('ALTER TABLE producao_formulacoes_queijo DROP FOREIGN KEY ', @fk_name));
PREPARE drop_fk_stmt FROM @drop_fk_sql;
EXECUTE drop_fk_stmt;
DEALLOCATE PREPARE drop_fk_stmt;

SET @has_ordem_column := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'producao_formulacoes_queijo'
    AND COLUMN_NAME = 'ordem_producao_id'
);
SET @drop_ordem_column_sql := IF(@has_ordem_column = 0, 'SELECT 1', 'ALTER TABLE producao_formulacoes_queijo DROP COLUMN ordem_producao_id');
PREPARE drop_ordem_column_stmt FROM @drop_ordem_column_sql;
EXECUTE drop_ordem_column_stmt;
DEALLOCATE PREPARE drop_ordem_column_stmt;

SET @has_insumos_json := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'producao_formulacoes_queijo'
    AND COLUMN_NAME = 'insumos_json'
);
SET @add_insumos_json_sql := IF(@has_insumos_json = 0, 'ALTER TABLE producao_formulacoes_queijo ADD COLUMN insumos_json json DEFAULT NULL AFTER observacoes', 'SELECT 1');
PREPARE add_insumos_json_stmt FROM @add_insumos_json_sql;
EXECUTE add_insumos_json_stmt;
DEALLOCATE PREPARE add_insumos_json_stmt;

SET @has_insumos_table := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'producao_formulacao_queijo_insumos'
);
SET @migrate_insumos_sql := IF(@has_insumos_table = 0, 'SELECT 1', '
  UPDATE producao_formulacoes_queijo f
  SET insumos_json = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
      ''tipo_insumo'', i.tipo_insumo,
      ''nome_insumo'', i.nome_insumo,
      ''quantidade'', i.quantidade,
      ''unidade'', i.unidade,
      ''lote_insumo'', i.lote_insumo
    ))
    FROM producao_formulacao_queijo_insumos i
    WHERE i.formulacao_queijo_id = f.id
  )
  WHERE EXISTS (
    SELECT 1
    FROM producao_formulacao_queijo_insumos i
    WHERE i.formulacao_queijo_id = f.id
  )
');
PREPARE migrate_insumos_stmt FROM @migrate_insumos_sql;
EXECUTE migrate_insumos_stmt;
DEALLOCATE PREPARE migrate_insumos_stmt;

UPDATE producao_formulacoes_queijo
SET status = 'rascunho'
WHERE status IN ('preenchida','conferida');

ALTER TABLE producao_formulacoes_queijo
  MODIFY status enum('rascunho','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho';

DROP TABLE IF EXISTS producao_formulacao_queijo_insumos;
DROP TABLE IF EXISTS producao_ordens;
DROP TABLE IF EXISTS producao_submodulos;

SELECT 'producao_form_tables_minimas_ok' AS status;
