# Arquitetura Do SantiLac Core

## Objetivo

Criar um sistema serio para operar o laticinio com dados confiaveis, exportacoes, auditoria e base preparada para apps futuros.

## Componentes

### Backend

Tecnologia: Laravel.

Responsabilidades:

- autenticacao
- permissoes
- API administrativa
- API para apps futuros
- escrita no banco raw
- leitura de dados validados/dash
- chamada do processor Python
- validacao do retorno do processor
- escrita no banco validado/dash
- exportacao PDF/Excel
- auditoria

### Processor

Tecnologia: Python.

Responsabilidades:

- receber dados brutos em JSON
- validar estrutura
- normalizar dados
- calcular resultados
- devolver dados limpos em JSON
- devolver erros e avisos estruturados

Nao acessa banco.

### Frontend

Tecnologia: React + TypeScript + Vite.

Responsabilidades:

- telas administrativas
- telas operacionais
- dashboards
- consumo da API Laravel

Nao calcula regra critica. Nao consulta raw.

### Database

Tecnologia: MySQL.

Separacao logica:

```text
raw_*    dados recebidos como entraram
tabela validada do modulo  dados validados e normalizados
dash_*   agregados prontos para dashboard/exportacao
```

Em ambiente de teste, usar bancos separados:

```text
santilac_raw_test
santilac_validado_test
```

Em producao:

```text
santilac_raw_prod
santilac_validado_prod
```

## Fluxo De Dados

```text
Usuario/App
  -> Laravel API
  -> raw MySQL
  -> Job Laravel
  -> Python processor
  -> retorno JSON
  -> Laravel valida
  -> validado/dash MySQL
  -> Dashboard/Relatorios
```

## Regra De Ouro

Tudo que entra vai para raw.

Tudo que a empresa usa como verdade vem de tabelas validadas/dash.

`clean_*` pode existir quando fizer sentido, mas nao e obrigatorio em todos os modulos. Analises laboratoriais, por exemplo, vao para a tabela funcional `resultadosanalises`, baseada no `santilac_db`, nao para `clean_analises`.

Dashboard nunca consulta raw.

Python nunca grava banco.
