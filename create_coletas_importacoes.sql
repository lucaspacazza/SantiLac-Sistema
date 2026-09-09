CREATE TABLE IF NOT EXISTS `coletas_importacoes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `arquivo_nome` VARCHAR(255) NOT NULL,
  `arquivo_caminho` VARCHAR(255) NOT NULL,
  `arquivo_hash` CHAR(64) NOT NULL,
  `registros_lidos` INT UNSIGNED NOT NULL DEFAULT 0,
  `registros_criados` INT UNSIGNED NOT NULL DEFAULT 0,
  `registros_ignorados` INT UNSIGNED NOT NULL DEFAULT 0,
  `litros_lidos` DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  `resumo` JSON NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coletas_importacoes_arquivo_hash_unique` (`arquivo_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
