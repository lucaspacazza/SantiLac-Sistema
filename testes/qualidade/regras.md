# Regras Do Laboratorio: Qualidade

## Escopo

O laboratorio de Qualidade cobre o modulo real, nao apenas importacao.

```text
overview -> produtores -> detalhe do produtor -> relatorios -> importacoes -> programas auxiliares
```

## Ordem

1. Backend do modulo.
2. Contratos de API.
3. Database e colunas.
4. Frontend.
5. Processor/importacoes.
6. Integracao no laboratorio.
7. Validacao manual.
8. Promocao para o sistema principal.

## Regra Principal Do Momento

Nao comecar por processor.

O backend deve definir:

- quais telas existem
- quais endpoints alimentam cada tela
- quais tabelas entram no modulo
- quais colunas sao usadas
- quais dados vem do raw
- quais dados vem de tabelas validadas/dash
- quais respostas o frontend pode esperar

## Bancos

`santilac_raw`:

- produtores e dados brutos/base importada

`santilac_clean`:

- resultados de qualidade validados
- tabelas dash
- dados processados pelo modulo

## Primeiro Backend

O primeiro backend deve cobrir:

- resumo da qualidade
- listagem de produtores com ultima analise
- detalhe do produtor
- historico de analises do produtor
- relatorios principais

Importacao fica fora deste primeiro passo.
