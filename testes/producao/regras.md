# Regras do Laboratorio de Producao

## Fonte unica

- A fonte de verdade e sempre o banco real MySQL/MariaDB do laboratorio.
- Nao usar mock, fixture operacional, fake API, dados ficticios, sample data, arrays hardcoded ou fallback visual para preencher tela.
- O frontend so mostra o que vem da API real.
- O backend so aprova fluxo persistindo e lendo do banco real.

## Lei contra SQLite

- SQLite e proibido neste laboratorio.
- Nao criar arquivo `.sqlite`, DSN `sqlite:`, migration SQLite, `PRAGMA`, `ON CONFLICT`, `INSERT OR` ou qualquer sintaxe especifica de SQLite.
- Tests integrados, QA e deploy de validacao devem usar MySQL/MariaDB.
- Se MySQL/MariaDB nao estiver disponivel, a entrega fica bloqueada. Nao substituir por SQLite.
