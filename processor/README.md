# Processor

Processor sera Python puro para processamento, limpeza, calculos e preparacao de exportacoes.

Ele recebe JSON bruto e devolve JSON processado.

## Responsabilidades

- validar dados recebidos
- normalizar valores
- calcular resultados
- devolver clean records
- devolver erros e warnings estruturados
- preparar dados/arquivos de exportacao, principalmente Excel
- importar planilhas por cabecalho normalizado, sem depender de posicao fixa das colunas

## Regra Fundamental

Python nao acessa banco.

Sem credenciais MySQL.

Sem escrita em tabela.

Entrada e saida por contrato JSON.

## Organizacao Esperada

Quando o projeto Python for criado, manter separacao por modulo:

```text
processor/
  modules/
    qualidade/
      processing/
      exports/
      tests/
    producao/
      processing/
      exports/
      tests/
  shared/
```

Cada modulo deve ter sua propria pasta de processamento, sua propria pasta de exportacao e seus proprios testes.

Codigo compartilhado fica em `shared/`, mas somente quando for realmente comum e pequeno.

Laravel continua sendo o responsavel por chamar o processor, validar o retorno, salvar metadados/arquivos quando necessario e entregar a exportacao para a dashboard/API.

## Importacao De Planilhas

O parser de planilhas deve ser tolerante a mudancas simples de layout.

Exemplo: estas variacoes devem ser entendidas como o mesmo formato quando os campos forem equivalentes:

```text
| codigo | nome |
| nome | codigo |
| NOME | CODIGO |
| CODIGO | NOME |
```

Regra:

- mapear por cabecalho normalizado
- nao mapear por indice fixo da coluna
- aceitar diferenca de maiusculo/minusculo
- tratar espacos extras
- aceitar sinonimos conhecidos quando documentados
- retornar erro claro se faltar coluna obrigatoria
