# Laboratório Do Módulo Estoque

Este diretório guarda o primeiro ciclo do módulo de controle de estoque.

Fluxo:

1. contrato do módulo
2. contrato da API
3. tabelas
4. backend
5. tela
6. validação manual
7. promoção para o sistema real

Neste ciclo o estoque fica propositalmente simples:

- `estoque`: cadastro do item e saldo atual
- `estoque_logs`: entradas, saídas e ajustes

Os itens iniciais vêm do estoque do V3, sem a coluna `custo_unitario_exato`.
