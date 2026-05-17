# Backend De Laboratorio

API executavel isolada do modulo Producao Industrial.

## Instalar Banco

```bash
php testes/producao/backend/scripts/migrate.php
```

## Iniciar API

```bash
php -S 127.0.0.1:8097 -t testes/producao/backend/public
```

## Variaveis

- `PRODUCAO_DB_PATH`: caminho do SQLite de laboratorio.
- `PRODUCAO_PROCESSOR_SCRIPT`: caminho do script Python de calculos.

## Contrato

Ver `contracts/api.md`.
