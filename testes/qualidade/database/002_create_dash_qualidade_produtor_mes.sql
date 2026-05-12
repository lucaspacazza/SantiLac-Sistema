-- SantiLac Core - Laboratorio Qualidade
-- Agregado mensal futuro para dashboards e relatorios.
--
-- Banco esperado:
--   santilac_clean

CREATE TABLE IF NOT EXISTS dash_qualidade_produtor_mes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  produtor_codigo VARCHAR(30) NOT NULL,
  ano SMALLINT UNSIGNED NOT NULL,
  mes TINYINT UNSIGNED NOT NULL,
  total_analises INT UNSIGNED NOT NULL DEFAULT 0,
  media_gordura DECIMAL(8, 3) NULL,
  media_proteina DECIMAL(8, 3) NULL,
  media_lactose DECIMAL(8, 3) NULL,
  media_solidos_totais DECIMAL(8, 3) NULL,
  media_ccs DECIMAL(12, 3) NULL,
  media_ufc DECIMAL(12, 3) NULL,
  media_caseina DECIMAL(8, 3) NULL,
  media_sng DECIMAL(8, 3) NULL,
  media_ureia DECIMAL(8, 3) NULL,
  total_antibiotico_pos INT UNSIGNED NOT NULL DEFAULT 0,
  total_bacteria_pos INT UNSIGNED NOT NULL DEFAULT 0,
  ultima_analise_em DATE NULL,
  calculated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dash_qualidade_produtor_mes (produtor_codigo, ano, mes),
  KEY idx_dash_qualidade_periodo (ano, mes),
  KEY idx_dash_qualidade_produtor (produtor_codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
