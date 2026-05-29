-- SantiLac Core - Testes
-- Módulo Laboratório: limpeza para manter somente uma tabela por formulário.

USE santilac_raw;

SET @has_itens_json := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'laboratorio_cronogramas'
    AND COLUMN_NAME = 'itens_json'
);
SET @add_itens_json_sql := IF(@has_itens_json = 0, 'ALTER TABLE laboratorio_cronogramas ADD COLUMN itens_json json DEFAULT NULL AFTER observacoes', 'SELECT 1');
PREPARE add_itens_json_stmt FROM @add_itens_json_sql;
EXECUTE add_itens_json_stmt;
DEALLOCATE PREPARE add_itens_json_stmt;

SET @has_itens_table := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'laboratorio_cronograma_itens'
);
SET @migrate_itens_sql := IF(@has_itens_table = 0, 'SELECT 1', '
  UPDATE laboratorio_cronogramas c
  SET itens_json = (
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
      ''produto'', i.produto,
      ''matriz'', i.matriz,
      ''mes'', i.mes,
      ''tipo_analise'', i.tipo_analise,
      ''ate_dia'', i.ate_dia,
      ''laboratorio_destino'', i.laboratorio_destino,
      ''status'', i.status,
      ''observacoes'', i.observacoes
    ))
    FROM laboratorio_cronograma_itens i
    WHERE i.cronograma_id = c.id
  )
  WHERE EXISTS (
    SELECT 1
    FROM laboratorio_cronograma_itens i
    WHERE i.cronograma_id = c.id
  )
');
PREPARE migrate_itens_stmt FROM @migrate_itens_sql;
EXECUTE migrate_itens_stmt;
DEALLOCATE PREPARE migrate_itens_stmt;

DROP TABLE IF EXISTS laboratorio_cronograma_itens;
DROP TABLE IF EXISTS laboratorio_parametros;
DROP TABLE IF EXISTS laboratorio_submodulos;

SELECT 'laboratorio_form_tables_minimas_ok' AS status;
