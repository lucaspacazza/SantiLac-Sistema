# Memoria Do Projeto SantiLac Core

Este arquivo e a memoria oficial das decisoes tomadas ate agora.

Ele existe para continuar o trabalho em outro PC sem repetir toda a conversa, sem rediscutir o basico e sem deixar o projeto virar outra base improvisada.

## Capacidade Que O Sistema Deve Entregar

O SantiLac Core deve ser o sistema operacional do laticinio: uma base confiavel para operacao, administracao, qualidade, producao, relatorios, exportacoes e futuras integracoes com aplicativos.

Ele precisa ser serio, profissional, testado e sustentavel. Nao e um prototipo visual. Nao e uma tela bonita por cima de dados baguncados.

## Motivo Do Recomeco

O SantiLac V3 ficou dificil de manter porque:

- muita coisa nasceu pelo frontend
- o backend foi encaixado depois
- dados brutos, calculos e dashboards ficaram misturados
- algumas correcoes viraram remendos
- codigo antigo ficou convivendo com codigo novo
- bugs foram corrigidos sem uma base forte de testes
- o design mudou muitas vezes porque o sistema ainda nao passava confianca

Decisao: recomecar limpo com o V3 apenas como referencia de negocio, nao como base de codigo.

## Decisoes Fixas

- Banco obrigatorio: MySQL.
- Backend: Laravel.
- Frontend: React + TypeScript + Vite.
- Processor de dados/calculos: Python.
- Python nao acessa banco.
- Laravel e o unico responsavel por consultar e gravar MySQL.
- Dados brutos ficam separados de dados limpos.
- Dashboard e relatorios nunca consomem dados brutos diretamente.
- O sistema antigo pode ser consultado, mas codigo antigo nao entra no Core.
- Tudo deve nascer com teste antes de virar sistema principal.
- O laboratorio `testes/` pode errar, apagar e refazer.
- Producao recebe apenas o que foi validado.

## Arquitetura Decidida

Fluxo principal:

```text
frontend/apps
  -> Laravel API
  -> MySQL raw
  -> Laravel job/orquestrador
  -> Python processor
  -> Laravel valida retorno
  -> MySQL validado do modulo / dash
  -> frontend dashboards/relatorios
```

Separacao de responsabilidades:

- `backend/`: API, autenticacao, permissoes, raw writes, escritas validadas do modulo, exports, auditoria e orquestracao do processor.
- `frontend/`: telas operacionais, administrativas e dashboards.
- `processor/`: funcoes Python puras para limpar, validar e calcular dados recebidos em JSON.
- `database/`: contratos de tabelas raw, validadas e dash.
- `testes/`: laboratorio para construir modulo por modulo antes de promover.
- `docs/`: memoria, decisoes, regras e arquitetura.

## Regra Raw / Tabela Validada / Dash

Tudo que entra no sistema deve ser preservado em raw.

Tudo que a empresa usa como verdade deve vir de tabela validada do modulo ou de dash.

Exemplo:

```text
raw_analises
analises_laboratoriais
dash_qualidade_produtor_mes
```

O raw guarda a entrada e o historico de processamento.

A tabela validada do modulo guarda dados normalizados e confiaveis para consulta.

O dash guarda agregados prontos para telas, relatorios, PDF e Excel.

Observacao importante: nem todo modulo precisa ter uma tabela chamada `clean_*`.

No caso de analises laboratoriais, as importacoes nao entram em `clean`. O arquivo e o historico de importacao ficam em raw/auditoria, e os resultados validados entram diretamente em uma tabela propria de analises, com exatamente as colunas necessarias para consulta.

## Regra Sobre O Python

O Python deve receber dados brutos em JSON, processar e devolver JSON.

Permitido:

- validar estrutura
- normalizar campos
- calcular indicadores
- encontrar erros
- retornar avisos
- retornar dados limpos

Proibido:

