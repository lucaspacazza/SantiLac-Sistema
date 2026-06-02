-- SantiLac Core
-- Modulo Pasteurizador: historico coletado diretamente do FieldLogger.
--
-- Banco alvo: santilac_raw.

USE santilac_raw;

CREATE TABLE IF NOT EXISTS pasteurizador_coletas (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  equipamento varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pasteurizador',
  origem varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fieldlogger_modbus',
  arquivo_remoto varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '2:/24085425/MemFlash.fl',
  arquivo_bruto_path varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  coletado_em datetime NOT NULL,
  bytes_baixados int unsigned NOT NULL DEFAULT 0,
  total_amostras int unsigned NOT NULL DEFAULT 0,
  status enum('rascunho','processada','erro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'processada',
  mensagem_erro text COLLATE utf8mb4_unicode_ci,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pasteurizador_coletas_coletado_em (coletado_em),
  KEY idx_pasteurizador_coletas_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pasteurizador_amostras (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  coleta_id bigint unsigned NOT NULL,
  equipamento varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pasteurizador',
  canal varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  unidade varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  sample_index int unsigned NOT NULL,
  raw_offset int unsigned DEFAULT NULL,
  timestamp_registro datetime DEFAULT NULL,
  valor decimal(12,4) NOT NULL,
  qualidade decimal(12,4) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pasteurizador_amostra_canal (coleta_id, canal, sample_index),
  KEY idx_pasteurizador_amostras_canal (canal),
  KEY idx_pasteurizador_amostras_timestamp (timestamp_registro),
  CONSTRAINT fk_pasteurizador_amostras_coleta
    FOREIGN KEY (coleta_id) REFERENCES pasteurizador_coletas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'pasteurizador_core_schema_ok' AS status;
