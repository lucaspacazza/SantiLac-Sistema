-- SantiLac Core
-- Inserção dos produtores novos encontrados no PDF atualizado.
--
-- Origem:
--   C:\Users\lucas\OneDrive\Área de Trabalho\Leite - Relatório de Produção por MunicípiosClientes.PDF
--
-- Comparação feita em 2026-05-13:
--   Produtores no PDF: 82
--   Produtores ativos no banco: 88
--   Produtores novos no PDF: 3
--   Produtores ativos ausentes no PDF: 9
--
-- Este arquivo NÃO foi executado no banco.

USE santilac_raw;

INSERT INTO produtores (
  codigo,
  nome,
  cidade,
  rota,
  diario,
  endereco,
  cep,
  cpf_cnpj,
  celular,
  ativo,
  novo,
  data_cadastro,
  data_inativacao,
  projeto
) VALUES
  ('1445', 'KAUAN JUNIOR KNOB PASA', 'QUILOMBO', '', 0, NULL, NULL, NULL, NULL, 1, 1, NOW(), NULL, 0),
  ('1446', 'VOLMIR BURATO', 'CORONEL MARTINS', '', 0, NULL, NULL, NULL, NULL, 1, 1, NOW(), NULL, 0),
  ('1462', 'NILTO FRANCISCO FEDATTO', 'UNIAO DO OESTE', '', 0, NULL, NULL, NULL, NULL, 1, 1, NOW(), NULL, 0);

-- Produtores ativos no banco que não aparecem no PDF atualizado:
-- 68   FRANCISCO MARIO BORDIGNON
-- 78   GENIR AFONSO PASA
-- 105  ADEMIR LAURI RIGO
-- 823  AMILTON EVICO BORSOI
-- 1252 KATRIAN TIBOLA DAMBROS
-- 1281 SOLANGE MARIA TIBOLA DAMBROS
-- 1315 ERIC DE MATOS ALTHAUS
-- 1366 JAIME JOSE STRAPAZZON
-- 1378 GIOVANI SMANIOTTO
UPDATE produtores
SET ativo = 0,
    data_inativacao = COALESCE(data_inativacao, NOW())
WHERE ativo = 1
  AND codigo IN (
    '68',
    '78',
    '105',
    '823',
    '1252',
    '1281',
    '1315',
    '1366',
    '1378'
  );
