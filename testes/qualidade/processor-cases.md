# Casos Do Processor: Qualidade / Analises

## CSV Padrao

Arquivo com cabecalhos esperados e delimitador `;`.

Deve:

- reconhecer codigo e data
- converter data `dd/mm/yyyy` para `YYYY-MM-DD`
- converter decimais com virgula
- converter CCS e UFC para inteiro
- converter ATB/BCL para `0.0` ou `1.0`

## Colunas Trocadas

Arquivo com colunas em outra ordem e cabecalhos com acento.

Deve:

- mapear por cabecalho normalizado
- nao depender da posicao da coluna

## Coluna Obrigatoria Ausente

Arquivo sem coluna de codigo.

Deve:

- retornar `success=false`
- retornar erro `IMPORT_313`
- indicar `codigo` em `details`

## Linha Com Codigo Invalido

Linha com codigo vazio, zero ou texto sem numero valido.

Deve retornar erro `PRODUCER_411`.

## Linha Com Data Invalida

Linha com data impossivel ou vazia.

Deve retornar erro `ANALYSIS_510`.

## Produtor Inexistente

Quando `valid_producer_codes` for enviado e o codigo nao existir nele, deve retornar erro `PRODUCER_410`.

## Zeros De Ausencia

Campos decimais com `0,0` devem virar `null`.

## Reimportacao

Reimportacao e merge de dados existentes serao testados no bloco Laravel/writer, porque o processor nao consulta banco.