- abrir conexao MySQL
- conhecer credenciais
- gravar tabela
- consultar tabela
- depender de estado externo para funcionar

Contrato mental:

```text
entrada JSON -> processamento puro -> saida JSON
```

O Python tambem sera usado para preparar exportacoes, principalmente planilhas Excel, porque e forte para dados, calculos e arquivos tabulares.

Regra para exportacoes no processor:

- cada modulo deve ter sua propria area de processamento
- cada modulo deve ter sua propria area de exportacao
- logica de calculo nao deve ficar misturada com logica de geracao de planilha
- codigo comum pode existir, mas precisa ser pequeno, claro e reutilizavel
- se uma exportacao falhar, deve ser facil saber em qual modulo e em qual etapa falhou
- o processor deve ser facil de integrar com novos modulos sem quebrar os antigos

Fronteira de responsabilidade:

- Python prepara dados, estruturas e arquivos de exportacao quando necessario
- Laravel chama o processor, valida retorno, salva metadados/arquivo se precisar e entrega para a dashboard/API
- Dashboard apenas pede a exportacao, nao monta regra de relatorio

Organizacao esperada do processor:

```text
processor/
  modules/
    qualidade/
      processing/
      exports/
      tests/
    producao/
      processing/
      exports/
      tests/
  shared/
```

Essa estrutura pode ser ajustada quando o projeto Python nascer, mas a regra e manter separacao por modulo desde o primeiro dia.

## Regra Sobre O Laravel

Laravel e o dono da persistencia.

Responsabilidades:

- receber requisicoes
- validar entrada inicial
- gravar raw
- buscar raw pendente
- chamar Python
- validar retorno do Python
- abrir transacao
- gravar tabelas validadas do modulo/dash
- registrar erro de processamento
- servir API para frontend e apps
- gerar exportacoes PDF/Excel
- aplicar permissoes

## Regra Sobre O Frontend

Frontend nao define regra critica.

Frontend nao calcula o que deve ser verdade da empresa.

Frontend consome API e mostra dados limpos.

Ordem correta de criacao:

```text
dominio -> testes -> raw/auditoria -> processor -> tabela validada -> API -> frontend
```

## Sistema Principal Vs Administrativo

A ideia de separar superficies continua valida:

- sistema operacional do laticinio: usado por funcionarios no dia a dia
- administrativo: gestao, auditoria, relatorios, exportacoes, configuracoes
- apps futuros: produtor, coletas e outros pontos de entrada

Essa separacao nao precisa virar varias aplicacoes agora. Ela precisa guiar fronteiras, permissoes e telas.

## Produtores

Produtores nao sao um modulo operacional.

Produtores sao registros centrais do sistema, usados por varios modulos.

Eles representam nomes, codigos, documentos, status, vinculos e informacoes que outros modulos precisam.

No inicio, nao precisa criar tela para cadastrar, editar ou excluir produtores.

Primeiro objetivo:

- entender produtores existentes
- definir identidade do produtor
- definir estrutura limpa
- definir validacoes
- definir como outros modulos referenciam produtores

O schema `santilac_db` pode ser consultado para entender a tabela atual de produtores e os dados reais.

A tabela antiga de produtores que sairam deve ser ignorada no desenho novo, porque essa regra sera refeita depois.

## Primeiro Modulo Operacional Sugerido

Depois da base de produtores, o primeiro modulo operacional sugerido e:

```text
Qualidade / Analises laboratoriais
```

Motivos:

- usa produtores
- cria historico importante
- alimenta dashboard
- gera valor operacional real
- ajuda a provar o fluxo planilha/raw -> processor -> tabela validada -> dashboard
- permite validar importacoes e leituras laboratoriais antes de telas complexas

## Coletas E App Android

Coletas nao entram no primeiro ciclo.

Existe prototipo de app Android de coletas, com ideias e testes ja feitos:

