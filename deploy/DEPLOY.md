# Deploy de producao

Este deploy atualiza os containers de producao pelo GitHub Actions depois que algo entra na `main`.

O workflow usa um **self-hosted runner** dentro do Proxmox, com label:

```text
santilac-prod
```

Ele precisa rodar em um ambiente onde o comando `pct` esteja disponivel. Assim o GitHub nao precisa acessar o IP interno `192.168.0.200` e nenhuma porta do Proxmox precisa ser exposta para a internet.

## Secrets do GitHub

Secrets opcionais em `Settings > Secrets and variables > Actions > Secrets`:

- `DB_NAME`: banco MySQL.
- `DB_USER`: usuario MySQL.
- `DB_PASSWORD`: senha MySQL.

Se `DB_NAME`, `DB_USER` e `DB_PASSWORD` nao forem definidos, o deploy le as credenciais do `.env` do backend no CT 101.

## Variables do GitHub

Crie em `Settings > Secrets and variables > Actions > Variables`:

- `FRONTEND_CT`: container do frontend, padrao `100`.
- `FRONTEND_PATH`: pasta do site no container, padrao `/var/www/santilac-front`.
- `BACKEND_CT`: container do backend, padrao `101`.
- `BACKEND_PATH`: pasta do Laravel no container, padrao `/var/www/santilac-backend`.
- `PROCESSOR_CT`: container do processor, padrao `102`.
- `PROCESSOR_PATH`: pasta do processor no container, padrao `/var/www/processor`.
- `DATABASE_CT`: container onde o MySQL roda, padrao `103`.
- `BACKEND_ENV_CT`: container usado para ler `.env` do backend, padrao `101`.
- `BACKEND_ENV_PATH`: caminho do `.env` do backend, padrao `/var/www/santilac-backend/.env`.
- `DB_HOST`: host MySQL visto dentro do container do banco, normalmente `127.0.0.1`.
- `DB_PORT`: porta MySQL, normalmente `3306`.
- `DATABASE_BACKUP_DIR`: pasta de backup antes de migrations, exemplo `/var/backups/santilac-db`.

Opcionais:

- `FRONTEND_HEALTH_URL`
- `BACKEND_HEALTH_URL`
- `PROCESSOR_HEALTH_URL`
- `PROCESSOR_INSTALL_REQUIREMENTS`: use `1` para instalar `requirements.txt`.
- `PROCESSOR_SERVICES`: nomes de services systemd separados por espaco para reiniciar apos deploy.

## Como funciona

- Mudou `frontend/`: builda o frontend e publica o `dist`.
- Mudou `backend/`: publica o Laravel preservando `.env`, `vendor` e pastas de runtime.
- Mudou `processor/`: publica o processor preservando `.env` e `.venv`.
- Mudou `database/migrations/`: faz backup e executa arquivos `.sql` ainda nao aplicados.

As migrations sao controladas pela tabela `schema_migrations`. Arquivo SQL ja aplicado nao deve ser editado; crie outro arquivo com numero novo.

## Protecao recomendada

Configure o ambiente `production` no GitHub com aprovacao manual. Assim o PR pode entrar na `main`, mas o deploy so executa depois da aprovacao.

## Criar o runner

No GitHub:

```text
Settings > Actions > Runners > New self-hosted runner
```

Escolha Linux x64 e use o token que o GitHub gerar. Instale no Proxmox host ou em um ambiente que consiga executar `pct`.

Adicione a label:

```text
santilac-prod
```

## Migrations

Coloque migrations novas somente em:

```text
database/migrations/
```

Nao coloque importacao, dump completo ou script de teste nessa pasta.
