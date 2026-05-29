-- SantiLac Core - Testes
-- Módulo Laboratório: schema mínimo do Cronograma de Análises.
--
-- Regra: uma tabela por formulário. Listas internas do formulário ficam em JSON na própria tabela.

USE santilac_raw;

DROP TABLE IF EXISTS laboratorio_cronograma_itens;
DROP TABLE IF EXISTS laboratorio_cronogramas;
DROP TABLE IF EXISTS laboratorio_parametros;
DROP TABLE IF EXISTS laboratorio_submodulos;

CREATE TABLE laboratorio_cronogramas (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  documento_codigo varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLAN_6.1',
  documento_nome varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cronograma de análises de produtos mensais',
  documento_revisao varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ano smallint unsigned NOT NULL,
  titulo varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Cronograma de análises de produtos mensais',
  responsavel_tecnico_id bigint unsigned DEFAULT NULL,
  status enum('rascunho','ativo','encerrado','cancelado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  observacoes text COLLATE utf8mb4_unicode_ci,
  itens_json json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_laboratorio_cronogramas_ano (ano),
  KEY idx_laboratorio_cronogramas_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'laboratorio_core_schema_minimo_ok' AS status;
