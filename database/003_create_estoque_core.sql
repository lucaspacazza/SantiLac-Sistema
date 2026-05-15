-- SantiLac Core
-- Estoque simplificado para bancada do m?dulo.
--
-- Regra atual:
--   - estoque: cadastro do item e saldo atual.
--   - estoque_logs: hist?rico das entradas, sa?das e ajustes.
--
-- Origem dos itens:
--   SantiLac_V3/database/schema/santilac_db.sql
--
-- A coluna antiga custo_unitario_exato n?o entra no Core.

USE santilac_raw;

DROP TABLE IF EXISTS raw_estoque_eventos;
DROP TABLE IF EXISTS estoque_saldos;
DROP TABLE IF EXISTS estoque_movimentos;
DROP TABLE IF EXISTS estoque_lotes;
DROP TABLE IF EXISTS estoque_itens;
DROP TABLE IF EXISTS estoque_locais;
DROP TABLE IF EXISTS estoque_categorias;
DROP TABLE IF EXISTS estoque_logs;
DROP TABLE IF EXISTS estoque;

CREATE TABLE estoque (
  id int NOT NULL AUTO_INCREMENT,
  codigo varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  nome varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  categoria varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  descricao text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  unidade varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  saldo_atual decimal(12,3) NOT NULL DEFAULT 0.000,
  estoque_minimo decimal(12,3) NOT NULL DEFAULT 5.000,
  ativo tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estoque_codigo (codigo),
  KEY idx_estoque_nome (nome),
  KEY idx_estoque_categoria (categoria),
  KEY idx_estoque_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE estoque_logs (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  estoque_id int NOT NULL,
  tipo enum('entrada','saida','ajuste') COLLATE utf8mb4_unicode_ci NOT NULL,
  quantidade decimal(12,3) NOT NULL,
  saldo_antes decimal(12,3) NOT NULL DEFAULT 0.000,
  saldo_depois decimal(12,3) NOT NULL DEFAULT 0.000,
  data_movimento date NOT NULL,
  documento varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  motivo varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  observacao text COLLATE utf8mb4_unicode_ci,
  usuario_id bigint unsigned DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_estoque_logs_estoque (estoque_id),
  KEY idx_estoque_logs_tipo (tipo),
  KEY idx_estoque_logs_data (data_movimento),
  CONSTRAINT fk_estoque_logs_estoque
    FOREIGN KEY (estoque_id) REFERENCES estoque (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO estoque (`id`, `codigo`, `nome`, `categoria`, `descricao`, `unidade`, `saldo_atual`, `estoque_minimo`, `ativo`, `created_at`, `updated_at`) VALUES
(1, '97898701480278', 'Caixa Queijo de coalho (palito', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 10:45:09', '2026-02-09 11:08:21'),
(2, '97898701480001', 'Caixa Mussarela 4KG', 'embalagem', '', 'un', 971.000, 500.000, 1, '2026-01-20 10:45:51', '2026-04-20 13:08:21'),
(3, '97898701480285', 'Caixa Queijo Colonial', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 10:46:50', '2026-01-20 11:02:53'),
(4, '7898701480008', 'Embalagem Mussarela 4KG', 'embalagem', '', 'pct', 826.000, 500.000, 1, '2026-01-20 10:50:50', '2026-04-20 13:08:21'),
(5, '7898701480046', 'Embalagem Creme de Leite Cru', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 10:51:35', '2026-01-20 11:02:58'),
(6, '7898701480329', 'Rotulo Queijo Tipo Gruyere Fracionado', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 10:52:32', '2026-02-09 11:08:32'),
(7, '7898701480183', 'Rotulo Queijo Mussarela 1KG', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 10:53:21', '2026-01-20 11:03:03'),
(8, '7898701480244', 'Rotulo Queijo Prato 3KG', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 10:54:21', '2026-01-20 11:50:08'),
(13, '7898701480336', 'Rotulo Queijo Tipo Gouda Fracionado', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 11:16:18', '2026-02-09 11:08:16'),
(14, '7898701480206', 'Rotulo Queijo Provolone inteiro', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:02:47', '2026-01-20 16:02:47'),
(15, '7898701480282', 'Embalagem Queijo Colonial', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:03:13', '2026-01-20 16:03:13'),
(16, '7898701480237', 'Rotulo Queijo Prato Fatiado', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:03:58', '2026-01-20 16:03:58'),
(17, '7898701480374', 'Rotulo Mussarela Zero 4KG', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:04:52', '2026-01-20 16:04:52'),
(18, '7898701480398', 'Rotulo Mussarela Zero 1 KG', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:05:43', '2026-01-20 16:05:43'),
(19, '7898701480213', 'Rotulo Queijo Provolone Fracionado', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:06:15', '2026-01-20 16:06:15'),
(20, '7898701480077', 'Rotulo Queijo Tipo Gruyere Inteiro', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:06:54', '2026-01-20 16:06:54'),
(21, '7898701480060', 'Rotulo Queijo Tipo Gouda Inteiro', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:07:27', '2026-01-20 16:07:27'),
(22, '7898701480268', 'Rotulo Queijo de Coalho 2 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:08:24', '2026-01-20 16:08:24'),
(23, '7898701480121', 'Rotulo Queijo Mussarela Fatiado 2 Kg Interfolhado', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:09:13', '2026-01-20 16:09:13'),
(24, '155510', 'Embalagem Filme Queijo Mussarela Zero 1 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:14:10', '2026-01-20 16:14:10'),
(25, '155511', 'Embalagem Filme Queijo Mussarela 1 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:15:06', '2026-01-20 16:15:06'),
(26, '155512', 'Embalagem Filme Queijo Mussarela zero 4 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:16:04', '2026-01-20 16:16:04'),
(27, '155513', 'Embalagem Filme Queijo Mussarela Fatiado 2 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:16:50', '2026-01-20 16:16:50'),
(28, '155514', 'Embalagem Filme Queijo de Coalho 2 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:17:23', '2026-01-20 16:17:23'),
(29, '155515', 'Embalagem Filme Queijo Tipo Gouda Inteiro', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:18:44', '2026-01-20 16:18:44'),
(30, '155516', 'Embalagem Filme Queijo Prato Fatiado 2 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:19:12', '2026-01-20 16:19:12'),
(31, '155517', 'Embalagem Filme Queijo Tipo Gruyere Inteiro', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:19:57', '2026-01-20 16:19:57'),
(32, '155518', 'Embalagem Filme Queijo Tipo Gruyere Fracionado', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:20:22', '2026-01-20 16:20:22'),
(33, '155519', 'Embalagem Filme Queijo Tipo Gouda Fracionado', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:21:44', '2026-01-20 16:21:44'),
(34, '155520', 'Embalagem Filme Queijo Provolone Inteiro', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:22:17', '2026-01-20 16:22:17'),
(35, '155521', 'Embalagem Filme Queijo Provolone Fracionado', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:22:34', '2026-01-20 16:22:34'),
(36, '155522', 'Embalagem Filme Queijo Prato 3 Kg', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 16:24:02', '2026-01-20 16:24:20'),
(37, '17898701480241', 'Caixa Queijo Prato Lanche', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 16:30:10', '2026-01-20 16:30:10'),
(38, '97898701480353', 'Caixa Queijo Mussarela Fatiado 150g', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 16:31:52', '2026-01-20 16:31:52'),
(39, '97898701480360', 'Caixa Queijo Prato Fatiado 150g', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 16:32:37', '2026-01-20 16:32:37'),
(40, '97898701480346', 'Caixa Queijo Mussarela Fatiado 2 Kg', 'embalagem', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 16:33:37', '2026-01-20 16:33:37'),
(41, '040141134868', 'Fita Durex pack 6 un', 'diversos', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 16:44:29', '2026-01-20 16:57:20'),
(42, '7891191003733', 'Folha de Oficio Report', 'escritorio', '', 'pct', 1000.000, 500.000, 1, '2026-01-20 16:45:34', '2026-01-20 16:45:34'),
(43, '7898701480275', 'Embalagem Filme Queijo de Coalho Palito', 'embalagem', '', 'un', 1000.000, 500.000, 1, '2026-01-20 17:49:19', '2026-01-20 17:49:19'),
(44, '0619205099995', 'Tec Solution Foam 5L', 'projeto', '', 'un', 1000.000, 500.000, 1, '2026-01-21 14:32:33', '2026-02-09 11:09:22'),
(45, '0606529083243', 'TEC CID 5L', 'projeto', '', 'un', 1000.000, 500.000, 1, '2026-01-21 14:33:03', '2026-02-09 11:08:42'),
(46, '0609963659357', 'TEC CLOR 5L', 'projeto', '', 'un', 1000.000, 500.000, 1, '2026-01-21 14:33:25', '2026-02-09 11:09:13');

SELECT COUNT(*) AS total_itens_estoque FROM estoque;
