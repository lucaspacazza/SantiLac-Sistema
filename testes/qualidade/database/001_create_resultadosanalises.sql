-- SantiLac Core - Qualidade
-- Estrutura de análise baseada na tabela resultadosanalises do SantiLac V3.
--
-- Banco esperado no teste do módulo:
--   santilac_raw
--
-- Observação:
--   este script é referência do módulo. Não foi executado automaticamente.

CREATE TABLE IF NOT EXISTS resultadosanalises (
  id INT NOT NULL AUTO_INCREMENT,
  produtor_codigo INT NOT NULL,
  data DATE NOT NULL,
  gordura DECIMAL(4, 2) DEFAULT NULL,
  proteina DECIMAL(4, 2) DEFAULT NULL,
  lactose DECIMAL(4, 2) DEFAULT NULL,
  solidos_totais DECIMAL(4, 2) DEFAULT NULL,
  ccs INT DEFAULT NULL,
  ufc INT DEFAULT NULL,
  caseina DECIMAL(4, 2) DEFAULT NULL,
  sng DECIMAL(4, 2) DEFAULT NULL,
  ureia DECIMAL(4, 2) DEFAULT NULL,
  antibiotico DECIMAL(4, 2) DEFAULT NULL,
  bacteria DECIMAL(4, 2) DEFAULT NULL,
  temperatura DECIMAL(4, 2) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_resultadosanalises_produtor (produtor_codigo),
  KEY idx_resultadosanalises_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
