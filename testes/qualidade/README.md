# Laboratorio: Qualidade

Tudo do modulo Qualidade nasce aqui antes de ir para `backend/`, `processor/` ou `frontend/`.

Regra atual:

- primeiro alinhar contrato e backend do modulo
- depois database do modulo
- depois tela/frontend
- depois processor/importacoes quando o fluxo pedir
- depois integrar, validar manualmente e promover

Escopo entendido do V3:

- Qualidade nao e apenas analises
- inclui produtores dentro da visao de qualidade
- inclui painel do produtor
- inclui relatorios
- inclui importacao de analises
- inclui Mais Leite
- inclui notas fiscais

Estrutura do laboratorio:

```text
testes/qualidade/
  backend/
  database/
  frontend/
  processor/
  docs/
```

Ordem combinada agora:

```text
backend + contratos + tabelas -> frontend -> processor -> integracao -> promocao
```

Importador de planilha nao e o primeiro passo. Ele entra depois que o modulo real estiver desenhado.
