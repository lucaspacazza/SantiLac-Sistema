# Padroes Do Core

Este documento define os padroes basicos do SantiLac Core.

Ele deve ser lido antes de criar qualquer modulo, processor, rota, tabela, importador, exportacao ou tela.

Objetivo: impedir que cada parte do sistema nasca de um jeito diferente.

## Regra Principal

Todo modulo deve nascer com contrato claro antes de codigo.

Nao começar por tela.

Nao começar por controller.

Nao começar por banco sem regra.

Ordem correta:

```text
regra -> contrato -> teste -> implementacao -> validacao -> promocao
```

## 1. Contrato De Modulo

Todo modulo operacional deve ter um documento proprio em:

```text
docs/modulos/NOME_DO_MODULO.md
```

Exemplo:

```text
docs/modulos/qualidade_analises.md
```

Template obrigatorio:

```text
# Modulo: Nome

## Objetivo

Qual problema este modulo resolve.

## Usuarios / Superficies

Quem usa:
- sistema interno
- administrativo
- app futuro
- processor
- dashboard

## Entradas

Quais dados entram no modulo.

Exemplos:
- planilha
- formulario
- app
- API
- dados de outro modulo

## Saidas

Quais dados o modulo entrega.

Exemplos:
- consulta
- dashboard
- exportacao Excel
- exportacao PDF
- API

## Tabelas

Tabelas raw/auditoria:
- ...

Tabelas validadas:
- ...

Tabelas dash:
- ...

## Processor

O que o Python faz neste modulo.

## Regras De Negocio

Lista clara das regras.

## Erros

Codigos usados do `docs/CATALOGO_DE_ERROS.md`.

## Exportacoes

Quais exportacoes o modulo precisa suportar.

## Testes Obrigatorios

Cenarios que precisam passar.

## Fora De Escopo Agora

O que este modulo nao vai fazer neste ciclo.

## Pendencias / Perguntas

O que ainda precisa ser decidido.
```

## 2. Padrao De Auditoria

Toda acao importante precisa deixar rastro.

Auditoria minima:

```text
quem fez
quando fez
origem da acao
arquivo usado, quando existir
hash do arquivo, quando existir
status antes/depois, quando fizer sentido
codigo de erro, quando falhar
mensagem/observacao
```

Acoes que devem ter auditoria:

- login/logout importante, se necessario
- importacao
- reprocessamento
- exportacao
- criacao de registro importante
- alteracao de registro importante
- inativacao
- exclusao, se algum dia existir
- chamada ao processor
- falha de processor

Para importacoes, guardar:

```text
id
arquivo_nome_original
arquivo_caminho_storage
arquivo_hash
usuario_id
status
total_linhas
linhas_validas
linhas_com_erro
ja_importado
created_at
processed_at
erro_codigo
erro_mensagem
```

## 3. Padrao De Erros

Todo erro controlado usa codigo do catalogo:

```text
docs/CATALOGO_DE_ERROS.md
```

Formato minimo de erro:

```json
{
  "code": "IMPORT_313",
  "message": "Coluna obrigatoria ausente.",
  "details": {}
}
```

Regras:

- nao retornar erro conhecido sem codigo
- nao criar codigo novo sem documentar
- texto pode mudar, codigo nao deve mudar sem motivo forte
- frontend deve usar codigo para comportamento e message para mostrar ao usuario
- logs devem registrar codigo e details

## 4. Contrato Laravel Para Python

Python nao acessa banco.

Laravel chama Python com um payload estruturado.

Formato padrao de entrada:

```json
{
  "operation": "qualidade.importar_analises",
  "request_id": "uuid-ou-id",
  "metadata": {
    "user_id": 1,
    "source": "web",
    "filename": "analises.xlsx",
    "file_hash": "sha256..."
  },
  "payload": {}
}
```

Formato padrao de saida:

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

Erro do processor:

```json
{
  "success": false,
  "operation": "qualidade.importar_analises",
  "summary": {
    "total": 0,
    "valid": 0,
    "errors": 1,
    "warnings": 0
  },
  "records": [],
  "errors": [
    {
      "code": "IMPORT_313",
      "message": "Coluna obrigatoria ausente.",
      "details": {
        "column": "codigo"
      }
    }
  ],
  "warnings": [],
  "metadata": {}
}
```

Regras:

