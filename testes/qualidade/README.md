# Laboratorio: Qualidade

Tudo do modulo Qualidade nasce aqui antes de ir para `backend/`, `processor/` ou `frontend/`.

Regra atual:

- primeiro documentar contrato
- depois criar testes
- depois implementar o minimo
- depois validar com dados reais ou parecidos com reais
- somente entao promover para o sistema principal

Escopo entendido do V3:

- Qualidade nao e apenas analises
- inclui produtores dentro da visao de qualidade
- inclui painel do produtor
- inclui relatorios
- inclui importacao de analises
- inclui Mais Leite
- inclui notas fiscais

Primeiro bloco recomendado:

```text
qualidade / analises laboratoriais
```

Motivo: e o menor bloco que prova o fluxo completo:

```text
arquivo original -> raw/auditoria -> processor Python -> Laravel valida -> resultadosanalises -> API futura
```