- registrar coleta no campo
- marcar GPS
- gravar waypoint local a cada cerca de 30 metros
- registrar paradas
- contar tempo parado
- marcar casa/local do produtor
- exibir no mapa o caminho do caminhao
- mostrar inicio e fim de rota
- ajudar motorista novo a seguir rota sem acompanhante
- no futuro, otimizar rotas para reduzir tempo e diesel

Isso sera refeito depois.

O app de coletas sera fonte de dados brutos para o backend, nao parte do primeiro modulo.

## Rotas E IA

DeepSeek ou outra LLM nao deve ser usada para calcular rotas de forma deterministica.

Para otimizacao de rotas no futuro, o caminho mais correto e estudar ferramentas proprias para isso, como OR-Tools e motores de rota/mapa como OSRM ou GraphHopper.

LLM pode ajudar com explicacoes, suporte, analise textual e ideias, mas nao deve ser o motor principal de decisao de rota.

## Design

O sistema deve parecer serio, profissional e confiavel.

Direcao visual preferida:

- tema escuro
- menos enfeite
- menos cor decorativa
- interfaces densas, claras e operacionais
- foco em leitura, acao e confianca
- evitar tela bonita que nao ajuda o usuario a trabalhar

Design nao deve travar o backend.

O visual sera retomado depois que contratos e modulos estiverem firmes.

## Regras De Desenvolvimento

Cada modulo ou base importante deve seguir:

```text
1. escrever regra
2. criar teste
3. implementar minimo
4. validar dados validos
5. validar dados invalidos
6. validar bordas
7. remover codigo morto
8. validar manualmente
9. promover
```

Nao existe "depois eu limpo".

Nao existe codigo temporario em producao.

Se deu bug:

```text
1. reproduz no laboratorio
2. cria teste falhando
3. corrige limpo
4. roda testes
5. promove
```

## Catalogo Central De Erros

Todo erro controlado do sistema deve ter codigo documentado.

Isso vale para:

- frontend
- backend Laravel
- processor Python
- importacoes
- exportacoes
- APIs
- logs
- auditoria

Documento oficial:

```text
docs/CATALOGO_DE_ERROS.md
```

Regra:

```text
erro conhecido tem codigo conhecido
```

O codigo deve ser estavel e legivel, como:

```text
AUTH_110
IMPORT_310
PRODUCER_410
ANALYSIS_510
SYSTEM_900
```

Nao usar apenas numero solto, porque perde contexto no codigo e nos logs.

Mensagens podem ter detalhes dinamicos, mas o codigo precisa apontar para uma explicacao central na documentacao.

## Padroes Do Core

O projeto possui um documento central de padroes:

```text
docs/PADROES_DO_CORE.md
```

Ele define:

- contrato de modulo
- auditoria
- formato de erros
- contrato Laravel/Python
- padrao de nomes
- ambientes
- referencias
- importacoes
- exportacoes
- checklist antes de codar

Antes de implementar qualquer modulo novo, ler esse arquivo.

## Definicao De 100%

Um bloco so esta pronto quando:

- regra documentada
- raw definido
- tabela validada/dash definida
- contrato JSON definido
- processor testado
- API testada
- erros tratados
- permissoes pensadas
- exportacoes testadas, quando existirem
- validacao manual feita
- codigo morto removido
- nada depende de gambiarra conhecida

99% nao entra.

## Exportacoes

A administracao quer exportar dados.

O sistema precisa nascer preparado para:

- PDF
- Excel
- relatorios administrativos
- dados confiaveis vindos de tabelas validadas/dash

Exportacao nao deve buscar dado bruto direto.

## Dados De Referencia

Fontes que podem ser consultadas:

- `santilac_db`: schema antigo, dados reais e campos usados
- `Santilac_V3`: regras antigas, fluxos, dores, telas e comportamento esperado
- prototipos antigos: apenas como referencia de negocio

Regra:

