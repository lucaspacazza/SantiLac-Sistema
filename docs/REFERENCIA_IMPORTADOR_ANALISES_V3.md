# Referencia Do Importador De Analises Do V3

Este documento descreve como o importador atual do SantiLac V3 funciona.

Objetivo: usar o V3 como referencia de regra e comportamento esperado para criar o novo importador em Python no SantiLac Core.

Nao copiar codigo PHP para o Core.

Regra principal desta migracao:

```text
Nao reinventar o que ja esta pronto e funciona.
```

O importador PHP do V3 esta funcional e a tabela `resultadosanalises` do `santilac_db` esta correta para o primeiro desenho.

Portanto, o trabalho do Core e refatorar/portar o comportamento para Python de forma limpa, testada e organizada, mantendo a regra que ja funciona.

## Arquivos Consultados No V3

```text
Santilac_V3/modules/backend/qualidade/analises/importar.php
Santilac_V3/frontend/src/legacy/qualidade/analises.ts
Santilac_V3/frontend/scripts/qualidade/analises.js
Santilac_V3/modules/backend/qualidade/api/home.php
Santilac_V3/modules/backend/qualidade/api/produtores_index.php
Santilac_V3/modules/backend/qualidade/api/api_dash.php
Santilac_V3/database/schema/santilac_db.sql
```

## O Que O Importador Faz Hoje

O importador atual recebe uma planilha de analises laboratoriais e grava resultados por produtor e data.

Formatos aceitos:

- `.xlsx`
- `.xls`
- `.csv`

Fluxo atual:

```text
usuario seleciona arquivo
  -> frontend envia multipart/form-data para PHP
  -> PHP valida upload e extensao
  -> PHP le Excel via PhpSpreadsheet ou CSV via fgetcsv
  -> primeira linha vira cabecalho
  -> cabecalho e mapeado para campos internos
  -> cada linha e validada
  -> produtor precisa existir
  -> analise e inserida ou mesclada com analise existente
  -> log de importacao e gravado
  -> resposta JSON volta para tela
```

## Tela / Frontend Atual

A tela de importacao atual:

- mostra dropzone
- permite selecionar arquivo
- mostra nome e tamanho do arquivo
- habilita o botao somente quando ha arquivo
- envia `arquivo` via `FormData`
- consulta `?status=1` para saber se Excel esta liberado
- se PhpSpreadsheet nao estiver disponivel, recomenda CSV
- mostra mensagem de sucesso ou erro retornada pelo backend

Essa parte e referencia de UX, mas o Core nao precisa copiar a tela agora.

## Dependencia Atual Do PHP

Para Excel, o V3 depende de:

```text
PhpOffice\PhpSpreadsheet\IOFactory
```

Se `vendor/autoload.php` ou PhpSpreadsheet nao existir, o backend informa que Excel nao esta disponivel.

No Core, essa dependencia deve sair do PHP e ir para o Python.

Sugestao para Python:

- `openpyxl` para `.xlsx`
- biblioteca propria/compatibilidade para `.xls` se ainda for necessario
- `csv` da standard library para `.csv`
- `pandas` somente se ajudar de verdade, sem virar dependencia pesada desnecessaria

## Leitura De CSV Atual

O V3 tenta delimitadores:

```text
;
,
tab
```

Ele usa o primeiro delimitador que gerar mais de uma linha.

No Core, manter essa ideia, mas melhorar:

- detectar delimitador de forma mais confiavel
- registrar qual delimitador foi usado
- retornar erro claro se nao conseguir ler

## Regras De Cabecalho

O V3 usa a primeira linha da planilha como cabecalho.

O mapeamento atual nao depende da posicao fixa da coluna.

Ele procura nomes conhecidos no cabecalho.

Campos obrigatorios:

- codigo do produtor
- data da analise/coleta

Se faltar codigo:

```text
Coluna IDPROD/Codigo nao encontrada na planilha.
```

