# Backend

Laravel sera usado para API, autenticacao, permissoes, raw writes, clean writes, exportacoes e orquestracao do processor Python.

## Responsabilidades

- receber requests do frontend e apps
- validar permissoes
- gravar dados brutos no MySQL raw
- chamar processor Python com JSON
- validar JSON retornado
- gravar dados limpos no MySQL clean/dash
- expor APIs de leitura para frontend
- gerar PDF/Excel quando necessario

## Nao Fazer Aqui

- calculos pesados espalhados em controller
- dashboard consultando raw
- regra critica no frontend
- remendo sem teste
