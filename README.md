# SantiLac Core

Novo projeto do SantiLac, iniciado para substituir o V3 com arquitetura limpa, testes desde o primeiro dia e separacao real entre entrada bruta, processamento e dados limpos.

O sistema antigo fica apenas como referencia de regras e fluxos. Codigo antigo nao deve ser copiado para ca.

## Decisao De Arquitetura

```text
frontend/apps -> Laravel API -> MySQL raw/auditoria
Laravel job -> Python processor -> Laravel validator/writer -> MySQL validado/dash
frontend dashboards -> Laravel API -> MySQL validado/dash
```

## Pastas

```text
backend/    API Laravel, autenticacao, permissoes, escrita raw/auditoria, escrita validada, exports
frontend/   React + TypeScript, telas administrativas e operacionais
processor/  Python puro, recebe JSON bruto e devolve JSON processado
database/   contratos dos bancos/tabelas raw, validadas e dash
testes/     laboratorio modulo por modulo antes de entrar no sistema principal
docs/       regras, arquitetura, decisoes e memoria do projeto
```

## Stack Acordada

- Frontend: React + TypeScript + Vite
- Backend: Laravel + PHP 8.3+
- Processor: Python, sem acesso direto ao banco
- Banco: MySQL obrigatorio
- Testes: obrigatorios antes de promover qualquer modulo

## Regra Principal

Nada entra em producao se nao passou pelo laboratorio, pelos testes e pela validacao manual.

## Documento Principal

Antes de continuar em outro PC ou outra conversa, ler:

```text
CONTINUAR_NO_OUTRO_PC.md
docs/MEMORIA_DO_PROJETO.md
docs/CATALOGO_DE_ERROS.md
docs/PADROES_DO_CORE.md
```

Esse arquivo guarda as decisoes tomadas, o que esta fixo, o que esta fora de escopo agora e a ordem recomendada.

## Prioridade Inicial

Ainda nao iniciar o app de coletas. Ele sera previsto na arquitetura, mas fica fora do primeiro ciclo.

O primeiro trabalho e definir a fundacao: arquitetura, regras de desenvolvimento, contratos raw/auditoria, tabelas validadas, base de produtores e o primeiro modulo operacional do sistema principal.