Se faltar data:

```text
Coluna DATA/Analise nao encontrada na planilha.
```

No Core, a regra deve continuar:

```text
mapear por cabecalho normalizado, nao por indice fixo
```

Exemplos que devem funcionar:

```text
| codigo | nome |
| nome | codigo |
| NOME | CODIGO |
| CODIGO | NOME |
```

## Mapeamento De Colunas Do V3

### Codigo Do Produtor

Cabecalhos aceitos hoje:

```text
IDPROD
IDPRODUTOR
CODIGO
CODIGO com acento
PRODUTOR
```

Campo interno:

```text
produtor_codigo
```

Observacao importante:

O V3 aceita mais de uma coluna que pareca codigo do produtor. Na hora de extrair, ele percorre as colunas candidatas e usa o primeiro valor numerico valido.

No Core, manter essa ideia, porque algumas planilhas podem ter colunas ambíguas.

### Data

Cabecalhos aceitos hoje:

```text
ANALISE
ANALISE com acento
DATA
DATA_ANALISE
DATA_ANALISE com acento
DATA COLETA
COLETA
```

Campo interno:

```text
data
```

Assim como codigo, o V3 aceita mais de uma coluna candidata e usa a primeira data valida.

### Gordura

Cabecalhos:

```text
GORD
GORDURA
%GORDURA
```

Campo interno:

```text
gordura
```

### Proteina

Cabecalhos:

```text
PROT
PROTEINA
PROTEINA com acento
%PROTEINA
```

Campo interno:

```text
proteina
```

### Lactose

Cabecalhos:

```text
LACT
LACTOSE
%LACTOSE
```

Campo interno:

```text
lactose
```

### Solidos Totais

Cabecalhos:

```text
SOL
SOLIDOS
SOLIDOS com acento
SOLIDOS TOTAIS
%SOL
```

Campo interno:

```text
solidos_totais
```

### CCS

Cabecalho:

```text
CCS
```

Campo interno:

```text
ccs
```

### UFC

Cabecalho:

```text
UFC
```

Campo interno:

```text
ufc
```

### Caseina

Cabecalhos:

```text
CASE
CASEINA
CASEINA com acento
%CASEINA
```

Campo interno:

```text
caseina
```

### SNG

Cabecalhos:

```text
SNG
SNF
```

Campo interno:

```text
sng
```

### Ureia

Cabecalhos:

```text
UREI
UREIA
```

Campo interno:

```text
ureia
```

### Antibiotico

Cabecalhos:

```text
ATB
ANTIBIOTICO
ANTIBIOTICO com acento
INIBIDOR
```

Campo interno:

```text
antibiotico
```

### Bacteria

Cabecalhos:

```text
BCL
BACTERIA
BACTERIA com acento
```

Campo interno:

```text
bacteria
```

### Temperatura

Cabecalhos:

```text
TEMPERATURA
TEMP
T C / T(C) / T graus
```

Campo interno:

```text
temperatura
```

## Normalizacao De Cabecalho Para O Core

O V3 faz `trim` e `uppercase`.

No Core, melhorar para:

- remover espacos extras
- converter para maiusculo
- remover acentos
- remover simbolos irrelevantes quando fizer sentido
- padronizar underscores e espacos
- aceitar sinonimos documentados

Exemplo:

```text
" Código " -> "CODIGO"
"CÓDIGO" -> "CODIGO"
"data análise" -> "DATA ANALISE"
"DATA_ANALISE" -> "DATA ANALISE"
```

## Regras De Linha

O V3 percorre da segunda linha em diante.

Para cada linha:

- incrementa total de linhas processadas
- ignora linha totalmente vazia
- extrai dados pelo mapa de indices
- valida codigo do produtor
- valida data
- verifica se o produtor existe
- tenta salvar
- registra erro por linha se falhar

Erros atuais por linha:

