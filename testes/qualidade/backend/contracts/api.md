# Contratos API: Qualidade

Base futura:

```text
/api/qualidade
```

## GET /api/qualidade/overview

Resumo para primeira tela do modulo.

Resposta:

```json
{
  "success": true,
  "data": {
    "produtores_ativos": 0,
    "analises_validadas": 0,
    "ultima_analise": null,
    "periodo_atual": "05/2026",
    "produtores_com_analise": 0,
    "produtores_sem_analise": 0
  }
}
```

## GET /api/qualidade/produtores

Lista produtores na visao de qualidade.

Query:

- `q`: busca por codigo, nome, cidade ou rota
- `ativo`: `0` ou `1`
- `rota`: rota exata
- `per_page`: limite por pagina

Resposta:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "codigo": "101",
        "nome": "Produtor",
        "cidade": "Cidade",
        "rota": "1",
        "ativo": true,
        "novo": false,
        "ultima_analise": {
          "data": "2026-05-01",
          "gordura": 3.8,
          "proteina": 3.2,
          "lactose": 4.6,
          "solidos_totais": 12.4,
          "ccs": 73800,
          "ufc": 1200,
          "caseina": 2.5,
          "sng": 8.7,
          "ureia": 16.5,
          "antibiotico": "NEG",
          "bacteria": "POS",
          "temperatura": 4.2
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 25,
      "total": 0
    }
  }
}
```

## GET /api/qualidade/produtores/{codigo}

Detalhe do produtor na qualidade.

Resposta:

```json
{
  "success": true,
  "data": {
    "produtor": {},
    "resumo": {},
    "ultima_analise": {},
    "analises_recentes": []
  }
}
```

Erro:

```json
{
  "success": false,
  "error": {
    "code": "PRODUCER_410",
    "message": "Produtor nao encontrado.",
    "details": {
      "codigo": "999"
    }
  }
}
```

## GET /api/qualidade/produtores/{codigo}/analises

Historico paginado de analises do produtor.

## GET /api/qualidade/analises

Lista paginada de análises laboratoriais usando a estrutura `resultadosanalises` do V3.

Query:

- `q`: busca por código, nome do produtor ou cidade
- `produtor_codigo`: código exato do produtor
- `data_inicio`: data inicial no formato `YYYY-MM-DD`
- `data_fim`: data final no formato `YYYY-MM-DD`
- `per_page`: limite por página

Resposta:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 582,
        "produtor_codigo": "165",
        "produtor_nome": "CATIA CRISTINA GUIZZO",
        "produtor_cidade": "SANTIAGO DO SUL",
        "data": "2026-01-30",
        "gordura": 4.24,
        "proteina": 3.44,
        "lactose": 4.62,
        "solidos_totais": 13.27,
        "ccs": 73800,
        "ufc": 251,
        "caseina": null,
        "sng": 8.99,
        "ureia": 13.46,
        "antibiotico": null,
        "bacteria": null,
        "temperatura": null
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 100,
      "total": 1
    }
  }
}
```

## GET /api/qualidade/relatorios/resumo

Resumo para tela de relatorios.

## GET /api/qualidade/relatorios/produtores

Query:

- `tipo`: `ativos`, `novos`, `inativos`
- `rota`: rota exata
- `mes`: mes de referencia
- `ano`: ano de referencia

Resposta:

```json
{
  "success": true,
  "data": {
    "tipo": "ativos",
    "totais": {},
    "opcoes": {},
    "items": []
  }
}
```
