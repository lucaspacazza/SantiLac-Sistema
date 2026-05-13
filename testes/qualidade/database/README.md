# Database do modulo Qualidade

## Banco usado no teste

`santilac_raw`:

- `produtores`
- `resultadosanalises`
- `importacoes_analises`

## Scripts

- `001_create_resultadosanalises.sql`
- `002_create_dash_qualidade_produtor_mes.sql`
- `003_create_importacoes_analises.sql`
- `004_add_unique_resultadosanalises_produtor_data.sql`

## Regra atual

Nesta fase do modulo, o backend le produtores e analises do banco bruto de teste. O `processor` importa e normaliza planilhas, mas o Laravel continua responsavel por gravar em `resultadosanalises`.

`resultadosanalises` mantem a estrutura funcional do V3 e deve ter chave unica por `produtor_codigo + data` para impedir duplicidade.

`importacoes_analises` guarda auditoria do arquivo original, hash, resultado do processor e resumo de gravacao.