- codigo ou data invalidos
- produtor nao encontrado
- erro ao salvar
- excecao inesperada na linha

No Core, cada erro deve ser estruturado:

```json
{
  "line": 12,
  "code": "PRODUCER_NOT_FOUND",
  "field": "produtor_codigo",
  "message": "Produtor 123 nao encontrado."
}
```

## Validacao De Produtor

O V3 consulta:

```sql
SELECT COUNT(*) FROM produtores WHERE codigo = ?
```

Regra de negocio:

```text
analise so entra se produtor_codigo existir na base de produtores
```

No Core:

- Python nao consulta banco
- `IDPROD` e a identidade da linha de analise
- se houver `IDPROD` na planilha, ele tem prioridade sobre qualquer outra coluna parecida com codigo
- Laravel valida cada `IDPROD` depois que o processor normaliza a planilha
- se um `IDPROD` nao existir em `produtores`, somente aquela linha falha
- as linhas com `IDPROD` existente continuam e devem ser gravadas normalmente
- a resposta precisa trazer aviso com a lista dos codigos de produtores que falharam

Exemplo esperado:

```json
{
  "warnings": [
    {
      "code": "PRODUCER_410",
      "message": "Alguns produtores da planilha nao existem no banco e foram ignorados.",
      "details": {
        "produtor_codigos": ["999", "1000"]
      }
    }
  ]
}
```

## Conversao De Codigo Do Produtor

O V3 aceita codigo numerico com caracteres comuns de numero.

Regra:

- valor precisa comecar com digito
- remove pontos e virgulas
- remove caracteres nao numericos
- converte para inteiro
- precisa ser maior que zero

No Core:

- manter codigo como inteiro operacional
- preservar valor bruto no raw
- retornar erro se nao virar inteiro positivo

## Conversao De Data

O V3 aceita:

- serial numerico do Excel
- `dd/mm/yyyy`
- `yyyy-mm-dd`
- `dd-mm-yyyy`
- `dd.mm.yyyy`

Para serial Excel:

```text
base = 1899-12-30
```

Aceita serial aproximadamente entre:

```text
20000 e 80000
```

Saida normalizada:

```text
YYYY-MM-DD
```

Depois valida se a data realmente existe.

No Core:

- manter a saida ISO `YYYY-MM-DD`
- preservar valor original no raw
- erro claro quando data nao puder ser convertida

## Conversao De Decimais

Campos decimais:

- gordura
- proteina
- lactose
- solidos_totais
- caseina
- sng
- ureia
- temperatura

Valores considerados vazios/nulos no V3:

```text
vazio
--
NULL
N/A
-
0,0
```

Conversao atual:

- remove pontos
- troca virgula por ponto
- remove caracteres fora de numero, ponto e sinal
- converte para float se numerico

Atencao:

No V3, `0,0` vira `null` para campos decimais.

No Core, confirmar se isso deve continuar para todos os campos ou apenas onde laboratorio usa `0,0` como ausencia.

## Conversao De CCS

Valores vazios/nulos:

```text
vazio
--
NULL
N/A
-
```

Conversao:

- remove `**`, `*`, ponto e virgula
- remove tudo que nao for numero
- converte para inteiro

Exemplo:

```text
73.800 -> 73800
73,800 -> 73800
**73800 -> 73800
```

## Conversao De UFC

Usa conversao inteira geral:

- remove ponto e virgula
- remove nao numericos
- converte para inteiro

## Conversao De Antibiotico E Bacteria

Valores positivos aceitos:

```text
POS
POSITIVO
+
P
```

Saida:

```text
1.0
```

Valores negativos aceitos:

```text
NEG
NEGATIVO
-
N
0
```

Saida:

```text
0.0
```

Se nao for flag conhecida, tenta converter como decimal.

No Core, recomendacao:

- internamente tratar como boolean/enum limpo (`POS`, `NEG` ou null) ou decimal somente se houver motivo real
- manter compatibilidade de exibicao com `POS`/`NEG`
- decidir schema da tabela validada de analises antes de implementar

