# Regras De Desenvolvimento

Este arquivo e o acordo de trabalho do SantiLac Core. Ele existe para impedir que o novo sistema vire outra base cheia de remendos.

## 1. Nada Sem Teste

Todo modulo nasce primeiro em `testes/`.

Antes de codar, criar ou atualizar o contrato do modulo seguindo:

```text
docs/PADROES_DO_CORE.md
```

Fluxo obrigatorio:

```text
1. Escrever regra do modulo
2. Escrever teste que prova a regra
3. Implementar o minimo para passar
4. Validar erro, borda e dado invalido
5. Revisar codigo morto
6. Promover para backend/frontend/processor principal
```

Se nao existe teste, nao existe feature pronta.

## 2. Raw E Tabela Validada Sao Sagrados

Dados brutos entram em tabelas raw.

Dados exibidos, exportados ou usados em dashboard saem de tabelas validadas do modulo ou de tabelas dash.

O dashboard nunca consulta raw diretamente.

## 3. Python Nao Acessa Banco

O processor Python e puro:

```text
entrada JSON -> processamento -> saida JSON
```

Ele nao conhece credencial, nao abre conexao MySQL e nao grava tabela.

Laravel:

- le raw
- chama Python
- valida contrato de retorno
- abre transacao
- grava tabela validada/dash
- registra auditoria e erros

## 4. Sem Remendo Temporario

Nao existe "depois eu limpo".

Bug em producao segue este fluxo:

```text
1. Reproduzir no laboratorio
2. Criar teste falhando
3. Corrigir limpo
4. Remover codigo morto
5. Rodar todos os testes
6. Subir somente se passar
```

## 5. Definicao De 100%

Um modulo so esta 100% quando:

- regra escrita em docs
- schema raw definido
- schema da tabela validada/dash definido
- migrations de teste funcionando
- API validada
- processor validado
- erros tratados
- testes automatizados passando
- permissao revisada
- exportacao testada, se fizer parte do modulo
- validacao manual feita pelo Lucas
- codigo morto removido

99% nao entra.

## 6. Um Modulo Por Vez

Nao iniciar o proximo modulo enquanto o atual nao estiver fechado.

O sistema deve crescer em blocos pequenos, completos e confiaveis.

## 7. Frontend Vem Depois Do Contrato

Frontend nao define regra de negocio.

Ordem correta:

```text
dominio -> teste -> raw/auditoria -> processor -> tabela validada -> API -> frontend
```

## 8. O Sistema Antigo E Referencia, Nao Base

O SantiLac V3 pode ser consultado para entender:

- campos usados
- fluxos reais
- relatorios esperados
- regras antigas
- dores e problemas

Mas codigo antigo nao deve ser copiado para o Core.
