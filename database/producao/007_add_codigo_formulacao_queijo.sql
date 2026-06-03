-- SantiLac Core - Testes
-- Produção: código operacional da formulação de queijo.

USE santilac_raw;

ALTER TABLE producao_formulacoes_queijo
  ADD COLUMN codigo_formulacao varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER id;

UPDATE producao_formulacoes_queijo
SET codigo_formulacao = CONCAT(
  'FQ-',
  DATE_FORMAT(data_formulacao, '%Y%m%d'),
  '-',
  LPAD(id, 6, '0')
)
WHERE codigo_formulacao IS NULL OR codigo_formulacao = '';

CREATE UNIQUE INDEX idx_formulacoes_queijo_codigo
  ON producao_formulacoes_queijo (codigo_formulacao);

SELECT 'producao_codigo_formulacao_queijo_ok' AS status;
