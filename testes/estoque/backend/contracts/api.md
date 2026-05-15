# Contrato API: Estoque

Base:

```text
/api/estoque
```

No container de testes as rotas ficam abertas. No sistema real entram atrás da autenticação principal.

## GET /overview

Resumo do estoque.

Resposta:

```json
{
  "success": true,
  "data": {
    "totais": {
      "itens": 42,
      "itens_ativos": 42,
      "movimentos_mes": 0,
      "abaixo_minimo": 0
    },
    "alertas": {
      "baixo_estoque": []
    }
  }
}
```

## GET /itens

Filtros:

- `q`
- `categoria`
- `ativo`
- `per_page`

Cada item retorna o saldo atual direto da tabela `estoque`.

## GET /categorias

Lista as categorias distintas já existentes na tabela `estoque`.

## POST /itens

Cria item.

Payload:

```json
{
  "codigo": "EMB-001",
  "nome": "Garrafa 1L",
  "categoria": "embalagem",
  "descricao": "Opcional",
  "unidade": "un",
  "saldo_atual": 0,
  "estoque_minimo": 100
}
```

## GET /itens/{id}

Detalhe do item e últimas movimentações.

## PATCH /itens/{id}

Atualiza o cadastro do item. O saldo não é editado aqui; saldo muda por movimentação.

Payload:

```json
{
  "codigo": "EMB-001",
  "nome": "Garrafa 1L",
  "categoria": "embalagem",
  "descricao": "Opcional",
  "unidade": "un",
  "estoque_minimo": 100,
  "ativo": true
}
```

## GET /movimentos

Filtros:

- `item_id`
- `tipo`
- `data_inicio`
- `data_fim`
- `per_page`

## POST /movimentos

Registra movimentação e atualiza `estoque.saldo_atual`.

Tipos:

- `entrada`: soma no saldo
- `saida`: subtrai do saldo
- `ajuste`: define o saldo final como a quantidade enviada

Payload:

```json
{
  "tipo": "entrada",
  "item_id": 1,
  "quantidade": 100,
  "data_movimento": "2026-05-14",
  "motivo": "Compra"
}
```

Erros:

- `STOCK_810`: item não encontrado
- `STOCK_812`: saldo insuficiente
- `STOCK_813`: item inativo
- `STOCK_814`: tipo inválido
