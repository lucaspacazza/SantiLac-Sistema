# Database Do Laboratorio Qualidade

## Bancos

`santilac_raw`:

- `produtores`

`santilac_clean`:

- `resultadosanalises`
- `dash_qualidade_produtor_mes`

## Scripts

- `001_create_resultadosanalises.sql`
- `002_create_dash_qualidade_produtor_mes.sql`

## Regra

Produtores continuam no raw.

Resultados de qualidade entram no clean porque sao dados validados/processados.

Dashboard e relatorio devem consumir `resultadosanalises` ou `dash_*`, nunca raw de importacao.
