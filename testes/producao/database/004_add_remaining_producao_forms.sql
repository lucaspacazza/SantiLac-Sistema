-- SantiLac Core - Testes
-- Módulo Produção: demais formulários do PAC 06.
--
-- Regra: uma tabela por formulário. Não criar tabela para submódulo, menu ou não conformidade.

USE santilac_raw;

CREATE TABLE IF NOT EXISTS producao_soro_refrigerado (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  documento_codigo varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLAN_6.7',
  documento_nome varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Controle de Produção de Soro Refrigerado',
  data_registro date NOT NULL,
  entrada_diaria_estoque decimal(12,3) DEFAULT NULL,
  estoque_total decimal(12,3) DEFAULT NULL,
  litragem_vendida decimal(12,3) DEFAULT NULL,
  sobra_estoque decimal(12,3) DEFAULT NULL,
  silo_armazenado varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  responsavel varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  responsavel_id bigint unsigned DEFAULT NULL,
  status enum('rascunho','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  observacoes text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_producao_soro_data (data_registro),
  KEY idx_producao_soro_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS producao_formulacoes_creme (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  documento_codigo varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLAN_6.9',
  documento_nome varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Controle de Formulação Creme',
  responsavel_monitoramento varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  mes tinyint unsigned DEFAULT NULL,
  ano smallint unsigned DEFAULT NULL,
  tipo_creme varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  data_fabricacao date NOT NULL,
  lote_creme_produzido varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  gordura_inicial decimal(6,2) DEFAULT NULL,
  gordura_final decimal(6,2) DEFAULT NULL,
  acidez decimal(6,2) DEFAULT NULL,
  responsavel varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  responsavel_id bigint unsigned DEFAULT NULL,
  status enum('rascunho','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  observacoes text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_producao_formulacoes_creme_data (data_fabricacao),
  KEY idx_producao_formulacoes_creme_lote (lote_creme_produzido),
  KEY idx_producao_formulacoes_creme_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS producao_creme (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  documento_codigo varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLAN_6.10',
  documento_nome varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Controle de Produção Creme',
  responsavel_monitoramento varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  mes tinyint unsigned DEFAULT NULL,
  ano smallint unsigned DEFAULT NULL,
  tipo_creme varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  data_fabricacao date NOT NULL,
  lote_creme_produzido varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  quantidade_produzida_kg decimal(12,3) DEFAULT NULL,
  responsavel varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  responsavel_id bigint unsigned DEFAULT NULL,
  status enum('rascunho','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  observacoes text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_producao_creme_data (data_fabricacao),
  KEY idx_producao_creme_lote (lote_creme_produzido),
  KEY idx_producao_creme_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'producao_demais_formularios_ok' AS status;
