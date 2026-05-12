-- SantiLac Core - Laboratorio Qualidade
-- Tabela validada de analises laboratoriais.
--
-- Banco esperado:
--   santilac_clean
--
-- Esta tabela mantem o nome funcional do V3 no primeiro ciclo.

CREATE TABLE IF NOT EXISTS resultadosanalises (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  produtor_codigo VARCHAR(30) NOT NULL,
  data DATE NOT NULL,
  gordura DECIMAL(8, 3) NULL,
  proteina DECIMAL(8, 3) NULL,
  lactose DECIMAL(8, 3) NULL,
  solidos_totais DECIMAL(8, 3) NULL,
  ccs INT UNSIGNED NULL,
  ufc INT UNSIGNED NULL,
  caseina DECIMAL(8, 3) NULL,
  sng DECIMAL(8, 3) NULL,
  ureia DECIMAL(8, 3) NULL,
  antibiotico DECIMAL(8, 3) NULL,
  bacteria DECIMAL(8, 3) NULL,
  temperatura DECIMAL(8, 3) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resultadosanalises_produtor_data (produtor_codigo, data),
  KEY idx_resultadosanalises_produtor (produtor_codigo),
  KEY idx_resultadosanalises_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
