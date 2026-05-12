# Proximos Passos

## Quando Retomar

1. Ler `README.md`
2. Ler `CONTINUAR_NO_OUTRO_PC.md`
3. Ler `DEVELOPMENT_RULES.md`
4. Ler `docs/MEMORIA_DO_PROJETO.md`
5. Ler `docs/CATALOGO_DE_ERROS.md`
6. Ler `docs/PADROES_DO_CORE.md`
7. Ler `docs/CONTEXTO_DA_CONVERSA.md`
8. Ler `docs/ARQUITETURA.md`
9. Continuar pela base de produtores e depois Qualidade / Analises laboratoriais

## Antes De Criar Codigo

Nao criar Laravel, React ou Python ainda sem antes fechar:

- primeiro modulo
- tabelas raw do modulo
- tabelas validadas/dash do modulo
- contrato JSON entre Laravel e Python
- testes esperados
- codigos de erro do catalogo
- auditoria necessaria
- exportacoes esperadas

## Primeira Base Sugerida

Comecar pela base de `Produtores`.

Importante: `Produtores` nao e um modulo operacional. Produtores sao registros centrais do sistema, usados por varios modulos.

Motivo para comecar por essa base: produtores aparecem em coletas, analises, notas, pagamentos, qualidade, rotas, app do produtor, dashboards e relatorios.

Neste primeiro momento nao precisa criar tela de cadastro, edicao ou exclusao. A prioridade e definir a estrutura dos dados, validacoes, regras de identidade e como os modulos vao referenciar produtores.

O schema `santilac_db` pode ser usado para consultar os produtores atuais e entender campos/regras antigas, mas sem copiar a estrutura antiga automaticamente.

A tabela antiga de produtores que sairam deve ser ignorada no primeiro desenho.

Depois que a base de produtores estiver definida, escolher o primeiro modulo operacional.

Sugestao de primeiro modulo operacional: Qualidade / Analises laboratoriais, porque usa produtores, gera historico importante e alimenta dashboard.

Coletas ficam fora do primeiro ciclo por enquanto, porque o app Android sera tratado depois.

## Comando Para Nova Conversa

Se continuar em outro PC, abrir esta pasta e dizer:

```text
Leia primeiro SantiLac_Core/CONTINUAR_NO_OUTRO_PC.md e siga a mensagem de handoff que esta nele. Depois leia README.md, DEVELOPMENT_RULES.md, docs/MEMORIA_DO_PROJETO.md, docs/CATALOGO_DE_ERROS.md, docs/PADROES_DO_CORE.md, docs/ARQUITETURA.md e docs/PROXIMOS_PASSOS.md.
```
