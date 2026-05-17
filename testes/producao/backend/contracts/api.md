# Contrato API Producao Industrial

Base:

```text
/api/industrial
```

Resposta de sucesso:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

Resposta de erro:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INDUSTRIAL_422",
    "message": "Mensagem objetiva",
    "fields": {}
  },
  "meta": {}
}
```

## Enums

`production_batches.status`: `draft`, `closed`, `reopened`, `cancelled`.

`production_batch_items.production_type`: `produced`, `packed`, `fractioned`, `returned`, `loss`, `point`, `adjustment`.

`stock_movements.movement_type`: `in`, `out`, `adjustment`, `loss`, `return`, `inventory_adjustment`.

`stock_movements.origin_type`: `production`, `sale`, `manual_adjustment`, `physical_inventory`.

## Produtos Industriais

### GET `/products`

Query opcional: `q`, `active`.

Retorno:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "code": "MUSSARELA-F4",
        "name": "Mussarela F4",
        "category": "mussarela",
        "unit": "kg",
        "active": true,
        "created_at": "2026-05-17 12:00:00",
        "updated_at": "2026-05-17 12:00:00"
      }
    ]
  },
  "error": null,
  "meta": {}
}
```

### POST `/products`

Payload:

```json
{
  "code": "MUSSARELA-F4",
  "name": "Mussarela F4",
  "category": "mussarela",
  "unit": "kg",
  "active": true
}
```

### PUT `/products/{id}`

Mesmo payload do cadastro. Campos ausentes mantem o valor atual.

## Entradas De Leite

### GET `/milk-entries`

Query opcional: `date_from`, `date_to`.

### POST `/milk-entries`

Payload:

```json
{
  "entry_date": "2026-05-17",
  "liters_received": 1000,
  "liters_processed": 900,
  "liters_to_cream": 50,
  "liters_surplus": 25,
  "difference_liters": 25,
  "milk_balance": 25,
  "notes": "observacao operacional"
}
```

`difference_liters` e `milk_balance` podem ser omitidos; neste corte o backend calcula `liters_received - liters_processed - liters_to_cream - liters_surplus`.

### GET `/milk-entries/{id}`

Retorna uma entrada.

### PUT `/milk-entries/{id}`

Mesmo payload de criacao.

## Lotes De Producao

### GET `/production-batches`

Query opcional: `date_from`, `date_to`, `status`.

### POST `/production-batches`

Payload:

```json
{
  "batch_date": "2026-05-17",
  "milk_entry_id": 1,
  "liters_processed": 900,
  "status": "draft",
  "notes": "lote do dia"
}
```

### GET `/production-batches/{id}`

Retorna lote com `items`, `calculation` e `audit_logs`.

### PUT `/production-batches/{id}`

Atualiza lote somente quando status nao for `closed` nem `cancelled`.

### POST `/production-batches/{id}/items`

Payload:

```json
{
  "product_id": 1,
  "production_type": "produced",
  "pieces_count": 10,
  "weight_kg": 400,
  "notes": "item produzido"
}
```

### PUT `/production-items/{id}`

Mesmo payload do item. Permitido somente quando o lote estiver editavel.

### DELETE `/production-items/{id}`

Remove item somente quando o lote estiver editavel.

### POST `/production-batches/{id}/recalculate`

Executa processor Python, persiste `production_calculation_results` e retorna o lote atualizado.

Retorno de `calculation`:

```json
{
  "liters_processed": 900,
  "total_produced_kg": 400,
  "yield_liters_per_kg": 2.25,
  "yield_kg_per_liter": 0.444444,
  "average_piece_weight": 40,
  "items": [],
  "stock_movements": []
}
```

Divisoes por zero retornam `null` nos campos de rendimento afetados.

### POST `/production-batches/{id}/close`

Fecha lote `draft` ou `reopened`, recalcula e gera movimentos `stock_movements` de entrada por produto. Antes de inserir, remove movimentos anteriores de origem `production` para o mesmo lote, evitando duplicidade.

### POST `/production-batches/{id}/reopen`

Payload obrigatorio:

```json
{
  "reason": "motivo auditavel"
}
```

Reabre lote fechado, remove os movimentos de estoque gerados pelo fechamento e registra `production_batch_audit_logs`.

## Estoque Teorico

### GET `/stock`

Calcula saldo teorico pelo processor a partir de movimentos reais em `stock_movements`.

Retorno:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "product_id": 1,
        "balance_kg": 400,
        "balance_pieces": 10,
        "product": {}
      }
    ]
  },
  "error": null,
  "meta": {}
}
```

### GET `/stock/movements`

Query opcional: `date_from`, `date_to`, `product_id`.

## Relatorio Diario

### GET `/reports/daily-production`

Query opcional: `date_from`, `date_to`.

Retorna lotes, totais calculados persistidos e itens reais do banco.

## Codigos De Erro

- `INDUSTRIAL_400`: requisicao invalida.
- `INDUSTRIAL_404`: recurso nao encontrado.
- `INDUSTRIAL_405`: metodo nao permitido.
- `INDUSTRIAL_409`: conflito com estado atual.
- `INDUSTRIAL_422`: validacao de campos.
- `INDUSTRIAL_502`: falha ao executar processor.
- `INDUSTRIAL_503`: banco de laboratorio nao inicializado.
