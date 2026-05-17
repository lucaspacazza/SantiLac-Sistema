# Backend Laboratorio Producao

Backend PHP simples para testar o contrato do modulo de Producao Industrial.

## Banco

Obrigatorio usar MySQL. SQLite esta bloqueado no codigo.

Variaveis:

```bash
PRODUCAO_DB_DRIVER=mysql
PRODUCAO_DB_DSN='mysql:host=127.0.0.1;port=3306;dbname=santilac_producao_lab;charset=utf8mb4'
PRODUCAO_DB_USER=santilac_producao
PRODUCAO_DB_PASSWORD=santilac_producao
```

## Migrar

```bash
php backend/scripts/migrate.php
```

## Rodar local

```bash
php -S 127.0.0.1:8097 -t backend/public
```
