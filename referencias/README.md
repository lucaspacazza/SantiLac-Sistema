# Referencias

Esta pasta guarda arquivos reais ou exemplos fieis que ajudam a entender formatos do negocio.

Arquivos aqui sao referencia de formato, nao codigo do sistema.

Quando possivel, usar dados anonimizados. Se forem dados reais, tratar com cuidado.

## Planilhas

Separar planilhas em:

```text
planilhas/importacao/
planilhas/exportacao/
```

### Importacao

Planilhas recebidas de fora e importadas pelo sistema.

Exemplo:

- planilha do laboratorio responsavel

Essas planilhas ajudam a criar parsers e testes do processor.

### Exportacao

Planilhas que hoje sao feitas/editadas manualmente e que o sistema deve gerar prontas no futuro.

Essas planilhas viram contrato de saida:

- abas
- colunas
- titulos
- ordem dos campos
- formulas
- totais
- formato visual
- regras de arredondamento

Objetivo final:

```text
alimentar o sistema -> processar dados -> gerar planilha pronta
```

