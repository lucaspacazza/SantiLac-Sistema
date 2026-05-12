# Modulo: Qualidade / Analises Laboratoriais

## Objetivo

Importar, validar e consultar analises laboratoriais de leite por produtor, mantendo o comportamento funcional do V3 e refazendo a implementacao no Core com Laravel, Python e testes.

Este e o primeiro bloco operacional dentro do modulo amplo de Qualidade.

## Usuarios / Superficies

- sistema interno: importacao e consulta das analises
- administrativo: auditoria, erros e exportacoes futuras
- processor: leitura e normalizacao das planilhas
- dashboard: consumo futuro de dados validados

## Entradas

- arquivos `.xlsx`
- arquivos `.xls`
- arquivos `.csv`
- produtores existentes em `santilac_raw.produtores`

## Saidas

- registros validados em `resultadosanalises`
- resumo da importacao
- erros por linha
- avisos por linha
- metadados de auditoria
- base futura para dashboard e exportacao

## Tabelas

Tabelas raw/auditoria:

- `raw_importacoes_analises`
- `raw_importacoes_analises_linhas`

Tabelas validadas:

- `resultadosanalises`

Tabelas dash:

- nenhuma no primeiro passo
- `dash_qualidade_produtor_mes` pode nascer depois, quando os indicadores forem fechados

## Processor

O Python deve:

- ler `.xlsx`, `.xls` e `.csv`
- detectar delimitador de CSV
- olhar todas as abas
- ignorar abas sem campos reconhecidos, registrando aviso quando necessario
- normalizar cabecalhos
- mapear colunas por nome reconhecido, nao por posicao
- normalizar codigo do produtor
- normalizar data para `YYYY-MM-DD`
- normalizar decimais
- normalizar CCS e UFC
- normalizar antibiotico e bacteria
- retornar registros, erros, avisos, resumo e metadados

O Python nao consulta banco e nao grava banco.

## Regras De Negocio

- A tabela `resultadosanalises` do V3 esta correta para o primeiro ciclo.
- Nao criar `clean_analises` agora.
- Campos obrigatorios: codigo do produtor e data.
- Produtor precisa existir para a analise ser gravada.
- Chave logica: `produtor_codigo + data`.
- Se a analise nao existe, inserir.
- Se a analise existe, completar somente campos vazios.
- Nao sobrescrever valor ja preenchido.
- Reimportar a mesma planilha nao duplica dados.
- Reimportacao pode completar dados faltantes.
- `0,0` em campos decimais continua sendo tratado como ausencia/null conforme regra do V3.
- Arquivo original deve ser salvo.
- Hash SHA-256 deve ser calculado.
- Hash ja importado deve gerar aviso controlado.
- Preview antes de confirmar deve ser suportado pelo desenho, mesmo que nao entre no primeiro commit.

## Erros

- `IMPORT_310`: arquivo nao enviado
- `IMPORT_311`: formato de arquivo nao suportado
- `IMPORT_312`: planilha vazia ou sem dados
- `IMPORT_313`: coluna obrigatoria ausente
- `IMPORT_314`: planilha ja importada anteriormente
- `IMPORT_315`: aba sem campos reconhecidos
- `PRODUCER_410`: produtor nao encontrado
- `PRODUCER_411`: codigo de produtor invalido
- `PRODUCER_412`: produtor inativo
- `ANALYSIS_510`: data de analise invalida
- `ANALYSIS_511`: analise ja existente
- `ANALYSIS_512`: valor de analise invalido
- `PROCESSOR_710`: falha ao executar processor
- `PROCESSOR_711`: retorno do processor invalido

## Exportacoes

Excel deve ser previsto desde o inicio, mas nao precisa ser a primeira entrega deste bloco.

Exportacoes futuras devem usar `resultadosanalises` ou tabelas dash, nunca raw diretamente.

## Testes Obrigatorios

- xlsx padrao do laboratorio
- xls compativel
- csv separado por ponto e virgula
- csv separado por virgula
- colunas em ordem trocada
- cabecalhos em maiusculo/minusculo
- cabecalhos com acento e sem acento
- linha vazia no meio
- varias abas
- aba sem campos reconhecidos
- produtor inexistente
- codigo de produtor invalido
- produtor inativo, se a regra bloquear no primeiro ciclo
- data serial Excel
- data `dd/mm/yyyy`
- data `yyyy-mm-dd`
- data invalida
- decimal com virgula
- decimal com ponto
- `0,0` virando null
- CCS com ponto, virgula, asterisco e texto misturado
- UFC com ponto, virgula e texto misturado
- ATB/BCL positivo e negativo
- coluna codigo ausente
- coluna data ausente
- reimportacao sem duplicar
- reimportacao completando campo vazio
- reimportacao sem sobrescrever campo preenchido

## Fora De Escopo Agora

- copiar o PHP do V3
- criar tela final de frontend
- criar dashboard completo
- mexer no app de coletas
- redesenhar a tabela `resultadosanalises`
- importar analise manual por formulario

## Pendencias / Perguntas

- confirmar schema exato de `raw_importacoes_analises`
- confirmar se produtor inativo bloqueia ou apenas avisa neste primeiro ciclo
- decidir se o primeiro teste usara fixtures anonimizadas ou uma planilha real de referencia
- decidir como o Laravel vai enviar a lista de produtores validos para validar o retorno do processor
