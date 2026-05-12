# Fluxo Para Criar Um Modulo

Este e o processo padrao para qualquer modulo novo.

## 1. Descrever O Dominio

Antes de codigo:

- qual problema o modulo resolve
- quem usa
- quais dados entram
- quais dados saem
- quais erros podem acontecer
- quais exportacoes sao necessarias

## 2. Definir Raw

Toda entrada bruta precisa ter origem, data e status de processamento.

Padrao minimo:

```text
id
source
source_reference
payload_original
status_processamento
erro_processamento
created_at
processed_at
```

Nem toda tabela raw precisa ser exatamente assim, mas a ideia deve existir.

## 3. Definir Tabela Validada/Dash

A tabela validada do modulo guarda dado confiavel.

Dash guarda agregado pronto para tela/relatorio.

Exemplo:

```text
raw_analises
analises_laboratoriais
dash_qualidade_produtor_mes
```

## 4. Criar Teste Do Processor

O teste deve provar:

- dado valido gera registro validado correto
- dado invalido gera erro estruturado
- duplicidade nao quebra o processamento
- valores vazios sao tratados
- reprocessamento gera o mesmo resultado

## 5. Criar Teste Da API

O teste deve provar:

- usuario sem permissao nao acessa
- payload invalido e rejeitado
- payload valido grava raw
- job/processamento grava tabela validada
- API de leitura retorna tabela validada/dash, nao raw

## 6. Implementar

Implementar apenas o necessario para passar os testes.

Nada de antecipar modulo futuro.

## 7. Validar Manualmente

Lucas valida o fluxo com dados parecidos com os reais.

Se aparecer excecao, volta para teste antes de corrigir.

## 8. Promover

So promover para o sistema principal quando estiver 100%.