## Regra De Insercao E Atualizacao

Chave unica atual:

```text
produtor_codigo + data
```

No V3, antes de salvar:

```sql
SELECT * FROM resultadosanalises
WHERE produtor_codigo = ?
  AND data = ?
```

Se nao existe:

- insere nova analise
- so inclui campos que nao sao null
- exige produtor_codigo e data
- grava `created_at`

Se existe:

- faz merge
- atualiza somente campos que estao null no banco e vieram preenchidos na nova planilha
- nao sobrescreve valor existente
- se nada mudou, retorna `no_changes`
- se mudou, atualiza `updated_at`

Regra importante:

```text
importar a mesma planilha de novo nao deve duplicar analise
```

Regra ainda mais importante:

```text
uma importacao posterior nao deve sobrescrever automaticamente dado ja preenchido
```

No Core, essa regra precisa ser explicitada em teste.

## Tabela Atual De Destino No V3

Tabela:

```text
resultadosanalises
```

Campos principais:

```text
id
produtor_codigo
data
gordura
proteina
lactose
solidos_totais
ccs
ufc
caseina
sng
ureia
antibiotico
bacteria
temperatura
created_at
updated_at
```

Indices:

```text
primary key id
unique produtor_codigo + data
index data
index produtor_codigo
```

No Core, a referencia inicial deve ser a propria tabela funcional do V3:

```text
resultadosanalises
```

Essa tabela esta correta para o primeiro ciclo e nao deve ser redesenhada sem necessidade.

Tabela atual:

```text
id
produtor_codigo
data
gordura
proteina
lactose
solidos_totais
ccs
ufc
caseina
sng
ureia
antibiotico
bacteria
temperatura
created_at
updated_at
```

Indices importantes:

```text
unique produtor_codigo + data
index data
index produtor_codigo
```

Decisao importante: analises laboratoriais nao precisam passar para uma tabela `clean_*`.

As importacoes, arquivo original, hash e logs ficam em raw/auditoria. Os resultados validados entram direto em `resultadosanalises`, mantendo a estrutura funcional do V3.

Se no futuro for necessario mudar nome ou remover campos, isso deve ser decisao consciente e testada, nao uma invencao inicial.

## Log Atual De Importacao No V3

Tabela:

```text
logimportacoesanalises
```

Campos:

```text
id
arquivo_nome
data_importacao
total_linhas
linhas_importadas
linhas_com_erro
usuario_id
observacoes
```

No Core, essa ideia deve continuar, mas ligada ao raw:

```text
raw_importacao_id
arquivo_nome
arquivo_hash
usuario_id
status
total_linhas
linhas_validas
linhas_com_erro
created_at
processed_at
```

## Resposta JSON Atual

Em sucesso ou erro, o V3 retorna:

```json
{
  "success": true,
  "message": "...",
  "html_message": "...",
  "resultado": {
    "total_linhas": 25,
    "linhas_importadas": 24,
    "linhas_com_erro": 1,
    "erros": []
  },
  "errors": [],
  "phpspreadsheet_available": true,
  "phpspreadsheet_status": "..."
}
```

No Core, o retorno deve ser mais estruturado e sem depender de HTML.

Sugestao:

```json
{
  "success": true,
  "import_id": 123,
  "summary": {
    "total_rows": 25,
    "accepted_rows": 24,
    "error_rows": 1,
    "created": 20,
    "merged": 4,
    "unchanged": 0
  },
  "errors": []
}
```

## Direcao Para O Processor Python

O processor Python deve ser organizado por modulo:

```text
processor/
  modules/
    qualidade/
      processing/
        import_analyses.py
        normalize_analysis_row.py
        header_map.py
      exports/
      tests/
        fixtures/
          laboratorio_padrao.xlsx
          laboratorio_colunas_trocadas.xlsx
          laboratorio_datas_excel.xlsx
```

