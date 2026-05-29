-- SantiLac Core - Testes
-- Módulo Laboratório: demais formulários do PAC 06.
--
-- Regra: uma tabela por formulário. Não criar tabela para submódulo ou menu.

USE santilac_raw;

CREATE TABLE IF NOT EXISTS laboratorio_agua_filagem (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  documento_codigo varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PLAN_6.4',
  documento_nome varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Monitoramento água de filagem',
  data_monitoramento date NOT NULL,
  sequencia tinyint unsigned DEFAULT NULL,
  hora time DEFAULT NULL,
  acidez decimal(6,2) DEFAULT NULL,
  gordura decimal(6,2) DEFAULT NULL,
  ph decimal(4,2) DEFAULT NULL,
  responsavel varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  responsavel_id bigint unsigned DEFAULT NULL,
  status enum('rascunho','finalizada','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  observacoes text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_laboratorio_agua_filagem_data (data_monitoramento),
  KEY idx_laboratorio_agua_filagem_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'laboratorio_demais_formularios_ok' AS status;
