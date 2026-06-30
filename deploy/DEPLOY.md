# Deploy de producao

Este deploy atualiza os containers de producao pelo GitHub Actions depois que algo entra na `main`.

O workflow usa um **self-hosted runner** dentro do Proxmox, com label:

```text
santilac-prod
```

Ele precisa rodar em um ambiente onde o comando `pct` esteja disponivel. Assim o GitHub nao precisa acessar o IP interno `192.168.0.200` e nenhuma porta do Proxmox precisa ser exposta para a internet.

## Variables do GitHub

Variables opcionais em `Settings > Secrets and variables > Actions > Variables`:

- `FRONTEND_CT`: container do frontend, padrao `100`.
- `FRONTEND_PATH`: pasta do site no container, padrao `/var/www/santilac-front`.
- `BACKEND_CT`: container do backend, padrao `101`.
- `BACKEND_PATH`: pasta do Laravel no container, padrao `/var/www/santilac-backend`.
- `PROCESSOR_CT`: container do processor, padrao `102`.
- `PROCESSOR_PATH`: pasta do processor no container, padrao `/var/www/processor`.

Opcionais:

- `FRONTEND_HEALTH_URL`
- `BACKEND_HEALTH_URL`
- `PROCESSOR_HEALTH_URL`
- `PROCESSOR_INSTALL_REQUIREMENTS`: use `1` para instalar `requirements.txt`.
- `PROCESSOR_SERVICES`: nomes de services systemd separados por espaco para reiniciar apos deploy.

## Como funciona

- Mudou `frontend/` ou `pwa-producao/`: builda o frontend principal e publica o PWA de producao em `/fabrica/`.
- Mudou `backend/`: publica o Laravel preservando `.env`, `vendor` e pastas de runtime.
- Mudou `processor/`: publica o processor preservando `.env` e `.venv`.
- Banco de dados nao roda automaticamente. SQL de producao deve ser aplicado manualmente.

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
