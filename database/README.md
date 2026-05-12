# Database

Banco obrigatorio: MySQL.

## Separacao

Usar separacao entre raw, tabelas validadas e dash.

Pode ser por bancos separados:

```text
santilac_raw_test
santilac_validado_test
santilac_raw_prod
santilac_validado_prod
```

Ou por prefixo de tabela, se isso simplificar no inicio:

```text
raw_*
tabelas validadas do modulo
dash_*
```

## Regra

Raw guarda o que entrou.

Tabelas validadas guardam o que foi validado.

`clean_*` pode existir quando fizer sentido, mas nao e obrigatorio. Analises laboratoriais vao para uma tabela propria de analises, porque sera uma tabela de consulta com as colunas exatas do modulo.

Dash guarda agregado pronto para tela, relatorio e exportacao.
