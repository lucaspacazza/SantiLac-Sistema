USE santilac_raw;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expedicao_ordens (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  codigo varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  cliente varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  destino varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  data_prevista date DEFAULT NULL,
  placa varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  motorista varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  observacoes text COLLATE utf8mb4_unicode_ci,
  status enum('rascunho','lancada','carregando','concluida','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'rascunho',
  paletes_total int unsigned NOT NULL DEFAULT 0,
  caixas_total int unsigned NOT NULL DEFAULT 0,
  peso_total decimal(14,3) NOT NULL DEFAULT 0.000,
  criado_por bigint unsigned NOT NULL,
  lancado_por bigint unsigned DEFAULT NULL,
  iniciado_por bigint unsigned DEFAULT NULL,
  concluido_por bigint unsigned DEFAULT NULL,
  cancelado_por bigint unsigned DEFAULT NULL,
  lancada_at timestamp NULL DEFAULT NULL,
  iniciada_at timestamp NULL DEFAULT NULL,
  concluida_at timestamp NULL DEFAULT NULL,
  cancelada_at timestamp NULL DEFAULT NULL,
  cancelamento_snapshot json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_expedicao_ordens_codigo (codigo),
  KEY idx_expedicao_ordens_status (status),
  KEY idx_expedicao_ordens_data_prevista (data_prevista)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expedicao_ordem_paletes (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  ordem_id bigint unsigned NOT NULL,
  palete_id bigint unsigned NOT NULL,
  status enum('reservado','carregado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reservado',
  escaneado_por bigint unsigned DEFAULT NULL,
  escaneado_at timestamp NULL DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_expedicao_ordem_palete (ordem_id, palete_id),
  UNIQUE KEY uk_expedicao_palete_unico (palete_id),
  KEY idx_expedicao_ordem_paletes_status (ordem_id, status),
  CONSTRAINT fk_expedicao_ordem_paletes_ordem
    FOREIGN KEY (ordem_id) REFERENCES expedicao_ordens (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_cancelado_por := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expedicao_ordens'
    AND COLUMN_NAME = 'cancelado_por'
);
SET @sql_cancelado_por := IF(
  @has_cancelado_por = 0,
  "ALTER TABLE expedicao_ordens ADD COLUMN cancelado_por bigint unsigned DEFAULT NULL AFTER concluido_por",
  "SELECT 1"
);
PREPARE stmt_cancelado_por FROM @sql_cancelado_por;
EXECUTE stmt_cancelado_por;
DEALLOCATE PREPARE stmt_cancelado_por;

SET @has_cancelamento_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expedicao_ordens'
    AND COLUMN_NAME = 'cancelamento_snapshot'
);
SET @sql_cancelamento_snapshot := IF(
  @has_cancelamento_snapshot = 0,
  "ALTER TABLE expedicao_ordens ADD COLUMN cancelamento_snapshot json DEFAULT NULL AFTER cancelada_at",
  "SELECT 1"
);
PREPARE stmt_cancelamento_snapshot FROM @sql_cancelamento_snapshot;
EXECUTE stmt_cancelamento_snapshot;
DEALLOCATE PREPARE stmt_cancelamento_snapshot;

SET @has_expedicao_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'embalagem_paletes'
    AND COLUMN_NAME = 'expedicao_status'
);
SET @sql_expedicao_status := IF(
  @has_expedicao_status = 0,
  "ALTER TABLE embalagem_paletes ADD COLUMN expedicao_status enum('estoque','reservado','expedido') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'estoque' AFTER status",
  "SELECT 1"
);
PREPARE stmt_expedicao_status FROM @sql_expedicao_status;
EXECUTE stmt_expedicao_status;
DEALLOCATE PREPARE stmt_expedicao_status;

SET @has_expedicao_status_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'embalagem_paletes'
    AND INDEX_NAME = 'idx_embalagem_paletes_expedicao_status'
);
SET @sql_expedicao_status_idx := IF(
  @has_expedicao_status_idx = 0,
  "ALTER TABLE embalagem_paletes ADD KEY idx_embalagem_paletes_expedicao_status (expedicao_status)",
  "SELECT 1"
);
PREPARE stmt_expedicao_status_idx FROM @sql_expedicao_status_idx;
EXECUTE stmt_expedicao_status_idx;
DEALLOCATE PREPARE stmt_expedicao_status_idx;

UPDATE embalagem_paletes p
INNER JOIN expedicao_ordem_paletes eop ON eop.palete_id = p.id
INNER JOIN expedicao_ordens eo ON eo.id = eop.ordem_id
SET p.expedicao_status = CASE
  WHEN eo.status = 'concluida' THEN 'expedido'
  ELSE 'reservado'
END
WHERE eo.status IN ('rascunho', 'lancada', 'carregando', 'concluida');

SELECT 'expedicao_core_ok' AS status;
