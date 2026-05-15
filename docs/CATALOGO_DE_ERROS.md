# Catalogo De Erros

Este documento define a regra de erros do SantiLac Core.

Objetivo: todo erro importante do sistema deve ter codigo documentado em um lugar central, para qualquer pessoa abrir a documentacao e entender exatamente o que aconteceu.

## Regra Principal

Todo erro controlado deve retornar ou registrar um codigo estavel.

O codigo deve ser usado por:

- frontend
- backend Laravel
- processor Python
- logs
- respostas de API
- erros por linha em importacoes
- auditoria

Nao escrever erro solto sem codigo quando o erro fizer parte de uma regra conhecida do sistema.

## Formato Do Codigo

Usar prefixo por area + numero.

Exemplos:

```text
AUTH_110
PERM_120
ROUTE_130
VALID_210
IMPORT_310
PRODUCER_410
ANALYSIS_510
EXPORT_610
PROCESSOR_710
SYSTEM_900
```

Evitar numero puro como `110`, porque no codigo ele perde contexto.

## Formato Padrao Do Erro

Resposta de API:

```json
{
  "success": false,
  "error": {
    "code": "IMPORT_310",
    "message": "Arquivo nao enviado.",
    "details": {
      "field": "arquivo"
    }
  }
}
```

Erro por linha em importacao:

```json
{
  "line": 12,
  "sheet": "Janeiro",
  "code": "PRODUCER_410",
  "message": "Produtor nao encontrado.",
  "details": {
    "produtor_codigo": 123
  }
}
```

## Campos Do Catalogo

Cada erro documentado deve ter:

- codigo
- area
- mensagem padrao
- onde pode acontecer
- causa provavel
- acao recomendada
- severidade
- origem possivel: frontend, backend, processor ou banco

## Severidades

```text
info      aviso ou comportamento esperado
warning   problema recuperavel
error     falha que impede a acao atual
critical  falha grave de sistema, dados ou infraestrutura
```

## Areas Iniciais

### Autenticacao

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| AUTH_110 | Usuario nao autenticado. | Sessao ausente, expirada ou token invalido. | Fazer login novamente. |
| AUTH_111 | Credenciais invalidas. | Usuario/senha incorretos. | Conferir credenciais. |

### Permissoes

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| PERM_120 | Usuario sem permissao para esta acao. | Nivel de acesso insuficiente. | Solicitar liberacao de acesso. |

### Rotas E Requisicoes

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| ROUTE_130 | Rota nao encontrada. | URL invalida ou endpoint inexistente. | Conferir rota chamada. |
| ROUTE_131 | Metodo HTTP nao permitido. | POST/GET/PUT/DELETE incorreto. | Corrigir metodo da requisicao. |

### Validacao

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| VALID_210 | Campo obrigatorio ausente. | Payload incompleto. | Enviar campo indicado em `details`. |
| VALID_211 | Valor em formato invalido. | Tipo ou formato nao aceito. | Corrigir valor informado. |

### Importacoes

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| IMPORT_310 | Arquivo nao enviado. | Campo de upload ausente. | Selecionar arquivo e reenviar. |
| IMPORT_311 | Formato de arquivo nao suportado. | Extensao fora de `.xlsx`, `.xls`, `.csv`. | Enviar arquivo compativel. |
| IMPORT_312 | Planilha vazia ou sem dados. | Arquivo sem linhas uteis. | Conferir planilha. |
| IMPORT_313 | Coluna obrigatoria ausente. | Cabecalho nao reconhecido. | Conferir campos obrigatorios. |
| IMPORT_314 | Planilha ja importada anteriormente. | Hash do arquivo ja existe. | Revisar importacao anterior ou reprocessar somente faltantes. |
| IMPORT_315 | Aba sem campos reconhecidos. | Aba nao contem dados gravaveis. | Conferir se a aba deveria ser importada. |

### Produtores

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| PRODUCER_410 | Produtor nao encontrado. | Codigo nao existe na base de produtores. | Conferir codigo do produtor. |
| PRODUCER_411 | Codigo de produtor invalido. | Codigo vazio, zero ou nao numerico. | Corrigir codigo. |
| PRODUCER_412 | Produtor inativo. | Produtor existe, mas esta marcado como inativo. | Confirmar regra do modulo antes de aceitar dado. |

### Analises Laboratoriais

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| ANALYSIS_510 | Data de analise invalida. | Data vazia ou impossivel de converter. | Corrigir data na planilha. |
| ANALYSIS_511 | Analise ja existente. | Ja existe registro para produtor + data. | Nao duplicar; completar apenas campos faltantes. |
| ANALYSIS_512 | Valor de analise invalido. | Numero, flag ou campo fora do formato esperado. | Conferir campo indicado em `details`. |

### Estoque

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| STOCK_810 | Item de estoque nao encontrado. | Item inexistente ou removido da base operacional. | Conferir item selecionado. |
| STOCK_811 | Local de estoque nao encontrado. | Local inexistente ou inativo. | Conferir local selecionado. |
| STOCK_812 | Saldo insuficiente. | Saida ou transferencia maior que o saldo disponivel. | Conferir saldo antes de movimentar. |
| STOCK_813 | Item de estoque inativo. | Item existe, mas nao pode receber movimentacao. | Reativar item ou escolher outro. |
| STOCK_814 | Tipo de movimentacao invalido. | Tipo fora das opcoes aceitas. | Usar entrada, saida, ajuste ou transferencia. |

### Exportacoes

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| EXPORT_610 | Falha ao gerar exportacao. | Erro no processor ou dados insuficientes. | Consultar logs e tentar novamente. |
| EXPORT_611 | Modelo de exportacao nao encontrado. | Template ausente ou caminho invalido. | Conferir configuracao do modulo. |

### Processor

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| PROCESSOR_710 | Falha ao executar processor. | Processo Python falhou. | Conferir logs do processor. |
| PROCESSOR_711 | Retorno do processor invalido. | JSON ausente ou fora do contrato. | Corrigir contrato Python/Laravel. |

### Sistema

| Codigo | Mensagem | Causa provavel | Acao recomendada |
| --- | --- | --- | --- |
| SYSTEM_900 | Erro interno do sistema. | Excecao nao tratada. | Consultar logs. |
| SYSTEM_901 | Banco de dados indisponivel. | Falha de conexao MySQL. | Verificar servidor/banco. |
| SYSTEM_902 | Arquivo nao encontrado no storage. | Caminho salvo nao existe. | Verificar storage e backups. |

## Regra Para Criar Novo Erro

Antes de criar erro novo:

1. Conferir se ja existe codigo equivalente.
2. Se existir, reutilizar.
3. Se nao existir, criar no catalogo antes ou junto da implementacao.
4. Adicionar teste quando o erro fizer parte de regra do modulo.

## Regra Para Mensagens

A mensagem padrao deve ser clara para operador.

Detalhes tecnicos ficam em `details` e logs.

Exemplo bom:

```text
Coluna obrigatoria ausente.
```

Com details:

```json
{
  "column": "codigo",
  "accepted_headers": ["IDPROD", "CODIGO", "PRODUTOR"]
}
```

Evitar mensagem tecnica crua para usuario final.

## Implementacao Futura

Quando o backend e processor forem criados, manter equivalentes deste catalogo:

```text
backend/config/errors.php
processor/shared/errors.py
frontend/src/shared/errors.ts
```

Esses arquivos devem refletir este catalogo.

O documento `docs/CATALOGO_DE_ERROS.md` continua sendo a fonte humana de consulta.
