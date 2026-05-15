-- SantiLac Core
-- Auditoria operacional do sistema.
--
-- Registra login, logout, importações, exportações, edições e demais ações
-- operacionais. Navegação entre telas não entra aqui.

USE santilac_raw;

CREATE TABLE IF NOT EXISTS logs (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  usuario_id bigint unsigned DEFAULT NULL,
  usuario_nome varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  usuario_email varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  modulo varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  acao varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  entidade varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  entidade_id varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  descricao varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  metodo varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  rota varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ip varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  user_agent varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  status_code smallint unsigned DEFAULT NULL,
  contexto json DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_usuario (usuario_id),
  KEY idx_logs_modulo_acao (modulo, acao),
  KEY idx_logs_entidade (entidade, entidade_id),
  KEY idx_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