```text
referencia sim
copiar codigo nao
copiar bagunca nao
```

## Nao Objetivos Agora

Nao fazer agora:

- app Android de coletas
- app do produtor
- dashboard completo
- redesign completo do sistema
- importador perfeito de todos os formatos
- otimizacao de rotas
- IA calculando rotas
- telas de CRUD de produtores
- migracao de todo o V3 de uma vez

## Ordem Recomendada

1. Consolidar base de produtores.
2. Criar contrato raw/auditoria e tabela validada para qualidade/analises.
3. Criar processor Python de analises.
4. Criar testes do processor.
5. Criar backend Laravel minimo para gravar raw/auditoria e ler analises validadas.
6. Criar testes de API.
7. Validar com dados parecidos com reais.
8. So depois criar tela frontend.

## Perguntas Ainda Abertas

- Quais campos de produtor sao obrigatorios no Core?
- Qual sera a estrategia inicial de permissoes?

## Decisoes Fechadas Sobre Produtores

Identidade final do produtor:

```text
codigo interno
```

Esse codigo vem da coluna `codigo` no schema antigo `santilac_db`.

Regra sobre troca de codigo:

```text
Produtor nunca troca de codigo.
```

Excecao: se o produtor parar de entregar leite e depois voltar com um novo cadastro, ele pode receber outro codigo, porque passa a ser um novo registro operacional.

Regra sobre produtor inativo:

```text
ativo = 0 -> produtor inativo
ativo = 1 -> produtor ativo
```

Produtor inativo nao deve ser apagado, porque historico de analises, coletas, notas, pagamentos e relatorios precisa continuar apontando para o registro original.

Campos obrigatorios do produtor:

```text
ainda nao decidido
```

## Decisoes Fechadas Sobre Analises Laboratoriais

Formato de entrada no primeiro ciclo:

```text
planilha recebida do laboratorio responsavel
```

As analises devem entrar somente por importacao.

Nao tera digitacao manual de analises no primeiro ciclo.

O importador deve ler a planilha, validar, gravar raw/auditoria da importacao e depois processar cada campo corretamente para a tabela propria de analises.

Importante:

```text
Analises laboratoriais nao precisam entrar em clean.
```

Motivo: ja existe uma tabela funcional no `santilac_db`, chamada `resultadosanalises`, com as colunas necessarias para gravar e consultar as analises.

Portanto, para este modulo:

```text
arquivo/importacao/linhas brutas -> raw/auditoria
resultados de analises validados -> resultadosanalises
agregados futuros -> dash, se necessario
```

Regra importante:

```text
Nao reinventar a tabela de analises agora.
```

O primeiro ciclo deve pegar a tabela `resultadosanalises` do `santilac_db` e o importador PHP funcional do V3 como referencia, e portar/refatorar o comportamento para Python com testes.

O importador do SantiLac V3, feito em PHP, esta funcional e importa corretamente.

Ele pode ser usado como referencia de regra e comportamento esperado.

Detalhes do comportamento atual foram documentados em:

```text
docs/REFERENCIA_IMPORTADOR_ANALISES_V3.md
```

Mesmo assim, no Core o importador de analises deve ser refeito no processor Python.

Motivo:

- Python e melhor para manipulacao de planilhas e dados tabulares
- o processor precisa ser mais tolerante a variacoes de layout
- a importacao deve ser testada fora do frontend/backend

Regra importante para leitura de colunas:

```text
Nao depender de posicao fixa da coluna.
```

O parser deve identificar colunas por cabecalho normalizado.

Exemplos equivalentes:

```text
| codigo | nome |
| nome | codigo |
| NOME | CODIGO |
| CODIGO | NOME |
```

Todos devem ser lidos corretamente se os cabecalhos forem reconheciveis.

O processor deve normalizar cabecalhos antes de mapear campos:

