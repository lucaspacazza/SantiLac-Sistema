# Regras De Producao Industrial

## Confirmadas Neste Corte

- Produtos industriais sao dinamicos por `product_id`.
- Lotes possuem estados `draft`, `closed`, `reopened` e `cancelled`.
- Itens de producao pertencem a um lote e a um produto industrial.
- O peso produzido total do lote e a soma de `weight_kg` dos itens do lote.
- O peso medio por peca e calculado por item quando `pieces_count > 0`.
- O rendimento `yield_liters_per_kg` so e calculado quando litros processados e peso produzido forem maiores que zero.
- O rendimento `yield_kg_per_liter` so e calculado quando litros processados forem maiores que zero.
- Fechar lote gera movimentos reais de entrada no estoque teorico por produto.
- Reabrir lote exige motivo, remove movimentos de estoque gerados pelo fechamento e registra auditoria.
- Lote fechado nao aceita edicao direta de dados basicos nem alteracao de itens.
- Recalculo atualiza resultado persistido sem duplicar movimentacoes de estoque.
- Estoque teorico e calculado a partir de movimentos reais em `stock_movements`.

## Pendentes De Validacao Com O Dono

- Formula final de diferenca F4, retorno, pontas e falta/creme.
- Regra de saldo inicial de leite e fechamento mensal.
- Conversao oficial entre creme de leite, creme de soro, soro e materia gorda.
- Integracao futura entre produtos industriais e itens do modulo Estoque real.
- Politica de permissao para reabertura/cancelamento de lote no sistema real.
- Se deve existir mais de um lote por dia ou apenas um lote consolidado diario.

## Bloqueios

- Nao usar dados mockados, ficticios, demonstrativos, hardcoded, fake ou sample para validar fluxo funcional.
- Nao criar tabela por produto nem colunas fixas por queijo.
- Nao tratar formulas duvidosas da planilha como regra definitiva.
