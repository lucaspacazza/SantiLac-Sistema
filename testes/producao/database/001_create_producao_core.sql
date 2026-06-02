-- SantiLac Core - Testes
-- Módulo Produção: schema mínimo da Formulação de Queijo.
--
-- Regra: uma tabela por formulário. Listas internas do formulário ficam em JSON na própria tabela.

USE santilac_raw;

DROP TABLE IF EXISTS producao_formulacao_queijo_insumos;
DROP TABLE IF EXISTS producao_formulacoes_queijo;
DROP TABLE IF EXISTS producao_ordens;
DROP TABLE IF EXISTS producao_submodulos;

CREATE TABLE producao_formulacoes_queijo (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  codigo_formulacao varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  documento_codigo varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLAN_6.3',
  documento_nome varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Controle de formulação do queijo',
  documento_revisao varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  tipo_queijo varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  data_formulacao date NOT NULL,
  silo varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  lote_leite varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  lote_queijo varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  numero_queijomatic varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  inicio_enchimento time DEFAULT NULL,
  quantidade_leite decimal(12,3) DEFAULT NULL,
  temperatura_pasteurizacao decimal(6,2) DEFAULT NULL,
  fosfatase enum('negativo','positivo','nao_aplicavel') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  peroxidase enum('negativo','positivo','nao_aplicavel') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  gordura_final decimal(6,2) DEFAULT NULL,
  acidez decimal(6,2) DEFAULT NULL,
  temperatura_coagulacao decimal(6,2) DEFAULT NULL,
  hora_coagulacao time DEFAULT NULL,
  hora_corte time DEFAULT NULL,
  temperatura_cozimento decimal(6,2) DEFAULT NULL,
  responsavel_id bigint unsigned DEFAULT NULL,
  status enum('rascunho','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  observacoes text COLLATE utf8mb4_unicode_ci,
  insumos_json json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_formulacoes_queijo_codigo (codigo_formulacao),
  KEY idx_formulacoes_queijo_lote (lote_queijo),
  KEY idx_formulacoes_queijo_data (data_formulacao),
  KEY idx_formulacoes_queijo_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'producao_core_schema_minimo_ok' AS status;
