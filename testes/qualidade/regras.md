# Regras Do Laboratorio: Qualidade

## Escopo

O laboratorio de Qualidade cobre o modulo amplo, mas o primeiro bloco testavel e:

```text
qualidade / analises laboratoriais
```

## Ordem

1. Criar contrato.
2. Criar fixtures.
3. Criar testes automatizados.
4. Implementar no processor.
5. Integrar Laravel depois que o processor estiver validado.

## Regra Principal

O parser de analises deve ser tolerante ao formato da planilha, mas rigoroso com regra.

Pode variar:

- ordem das colunas
- maiusculo/minusculo
- acentos em cabecalho
- delimitador de CSV
- formato de data suportado
- decimal com virgula ou ponto

Nao pode faltar:

- codigo do produtor
- data da analise

## Contrato Do Processor

Funcao inicial esperada pelos testes:

```python
parse_analysis_file(file_path, valid_producer_codes=None)
```

Entrada:

- `file_path`: caminho do arquivo `.csv`, `.xlsx` ou `.xls`
- `valid_producer_codes`: conjunto opcional de codigos de produtores conhecidos

Saida:

```json
{
  "success": true,
  "operation": "qualidade.importar_analises",
  "summary": {
    "total": 0,
    "valid": 0,
    "errors": 0,
    "warnings": 0
  },
  "records": [],
  "errors": [],
  "warnings": [],
  "metadata": {}
}
```

## Resultado Validado

Cada registro valido deve sair com:

- `produtor_codigo`
- `data`
- campos de analise quando existirem
- `line`
- `sheet`

O processor nao grava banco.

