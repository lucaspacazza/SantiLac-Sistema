# Frontend Laboratório — Produção Industrial

Laboratório de frontend do módulo Produção Industrial. Roda em modo dev contra API em `http://127.0.0.1:8097`.

## Como rodar

### 1. Iniciar o backend (pré-requisito)

```bash
php testes/producao/backend/scripts/migrate.php
php -S 127.0.0.1:8097 -t testes/producao/backend/public
```

### 2. Instalar dependências e iniciar o frontend

```bash
cd testes/producao/frontend
npm install
npm run dev
```

Acesse: `http://127.0.0.1:5175`

### 3. Build de verificação

```bash
npm run build
```

## Estrutura

```
src/
  App.tsx                      # Roteamento e shell principal
  main.tsx                     # Entry point React
  styles.css                   # Design system local (espelha tokens do SantiLac)
  types/
    industrial.ts              # Tipos TypeScript das entidades da API
  services/
    industrialApi.ts           # Cliente da API real /api/industrial
  pages/
    RecebimentoLeitePage.tsx   # Listar/criar/editar entradas de leite
    ProducaoDiariaPage.tsx     # Listar/criar lotes de produção
    LoteProducaoPage.tsx       # Detalhe do lote: itens, recalculo, fechar, reabrir
    EstoqueTeoricoPage.tsx     # Saldo e movimentações de estoque teórico
    RelatorioDiarioPage.tsx    # Relatório com filtro de período
  components/
    BatchStatusBadge.tsx       # Badge de status do lote (draft/closed/reopened/cancelled)
    Modal.tsx                  # Componente de modal reutilizável
```

## Proxy de API

O Vite redireciona `/api` para `http://127.0.0.1:8097`. Não há mock. Se o backend não estiver rodando, a tela exibe erro real.

## Regras

- Nenhum dado mockado, hardcoded, fixture ou `USE_MOCK`.
- API real é consumida por padrão.
- Falha de API exibe estado de erro real e registra pendência.
- Design segue tokens e padrões de `testes/estoque/frontend` e `testes/qualidade/frontend`.
