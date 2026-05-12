# Continuar No Outro PC

Este arquivo existe para iniciar uma nova conversa no Codex sem gastar tokens redescobrindo o projeto.

## Mensagem Para Colar No Codex

Cole exatamente isto na primeira mensagem do outro PC:

```text
Leia a pasta SantiLac_Core antes de responder.

Arquivos obrigatorios:
- README.md
- DEVELOPMENT_RULES.md
- docs/MEMORIA_DO_PROJETO.md
- docs/PADROES_DO_CORE.md
- docs/CATALOGO_DE_ERROS.md
- docs/ARQUITETURA.md
- docs/PROXIMOS_PASSOS.md
- docs/REFERENCIA_IMPORTADOR_ANALISES_V3.md

Resumo do projeto:
Estamos recomecando o SantiLac como SantiLac_Core, sem copiar codigo antigo. O V3 e referencia de regra, nao base de codigo.

Stack decidida:
- Backend: Laravel
- Frontend: React + TypeScript + Vite
- Processor: Python
- Banco: MySQL

Regras fixas:
- Python nao acessa banco.
- Laravel recebe upload, autentica, valida permissao, chama Python e grava no MySQL.
- Python le planilhas, normaliza, valida, prepara dados e exportacoes.
- Nada entra em producao sem teste e validacao.
- Frontend vem depois do contrato backend/processor.
- Erros usam catalogo central em docs/CATALOGO_DE_ERROS.md.
- Todo modulo segue docs/PADROES_DO_CORE.md.

Primeira base:
- Produtores nao sao modulo.
- Produtores sao registros centrais.
- Identidade do produtor: codigo interno da coluna codigo do santilac_db.
- Produtor nunca troca de codigo, exceto se parar de entregar e voltar com novo cadastro.
- Usar ativo/inativo conforme regra documentada.

Primeiro modulo operacional:
- Qualidade / Analises laboratoriais.
- Primeiro bloco: importador de analises.

Regra do importador:
- O importador PHP do V3 funciona e e referencia de comportamento.
- A tabela resultadosanalises do santilac_db esta correta e deve ser mantida no primeiro ciclo.
- Nao reinventar a tabela de analises.
- Portar/refatorar o comportamento do PHP para Python, com testes.
- Suportar .xlsx, .xls e .csv.
- Ler colunas por cabecalho normalizado, nao por posicao fixa.
- Guardar arquivo original, hash, auditoria e erros.
- Se hash ja foi importado, avisar.
- Reimportacao nao duplica e nao sobrescreve dados existentes.
- Reimportacao pode completar apenas dados faltantes.
- Se houver varias abas, ler todas e processar as que tiverem campos de analises.
- Preview antes de confirmar e desejavel; o desenho deve nascer compativel com isso.

Antes de codar:
1. confirmar contrato do modulo Qualidade / Analises
2. criar docs/modulos/qualidade_analises.md usando docs/PADROES_DO_CORE.md
3. definir testes do processor Python
4. somente depois iniciar codigo

Nao refazer discussao de stack, arquitetura, design ou clean_analises. As decisoes estao nos docs.
```

## Como Passar A Pasta Para Outro PC

Opcao ideal:

```text
Usar OneDrive e abrir a mesma pasta SantiLac_Core no outro PC.
```

Opcao manual:

```text
Compactar a pasta SantiLac_Core em .zip e levar para o outro PC.
```

## Arquivo Mais Importante

Se quiser gastar o minimo de contexto, peca para o Codex ler primeiro:

```text
CONTINUAR_NO_OUTRO_PC.md
docs/MEMORIA_DO_PROJETO.md
docs/PADROES_DO_CORE.md
docs/REFERENCIA_IMPORTADOR_ANALISES_V3.md
```

Depois ele so deve abrir os outros arquivos se precisar.

