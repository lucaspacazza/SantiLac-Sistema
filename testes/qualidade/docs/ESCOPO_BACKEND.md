# Escopo Backend: Qualidade

## Objetivo

Criar o backend do modulo Qualidade dentro do laboratorio.

Este backend alimenta as telas principais do modulo:

- resumo geral
- produtores
- detalhe do produtor
- analises recentes
- relatorios

## Fora Deste Primeiro Passo

- importador de planilhas
- processor Python
- Mais Leite completo
- notas fiscais
- CRUD de produtores
- app de coletas

Esses pontos entram depois que o modulo base estiver validado.

## Fonte Dos Dados

`santilac_raw.produtores`:

- identidade do produtor
- codigo
- nome
- cidade
- rota
- documento
- status ativo/novo/projeto
- data de cadastro/inativacao

`santilac_clean.resultadosanalises`:

- analises laboratoriais validadas
- historico por produtor/data
- indicadores usados na tela de qualidade

`santilac_clean.dash_qualidade_produtor_mes`:

- agregados mensais futuros
- deve ser usado por dashboards quando existir

## Telas Que O Backend Precisa Alimentar

### Home / Resumo

Entrega:

- total de produtores ativos
- total de analises validadas
- data da ultima analise
- periodo atual
- produtores com analise
- produtores sem analise

### Produtores

Entrega:

- lista paginada
- filtro por busca
- filtro por status
- filtro por rota
- ultima analise de cada produtor
- indicadores principais da ultima analise

### Detalhe Do Produtor

Entrega:

- dados cadastrais do produtor
- ultima analise
- historico recente de analises
- resumo de qualidade do produtor

### Relatorios

Entrega:

- ativos
- novos
- inativos
- rotas disponiveis
- resumo por periodo

## Regra

Dashboard e relatorio nao consultam dado bruto de importacao.

Produtor vem do raw porque e base central.

Qualidade validada vem do clean.