- `success=false` quando a operacao nao pode seguir
- erro por linha deve incluir `line`, `sheet` quando existir
- warning nao bloqueia necessariamente
- Laravel valida o JSON antes de gravar qualquer coisa
- Laravel grava em transacao quando atualizar tabelas validadas
- request_id deve aparecer em logs do Laravel e do Python

## 5. Padrao De Nomes

### Pastas

Usar nomes em minusculo e com underscore quando precisar.

Exemplos:

```text
qualidade
analises_laboratoriais
mais_leite
notas_fiscais
```

### Tabelas

Preferir nomes claros.

Padroes:

```text
raw_*
dash_*
nome_funcional_do_modulo
```

Exemplos:

```text
raw_importacoes_analises
raw_importacoes_analises_linhas
resultadosanalises
dash_qualidade_produtor_mes
```

Observacao:

Quando uma tabela antiga esta correta e funcional, como `resultadosanalises`, manter o nome no primeiro ciclo para evitar reinvencao desnecessaria.

### Rotas API

Usar recurso e acao clara.

Exemplos futuros:

```text
POST /api/qualidade/analises/importacoes/preview
POST /api/qualidade/analises/importacoes
GET  /api/qualidade/analises/importacoes/{id}
GET  /api/qualidade/analises
GET  /api/qualidade/analises/exportacoes/{id}
```

### Processor

Organizar por modulo:

```text
processor/
  modules/
    qualidade/
      processing/
      exports/
      tests/
  shared/
```

### Codigos

Usar ingles tecnico simples ou portugues sem acento, mas manter padrao dentro da camada.

Banco pode manter nomes existentes quando vier do V3 funcional.

Codigo novo deve evitar acentos em nomes de arquivos, funcoes, classes e colunas.

## 6. Ambientes

Ambientes previstos:

```text
test
homolog
prod
```

### Test

Ambiente livre para quebrar.

Usado em `testes/`, testes automatizados e banco de teste.

Pode recriar tabela, limpar dados e experimentar.

### Homolog

Ambiente para validar antes de producao.

Deve ter dados parecidos com reais, mas nao deve ser a producao oficial.

Lucas valida fluxo aqui antes de subir.

### Prod

Ambiente da empresa.

Regras:

- nada entra sem teste
- nada entra sem validacao manual quando afetar fluxo real
- nada de gambiarra temporaria
- deploy precisa ter caminho de rollback
- alterar banco em prod exige cuidado extra

## 7. Padrao De Referencias

Arquivos de referencia ficam em:

```text
referencias/
```

Planilhas de entrada:

```text
referencias/planilhas/importacao/
```

Planilhas que o sistema deve gerar:

```text
referencias/planilhas/exportacao/
```

Regras:

- referencia mostra formato real
- referencia nao e codigo
- quando possivel, anonimizar dados
- nao depender de explicacao verbal quando uma planilha real pode provar o formato

## 8. Padrao Para Importacoes

Toda importacao deve ter:

- arquivo original salvo
- hash do arquivo
- usuario que importou
- data/hora
- status
- resumo
- erros estruturados
- possibilidade futura de baixar arquivo original

Fluxo recomendado:

```text
upload
  -> salva arquivo original
  -> calcula hash
  -> verifica se hash ja existe
  -> chama processor
  -> mostra preview quando existir
  -> confirma
  -> Laravel grava dados em transacao
  -> registra auditoria
```

Reimportacao:

- se hash ja existe, avisar
- nao duplicar dados
- nao sobrescrever dados existentes
- pode completar apenas dados faltantes

## 9. Padrao Para Exportacoes

Exportacao deve nascer compativel desde o modulo.

Mesmo que o botao da dashboard venha depois, o modulo deve preparar dados para exportacao.

Regra:

```text
dashboard pede exportacao
Laravel autoriza e chama processor quando necessario
Python prepara planilha/estrutura
Laravel entrega ou registra arquivo
```

Excel e obrigatorio para todos os modulos que tenham dados exportaveis.

PDF depende do modulo.

## 10. Checklist Antes De Codar Um Modulo

Antes de criar codigo, responder:

- Qual problema o modulo resolve?
- Quais dados entram?
- Quais dados saem?
- Quais tabelas existentes ja funcionam e devem ser mantidas?
- Quais tabelas novas sao realmente necessarias?
- Quais codigos de erro serao usados?
- O que o Python faz?
- O que o Laravel faz?
- O que o frontend faz?
- Quais testes provam que esta correto?
- Qual exportacao precisa nascer compativel?
- O que fica fora do primeiro ciclo?

Se alguma resposta importante estiver vazia, nao começar implementacao ainda.

