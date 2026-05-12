# Contexto Da Conversa

Este resumo existe para continuar o trabalho em outro PC sem perder a decisao tomada.

## Problema

O SantiLac V3 virou dificil de manter:

- muita decisao nasceu pelo frontend
- backend foi encaixado por tras
- dados brutos, calculos e dashboard ficaram misturados
- houve remendos para fazer funcionar
- codigo antigo ficou junto com codigo novo
- isso gerou conflito, bugs e perda de confianca

## Decisao

Criar um novo projeto chamado SantiLac Core.

O V3 fica apenas como referencia para regras, campos e fluxos. Nao trazer codigo antigo para o novo projeto.

O schema `santilac_db` tambem pode ser consultado como referencia para entender os produtores existentes e como os dados eram organizados. Ele nao define a nova arquitetura.

A tabela antiga de produtores que sairam deve ser ignorada no desenho novo, porque essa regra sera refeita de forma diferente.

## Arquitetura Decidida

Separar:

- frontend
- backend
- processor de calculos/dados
- database raw/validado/dash
- laboratorio de testes

## Stack Decidida

- Frontend: React + TypeScript + Vite
- Backend: Laravel
- Processor: Python
- Banco: MySQL

## Decisao Importante Sobre Python

Python nao acessa banco.

Laravel le dados brutos, chama o Python com JSON, recebe resultado processado, valida e grava no MySQL em tabela validada do modulo ou dash.

## Raw / Validado / Dash

Apps e sistema gravam dados brutos.

Processor limpa/calcula.

Laravel grava dados limpos.

Dashboard e relatorios consomem apenas tabelas validadas/dash.

`clean_*` e uma opcao de nomenclatura, nao uma obrigacao. No caso de analises laboratoriais, importacoes ficam em raw/auditoria e os resultados validados vao para a tabela propria de analises.

## Apps

O app de coletas Android existe como ideia/prototipo e sera refeito depois.

Ele nao e prioridade inicial.

Futuramente ele deve registrar GPS, waypoints, paradas, coletas, tempo parado e sincronizar com API mobile.

## Regra De Trabalho

Cada modulo sera criado no laboratorio primeiro.

Pode errar, apagar tabela e testar no laboratorio.

So entra no sistema principal quando estiver 100%.

## Produtores

Produtores nao devem ser tratados como modulo operacional.

Eles sao uma base de registros do sistema: codigo, nome, documentos, status, vinculos e informacoes usadas pelos modulos.

Uma tela para criar, editar e excluir produtores sera criada depois. No inicio, a prioridade e acertar a estrutura dos dados e a regra de referencia dos produtores pelos modulos.

## Meta Pessoal

O sistema precisa funcionar de verdade na empresa e pode render aumento salarial importante. A qualidade precisa ser de sistema profissional, nao prototipo bonito.