- remover diferenca entre maiusculo/minusculo
- tratar acentos quando necessario
- ignorar espacos extras
- aceitar sinonimos conhecidos
- registrar erro claro quando uma coluna obrigatoria nao existir

Decisoes adicionais para o novo importador:

- manter a estrutura funcional da tabela `resultadosanalises` do V3 no primeiro desenho
- manter regra do V3 para `0,0` virar ausencia/null nos decimais de analise
- manter suporte a `.xlsx`, `.xls` e `.csv`
- guardar todas as planilhas originais importadas em storage/disco
- o sistema deve permitir futuramente baixar a planilha original importada
- calcular hash do arquivo importado para detectar reenvio da mesma planilha
- se o mesmo hash ja foi importado, avisar o usuario
- reimportacao nao deve duplicar nem substituir dados existentes
- reimportacao pode completar somente dados que faltaram na primeira importacao
- se houver varias abas, o processor deve olhar todas e processar as que tiverem campos reconhecidos de analises
- pre-visualizacao antes de confirmar importacao e desejavel e o desenho deve nascer compativel com isso

## Decisoes Fechadas Sobre Exportacoes

Exportacoes esperadas:

- Excel
- PDF

Regra:

- todos os modulos devem nascer compativeis com Excel
- nem todos os modulos precisam ter PDF
- exportacao aparece na dashboard depois
- mesmo que o botao venha depois, o modulo precisa nascer com dados limpos preparados para exportacao
- o processor deve gerar/organizar os dados necessarios para exportacao futura
- a criacao/preparacao das planilhas deve ficar no processor Python
- cada modulo deve ter sua exportacao separada no processor
- a dashboard nao deve montar relatorio buscando raw

As planilhas que hoje sao editadas manualmente devem virar modelos de exportacao do sistema.

Objetivo:

```text
alimentar o sistema -> processar dados -> gerar planilha pronta
```

Nao e para o usuario alimentar o sistema e depois continuar ajustando planilha manualmente.

Quando existirem planilhas atuais usadas pela empresa, elas devem ser guardadas como referencia de saida/exportacao, porque mostram exatamente o formato que a administracao espera receber.

Essas referencias ajudam a definir:

- abas
- cabecalhos
- ordem das colunas
- nomes dos campos
- formulas esperadas
- totais
- agrupamentos
- filtros
- formato visual
- regras de arredondamento
- campos obrigatorios

Separar referencias de planilhas em dois tipos:

```text
referencias/planilhas/importacao/
referencias/planilhas/exportacao/
```

Importacao: planilhas recebidas de fora, como laboratorio.

Exportacao: planilhas que o SantiLac Core deve gerar prontas para uso.

## Permissoes

Permissoes significam decidir quem pode ver, criar, alterar, importar, excluir, exportar e administrar cada parte do sistema.

Decisao parcial:

```text
Permissoes nao serao por setor fixo.
```

O modelo desejado e por niveis de acesso.

Um usuario pode ter varios niveis de acesso ao mesmo tempo.

Os niveis exatos ainda serao pensados depois.

Exemplos de decisoes que ainda precisam ser tomadas:

- usuario comum pode importar analises?
- so administrador pode excluir ou inativar registros?
- relatorios financeiros ficam restritos?
- exportar Excel/PDF exige permissao especial?
- apps futuros terao usuarios separados dos usuarios do sistema interno?
- quais niveis existirao?
- niveis serao globais ou por modulo?
- um nivel pode permitir apenas leitura enquanto outro permite importar/exportar?

Essa estrategia ainda esta aberta.

## Frase Para Continuar Em Outro PC

Use esta frase em uma nova conversa:

```text
Leia a pasta SantiLac_Core, principalmente README.md, DEVELOPMENT_RULES.md, docs/MEMORIA_DO_PROJETO.md, docs/ARQUITETURA.md e docs/PROXIMOS_PASSOS.md. Vamos continuar o novo SantiLac Core a partir dessas regras.
```
