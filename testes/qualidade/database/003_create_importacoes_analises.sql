-- SantiLac Core - Qualidade
-- Auditoria das importacoes de analises laboratoriais.
--
-- Banco esperado no teste do modulo:
--   santilac_raw

CREATE TABLE IF NOT EXISTS importacoes_analises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  arquivo_nome_original VARCHAR(255) NOT NULL,
  arquivo_caminho_storage VARCHAR(500) NOT NULL,
  arquivo_hash CHAR(64) NOT NULL,
  usuario_id BIGINT UNSIGNED DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'received',
  ja_importado TINYINT(1) NOT NULL DEFAULT 0,
  total_linhas INT UNSIGNED NOT NULL DEFAULT 0,
  linhas_validas INT UNSIGNED NOT NULL DEFAULT 0,
  linhas_com_erro INT UNSIGNED NOT NULL DEFAULT 0,
  registros_criados INT UNSIGNED NOT NULL DEFAULT 0,
  registros_completados INT UNSIGNED NOT NULL DEFAULT 0,
  registros_sem_mudanca INT UNSIGNED NOT NULL DEFAULT 0,
  erro_codigo VARCHAR(40) DEFAULT NULL,
  erro_mensagem TEXT DEFAULT NULL,
  processor_summary JSON DEFAULT NULL,
  processor_errors JSON DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_importacoes_analises_hash (arquivo_hash),
  KEY idx_importacoes_analises_status (status),
  KEY idx_importacoes_analises_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
