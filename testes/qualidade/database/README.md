# Database do módulo Qualidade

## Banco usado no teste

`santilac_raw`:

- `produtores`
- `resultadosanalises`

## Scripts

- `001_create_resultadosanalises.sql`
- `002_create_dash_qualidade_produtor_mes.sql`

## Regra atual

Nesta fase do módulo, o backend lê produtores e análises do banco bruto de teste. O `processor` entra depois para validar, transformar e só então alimentar estruturas limpas.
