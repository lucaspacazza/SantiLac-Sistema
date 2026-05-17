# Laboratorio Producao Industrial

Modulo de laboratorio para validacao humana do fluxo de Producao Industrial do SantiLac.

## Banco obrigatorio

Este laboratorio usa **MySQL**. SQLite nao e permitido.

Banco padrao:

```text
santilac_producao_lab
```

Variaveis suportadas:

```bash
PRODUCAO_DB_DRIVER=mysql
PRODUCAO_DB_DATABASE=santilac_producao_lab
PRODUCAO_DB_DSN='mysql:host=127.0.0.1;port=3306;dbname=santilac_producao_lab;charset=utf8mb4'
PRODUCAO_DB_USER=santilac_producao
PRODUCAO_DB_PASSWORD=santilac_producao
```

## Migracao

```bash
php testes/producao/backend/scripts/migrate.php
```

O script aplica:

- `database/001_create_industrial_core_mysql.sql`
- `database/002_seed_industrial_products_mysql.sql`

## Escopo

- Recebimento de leite;
- Lotes de producao;
- Itens de lote;
- Recalculo;
- Fechamento;
- Reabertura;
- Estoque teorico;
- Relatorio diario.

## Regra

Nao usar mock, dados ficticios ou SQLite. A fonte de verdade para testes e o MySQL.
