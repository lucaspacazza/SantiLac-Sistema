-- SantiLac Core - Qualidade
-- Ajuste para bases onde `resultadosanalises` ja foi criada antes da chave unica.
--
-- Execute somente depois de garantir que nao existem duplicidades por produtor/data.

ALTER TABLE resultadosanalises
  ADD UNIQUE KEY idx_produtor_data (produtor_codigo, data);
