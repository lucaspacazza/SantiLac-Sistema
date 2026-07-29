# Rede do ambiente de testes

Este procedimento migra somente a rede dos containers usados pelo workflow
`deploy-testes.yml`. Ele nao publica codigo, nao reinicia containers e nao altera
a rede de producao.

## Enderecos esperados

| CT | Funcao | IP legado | IP final |
| --- | --- | --- | --- |
| `120` | frontend | `192.168.0.120/24` | `192.168.5.120/24` |
| `121` | backend e backend do PWA | `192.168.0.121/24` | `192.168.5.121/24` |
| `122` | processor | `192.168.0.122/24` | `192.168.5.122/24` |

O gateway final dos tres CTs e `192.168.5.1`.

Os IPs `192.168.5.202`, `192.168.5.203` e `192.168.5.204` citados abaixo
sao endpoints consumidos pelo ambiente de testes. Eles nao sao os enderecos
`net0` dos CTs `120`, `121` e `122`.

O FieldLogger do pasteurizador tambem foi movido para a nova bridge e passa de
`192.168.0.101:502` para **`192.168.5.101:502`**.

## Ferramenta de migracao

Execute no host Proxmox, em uma copia revisada do repositorio.

O modo padrao e somente leitura:

```bash
bash deploy/scripts/migrate-test-network.sh
```

Ele aceita apenas dois estados:

- o par legado conhecido de IP e gateway;
- o par final esperado.

Qualquer endereco desconhecido, estado parcialmente migrado, `net0` ausente ou
opcao duplicada interrompe a operacao antes da primeira escrita.

Depois de revisar o dry-run, a aplicacao precisa ser explicitamente solicitada:

```bash
bash deploy/scripts/migrate-test-network.sh --apply
```

Antes da primeira chamada a `pct set`, o script:

1. valida os tres CTs;
2. valida os hosts conhecidos nos `.env` vivos, sem imprimir outros valores;
3. rele os tres `net0` e os fingerprints dos `.env` para detectar mudanca concorrente;
4. grava um backup com permissao restrita em `deploy/network-backups/`.

Pode-se escolher outro local persistente para o backup:

```bash
bash deploy/scripts/migrate-test-network.sh \
  --apply \
  --backup-dir /caminho/seguro/backups
```

Somente os campos `ip=` e `gw=` sao substituidos. A linha completa e reenviada ao
Proxmox, preservando `bridge`, `hwaddr`, `firewall`, `tag`, `mtu`, `rate`, `type`,
`name` e qualquer outra opcao existente. Depois de cada escrita, essas opcoes sao
comparadas novamente, independentemente da ordem em que o Proxmox as apresentar.

O script nao para nem reinicia CTs. Se a configuracao exigir restart para entrar
em vigor, essa acao deve ser programada e executada separadamente.

Os `.env` alterados tambem recebem um backup adjacente, preservando permissao e
owner. A atualizacao e atomica e aceita somente os valores legados exatos ou os
valores finais exatos. Chaves ausentes, duplicadas ou com hosts desconhecidos
interrompem a migracao.

Se qualquer etapa do `--apply` falhar, o script restaura automaticamente, em
ordem inversa, todos os `net0` e `.env` que ja tentou alterar. Antes de cada
restauracao ele confirma que o valor vivo ainda corresponde exatamente ao
resultado desta migracao; uma mudanca concorrente nunca e sobrescrita. Todos os
backups sao mantidos mesmo quando o rollback termina com sucesso.

## Preflight e deploy

Para confirmar o estado final sem escrever:

```bash
bash deploy/scripts/migrate-test-network.sh --check --connectivity
```

O workflow de testes executa esse mesmo preflight antes de preparar ou publicar
qualquer componente. Ele tambem testa TCP do backend para banco/processor e do
processor para backend/FieldLogger. Enquanto algum CT, host conhecido ou caminho
de rede estiver incorreto, o deploy falha sem tentar corrigir a infraestrutura
automaticamente.

Os gates locais usados pelo CI podem ser executados com:

```bash
bash deploy/scripts/run-test-deploy-gates.sh
```

Eles cobrem:

- dry-run, preflight, apply, backup, idempotencia e recusa de estados inseguros;
- migracao e conectividade do FieldLogger em `192.168.5.101`;
- autenticacao do processor no `sync-state`, sem exibir a chave;
- testes unitarios Python do processador do pasteurizador;
- contrato de timeout do backend.

## Hosts conhecidos nos `.env` vivos

O deploy preserva os arquivos `.env`; por isso o migrador atualiza de forma
explicita apenas estes valores conhecidos:

- CT `121`, backend principal e PWA quando o arquivo existir:
  - `DB_HOST`: `192.168.0.204` para `192.168.5.204`;
  - `PASTEURIZADOR_PROCESSOR_URL`: `.0.203` para `.5.203`;
- CT `122`, runtime do pasteurizador e `.env` do processor quando existir:
  - `SANTILAC_API_URL`: backend `.0.202` para `.5.202`;
  - `SANTILAC_SYNC_STATE_URL`: backend `.0.202` para `.5.202`;
  - `FIELDLOGGER_HOST`: `192.168.0.101` para `192.168.5.101`.

`192.168.5.204` e o banco de **producao** usado pelo pasteurizador a partir do
ambiente de testes; nao e chamado de banco de testes neste procedimento.

`FIELDLOGGER_HOST`, quando presente, só pode estar no valor legado
`192.168.0.101` ou no valor final `192.168.5.101`. Qualquer outro endereço
interrompe o preflight antes da primeira escrita.

## Recuperacao

O backup TSV contem uma linha por CT, com o numero do container e o `net0`
original separados por tabulacao. Em caso de falha parcial:

1. pare e nao execute o deploy;
2. compare `pct config 120`, `121` e `122` com o backup;
3. restaure os `.env` pelos backups adjacentes se alguma etapa de env falhou;
4. restaure manualmente a linha completa com `pct set <CT> -net0 '<net0 original>'`;
5. execute `--check --connectivity` somente depois de corrigir os tres CTs.

Nao apague o backup antes da validacao funcional da rede.
