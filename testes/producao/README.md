# Producao Industrial

Laboratorio do modulo Producao Industrial do SantiLac.

Este corte entrega backend, banco e processor de laboratorio para:

- cadastro de produtos industriais;
- recebimento diario de leite;
- lotes de producao diaria;
- itens dinamicos por produto;
- recalculo de rendimento;
- fechamento de lote com entrada em estoque teorico;
- relatorio diario simples.

## Fronteira

Todo codigo deste modulo fica em `testes/producao/`. Nada deste laboratorio foi promovido para `backend/`, `frontend/`, `processor/` ou `database/` reais.

## Banco

O backend de laboratorio usa SQLite por padrao em:

```text
testes/producao/database/producao_lab.sqlite
```

Aplicar schema e seed:

```bash
php testes/producao/backend/scripts/migrate.php
```

Para usar outro arquivo SQLite:

```bash
PRODUCAO_DB_PATH=/caminho/producao.sqlite php testes/producao/backend/scripts/migrate.php
```

## Backend

Iniciar API de laboratorio:

```bash
php -S 127.0.0.1:8097 -t testes/producao/backend/public
```

Base da API:

```text
http://127.0.0.1:8097/api/industrial
```

Contrato completo: `backend/contracts/api.md`.

## Processor

Rodar testes:

```bash
python3 -m pytest testes/producao/processor/tests
```

Executar calculo por CLI:

```bash
python3 testes/producao/processor/modules/producao/calculations.py --function daily-production --input payload.json
```

## Fonte Unica

Fluxos funcionais devem ler e gravar no banco do laboratorio. Este modulo nao usa dados mockados, arrays em memoria, fixtures visuais ou simulacao para validar tela, API, relatorio ou estoque.