Possivel fluxo no Core:

```text
Laravel recebe arquivo
  -> salva arquivo/metadados em raw
  -> extrai ou envia arquivo ao processor
  -> processor le planilha
  -> processor retorna linhas normalizadas + erros
  -> Laravel valida produtores existentes
  -> Laravel grava raw_linhas/auditoria e resultadosanalises em transacao
  -> Laravel atualiza status da importacao
```

Alternativa:

```text
Laravel recebe arquivo
  -> passa arquivo para processor
  -> processor retorna dados brutos estruturados e dados normalizados
  -> Laravel grava raw/auditoria e resultadosanalises
```

Decisao recomendada:

```text
Laravel continua dono da persistencia.
Python fica dono da leitura, normalizacao e preparacao da importacao.
```

## Testes Obrigatorios Para O Core

Criar testes para:

- xlsx padrao do laboratorio
- csv separado por ponto e virgula
- csv separado por virgula
- colunas em ordem trocada
- cabecalhos em maiusculo/minusculo
- cabecalhos com acento e sem acento
- linha vazia no meio da planilha
- produtor inexistente
- codigo de produtor invalido
- data em serial Excel
- data em `dd/mm/yyyy`
- data invalida
- decimal com virgula
- decimal com ponto
- CCS com ponto, virgula, asterisco e texto misturado
- ATB/BCL positivo e negativo
- reimportacao da mesma planilha nao duplica
- nova importacao preenche campo nulo sem sobrescrever campo ja preenchido
- erro de coluna obrigatoria ausente

## Planilha Real De Referencia

Arquivo colocado como referencia real:

```text
referencias/planilhas/importacao/SantiLac Laticinios LTDA_145136.xlsx
```

Resumo inspecionado:

```text
aba: Plan1
dimensao: A1:X64
linhas XML: 64
linhas de dados depois do cabecalho: 63
produtores unicos por IDPROD: 63
data de coleta encontrada: 19/03/2026
```

Cabecalho real:

```text
CODBARRAS
IDENTIFICACAO
DOCUMENTO
ROTA
COLETA
ANALISE
IDPROD
GORD
PROT
LACT
SOL
CCS
UFC
CASE
SNG
UREI
ATB
BCL
NRO_RELATORIO
TEMPERATURA
BLC %
NRO LACTACAO
CIDASC
```

Observacoes importantes:

- `IDPROD` existe e esta preenchido em todas as 63 linhas.
- `COLETA` esta preenchido em todas as 63 linhas e deve ser usado como data da analise quando `ANALISE` vier vazio.
- `ANALISE` veio vazio em todas as linhas dessa planilha.
- `IDENTIFICACAO`, `DOCUMENTO` e `ROTA` vieram preenchidos, mas no primeiro ciclo sao dados auxiliares/referencia da linha, nao chave da analise.
- `CODBARRAS`, `NRO_RELATORIO`, `BLC %`, `NRO LACTACAO` e `CIDASC` vieram vazios nessa amostra.
- `CASE`, `ATB` e `BCL` vieram com `--` nessa amostra, entao devem virar `null` conforme regra atual.
- valores decimais vieram com virgula brasileira, exemplo `3,61`.
- `CCS` e `UFC` vieram como inteiros sem separador de milhar nessa amostra.
- `TEMPERATURA` veio preenchida como decimal com virgula, exemplo `3,4`.

Exemplo real de linha:

```text
IDENTIFICACAO: Valdecir Pedro Cella
DOCUMENTO: 65685040920
ROTA: Linha 01
COLETA: 19/03/2026
IDPROD: 1098
GORD: 3,61
PROT: 3,19
LACT: 4,68
SOL: 12,41
CCS: 1034
UFC: 67
CASE: --
SNG: 8,8
UREI: 13,09
ATB: --
BCL: --
TEMPERATURA: 3,4
```

