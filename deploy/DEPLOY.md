# Deploy de producao

Este deploy atualiza os containers de producao pelo GitHub Actions depois que algo entra na `main`.

## Secrets do GitHub

Crie em `Settings > Secrets and variables > Actions > Secrets`:

- `DEPLOY_HOST`: IP ou DNS do Proxmox.
- `DEPLOY_PORT`: porta SSH, normalmente `22`.
- `DEPLOY_USER`: usuario SSH do Proxmox.
- `DEPLOY_SSH_KEY`: chave privada SSH usada pelo deploy.
- `DB_NAME`: banco MySQL.
- `DB_USER`: usuario MySQL.
- `DB_PASSWORD`: senha MySQL.

## Variables do GitHub

Crie em `Settings > Secrets and variables > Actions > Variables`:

- `FRONTEND_CT`: container do frontend, exemplo `100`.
- `FRONTEND_PATH`: pasta do site no container, exemplo `/var/www/santilac-front`.
- `BACKEND_CT`: container do backend, exemplo `101`.
- `BACKEND_PATH`: pasta do Laravel no container, exemplo `/var/www/santilac-backend`.
- `PROCESSOR_CT`: container do processor.
- `PROCESSOR_PATH`: pasta do processor no container.
- `DATABASE_CT`: container onde o MySQL roda.
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

## Migrations

Coloque migrations novas somente em:

```text
database/migrations/
```

Nao coloque importacao, dump completo ou script de teste nessa pasta.
