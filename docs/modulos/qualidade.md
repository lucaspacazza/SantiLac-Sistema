# Modulo: Qualidade

## Objetivo

Centralizar a qualidade operacional dos produtores no SantiLac Core.

Este modulo nao e apenas importacao de analises. Ele cobre a visao de qualidade do produtor, historico laboratorial, indicadores, relatórios, programas ligados a produtores e entradas auxiliares como notas, sempre usando o V3 como referencia de negocio e nao como base de codigo.

## Usuarios / Superficies

- sistema interno: consulta de produtores, qualidade, importacoes, relatorios e operacao diaria
- administrativo: auditoria, exportacoes, historicos e acompanhamento de resultados
- processor: leitura, normalizacao, validacao e preparacao de dados tabulares
- dashboard: indicadores de qualidade e resumos por produtor
- app futuro: pode consumir dados de notas, produtor, qualidade e historico validado

## Entradas

- planilhas de analises laboratoriais
- base central de produtores do `santilac_raw`
- dados de coletas quando o modulo de coletas existir
- documentos de notas fiscais em PDF/XML quando essa integracao entrar no Core
- entregas do programa Mais Leite quando esse subfluxo for refeito

## Saidas

- listagem de produtores com ultima analise
- painel do produtor com dados cadastrais, analises recentes e historico operacional
- relatorios de produtores ativos, novos e inativos
- indicadores de qualidade por periodo
- exportacoes Excel
- exportacoes PDF quando fizer sentido
- APIs para frontend e futuras integracoes

## Tabelas

Tabelas raw/auditoria:

- `raw_importacoes_analises`
- `raw_importacoes_analises_linhas`
- futuras tabelas raw para notas e Mais Leite, quando esses blocos entrarem

Tabelas validadas:

- `resultadosanalises`
- manter a estrutura funcional do V3 no primeiro ciclo

Tabelas dash:

- `dash_qualidade_produtor_mes`, quando os indicadores mensais forem promovidos
- agregados de relatorios devem nascer de dados validados, nao de raw direto

## Processor

O Python processa dados recebidos em JSON ou arquivo salvo pelo Laravel e devolve JSON estruturado.

No primeiro ciclo, o processor faz:

- leitura de `.xlsx`, `.xls` e `.csv`
- deteccao de abas com campos de analises
- normalizacao de cabecalhos
- normalizacao de codigo, data, decimais, CCS, UFC, antibiotico, bacteria e temperatura
- identificacao de erros e avisos por linha
- preparacao de preview e retorno validavel pelo Laravel

O processor nao acessa banco.

## Regras De Negocio

- Qualidade e um modulo amplo, com subfluxos internos.
- Produtores nao sao modulo; sao base central usada por Qualidade.
- Analise laboratorial so entra se o produtor existir.
- A tabela `resultadosanalises` do V3 fica como destino validado no primeiro ciclo.
- Importacao de analises nao grava em `clean_*`.
- Arquivo original importado deve ser preservado.
- Hash do arquivo deve ser calculado para detectar reenvio.
- Reimportacao nao duplica dados.
- Reimportacao nao sobrescreve campo ja preenchido.
- Reimportacao pode completar campo ausente.
- Dashboard e relatorios nao consultam raw diretamente.
- O V3 serve para entender fluxo e regra, nao para copiar PHP.

## Subfluxos Do V3 Que Servem De Referencia

- home do modulo com produtores ativos, analises importadas, ultima analise e periodo atual
- importacao de analises laboratoriais
- gestao/listagem de produtores com ultima analise por produtor
- painel do produtor com identidade, producao, coletas, historico e analises recentes
- relatorios do modulo, incluindo ativos, novos, inativos, litros do mes, melhor produtor e evolucao mensal
- Mais Leite, com produtores participantes, produtos, entregas, historico e exportacao
- notas fiscais, com envio de PDF/XML por competencia para integracao externa

## Erros

Usar codigos do `docs/CATALOGO_DE_ERROS.md`.

Codigos iniciais:

- `IMPORT_310`
- `IMPORT_311`
- `IMPORT_312`
- `IMPORT_313`
- `IMPORT_314`
- `IMPORT_315`
- `PRODUCER_410`
- `PRODUCER_411`
- `PRODUCER_412`
- `ANALYSIS_510`
- `ANALYSIS_511`
- `ANALYSIS_512`
- `PROCESSOR_710`
- `PROCESSOR_711`
- `EXPORT_610`

## Exportacoes

O modulo deve nascer compativel com Excel.

No V3 existe exportacao do Mais Leite e relatorios operacionais. No Core, a regra e:

- exportacao usa dados validados ou dash
- dashboard solicita a exportacao
- Laravel autoriza e entrega
- processor prepara planilhas quando houver regra tabular complexa

## Testes Obrigatorios

Primeiro bloco, analises laboratoriais:

- xlsx padrao do laboratorio
- csv separado por ponto e virgula
- csv separado por virgula
- colunas em ordem trocada
- cabecalhos com acento, sem acento, maiusculo e minusculo
- varias abas, com abas uteis e abas ignoradas
- linha vazia no meio da planilha
- produtor inexistente
- codigo de produtor invalido
- data em serial Excel
- data em `dd/mm/yyyy`
- data invalida
- decimal com virgula e ponto
- CCS/UFC com pontuacao e caracteres extras
- ATB/BCL positivo e negativo
- reimportacao sem duplicar
- completar campo nulo sem sobrescrever valor existente
- coluna obrigatoria ausente

Blocos futuros:

- painel do produtor
- relatorios de produtores
- indicadores mensais
- Mais Leite
- notas fiscais

## Fora De Escopo Agora

- copiar codigo PHP do V3
- refazer todo o modulo de uma vez
- app de coletas
- CRUD completo de produtores
- reescrever a tabela `resultadosanalises` sem necessidade
- dashboard final antes do contrato e testes

## Pendencias / Perguntas

- definir quais indicadores de qualidade entram no primeiro painel
- decidir se o primeiro bloco do laboratorio cobre apenas analises ou ja inclui contratos do painel do produtor
- definir como o Laravel passara produtores validos para o processor
- definir tabelas raw exatas da importacao de analises
- definir quando Mais Leite e notas entram no roadmap do Core