Regra ajustada a partir da planilha real:

```text
campo de data preferencial: ANALISE quando preenchido
fallback de data: COLETA quando ANALISE estiver vazio
```

O teste do processor deve usar essa planilha real como fixture inicial.

## Pontos Para Decidir Antes De Implementar

- Como calcular hash do arquivo para detectar reenvio?

## Decisoes Fechadas Para O Core

### Antibiotico E Bacteria

`antibiotico` e `bacteria` ficam como estao na tabela funcional do V3 enquanto ela for mantida como referencia.

A decisao anterior de nao colocar esses campos na tabela validada fica cancelada para o primeiro ciclo, porque a tabela `resultadosanalises` ja existe, funciona e possui esses campos.

Regra atual:

```text
manter a estrutura funcional do V3
```

### Valor `0,0`

Manter como esta no V3.

No V3 essa regra ja foi ajustada para funcionar do jeito esperado.

Portanto, para campos decimais das analises, valores como `0,0` continuam sendo tratados como ausencia de dado/null conforme a regra atual.

### Formatos Suportados

Manter suporte a:

- `.xlsx`
- `.xls`
- `.csv`

Motivo: compatibilidade com todos os arquivos que podem chegar.

### Arquivo Original Importado

Guardar todas as planilhas originais importadas em storage/disco.

Objetivo futuro:

```text
permitir baixar novamente a planilha original diretamente do servidor
```

No Core, a importacao deve guardar pelo menos:

- nome original do arquivo
- caminho/storage do arquivo salvo
- usuario que importou
- data/hora da importacao
- status do processamento
- resumo de linhas
- erros estruturados, se existirem

### Varias Abas

O importador deve olhar todas as abas da planilha.

Regra:

```text
Se uma aba tiver cabecalhos/campos reconhecidos de analises, ela deve ser processada.
```

Se uma aba nao tiver campos gravaveis de analises, ela deve ser ignorada ou marcada como sem dados uteis, sem quebrar a importacao.

O processor precisa registrar de qual aba veio cada linha, pelo menos no raw/resultado de processamento.

### Pre-visualizacao

Hoje o V3 nao tem pre-visualizacao.

No Core, pre-visualizacao e desejavel.

Ideia:

```text
usuario envia planilha
  -> processor le e normaliza
  -> sistema mostra uma tela com como os dados vao ficar
  -> usuario confirma
  -> Laravel grava/processa definitivamente
```

A pre-visualizacao deve mostrar:

- linhas reconhecidas
- produtores encontrados
- produtores nao encontrados
- campos que serao gravados
- campos ignorados
- erros por linha
- abas processadas
- resumo total antes de confirmar

Isso nao precisa entrar no primeiro commit do importador, mas o desenho deve nascer compativel com essa etapa.

## Explicacao Sobre Hash

Hash e uma assinatura tecnica do arquivo.

Exemplo mental:

```text
mesmo arquivo -> mesmo hash
arquivo alterado -> hash diferente
```

Ele serve para detectar se a mesma planilha ja foi enviada antes, mesmo que o usuario tente importar de novo.

Uso possivel:

- avisar que o arquivo parece ja ter sido importado
- permitir reprocessamento consciente
- auditar historico de arquivos enviados

Decisao fechada:

```text
Se o mesmo hash ja foi importado, o sistema deve avisar que a planilha ja foi importada.
```

Mas nao deve substituir dados ja gravados.

Regra de reimportacao:

```text
reimportar a mesma planilha nao duplica e nao sobrescreve dados existentes
```

Se na primeira importacao algum campo/linha nao foi inserido e agora puder ser inserido corretamente, o sistema pode preencher somente o que estava faltando.

Ou seja:

- arquivo repetido gera aviso
- dados existentes nao sao substituidos
- dados faltantes podem ser completados
- o historico da tentativa deve ficar registrado

Sugestao tecnica: calcular SHA-256 do arquivo original salvo.
