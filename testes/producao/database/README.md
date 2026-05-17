# Banco Do Laboratorio De Producao

## Ordem De Aplicacao

1. `001_create_industrial_core.sql`
2. `002_seed_industrial_products.sql`

Aplicacao padrao:

```bash
php testes/producao/backend/scripts/migrate.php
```

O script cria ou reutiliza o arquivo SQLite real em `testes/producao/database/producao_lab.sqlite` e aplica os SQL em transacao.

## Tabelas

- `industrial_products`
- `milk_entries`
- `production_batches`
- `production_batch_items`
- `production_calculation_results`
- `stock_movements`
- `production_batch_audit_logs`

## Observacao

Os SQL deste laboratorio usam dialeto SQLite para permitir execucao isolada sem alterar bancos reais do sistema. A promocao futura para Laravel/MySQL deve converter tipos e checks mantendo as mesmas entidades e contratos.
