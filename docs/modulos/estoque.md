# Módulo: Estoque

## Objetivo

Controlar o estoque operacional do laticínio com saldo confiável por item, local e lote.

O módulo deve responder rapidamente:

- o que existe em estoque
- onde está
- quanto tem disponível
- o que está abaixo do mínimo
- o que está perto do vencimento
- quais entradas, saídas, ajustes e transferências aconteceram

## Usuários / Superfícies

Quem usa:

- administrativo
- produção
- almoxarifado
- laboratório, quando houver reagentes/insumos
- dashboard do sistema
- exportações

## Entradas

Dados que entram no módulo:

- cadastro manual de item
- cadastro manual de local
- lançamento de entrada
- lançamento de saída
- lançamento de ajuste
- transferência entre locais
- lote e validade, quando existir
- documento de referência, quando existir
- observação operacional

Importação de planilha fica preparada no contrato, mas não entra no primeiro ciclo.

## Saídas

O módulo entrega:

- visão geral do estoque
- lista de itens com saldo atual
- detalhe do item
- histórico de movimentações
- alertas de estoque mínimo
- alertas de validade
- exportação futura em Excel

PDF não é obrigatório no primeiro ciclo.

## Tabelas

Tabelas raw/auditoria:

- `raw_estoque_eventos`

Tabelas funcionais:

- `estoque_categorias`
- `estoque_locais`
- `estoque_itens`
- `estoque_lotes`
- `estoque_movimentos`
- `estoque_saldos`

Tabelas dash:

- `dash_estoque_resumo_dia`, fora do primeiro ciclo

## Processor

No primeiro ciclo o processor não transforma dados de estoque.

Ele será usado depois para:

- importar planilhas de estoque
- gerar Excel de inventário
- gerar Excel de movimentações

## Regras De Negócio

- Todo item precisa ter nome, unidade e categoria.
- Item pode ter controle por lote e validade.
- Entrada aumenta saldo.
- Saída reduz saldo.
- Transferência reduz saldo no local de origem e aumenta no local de destino.
- Ajuste corrige saldo por diferença informada e precisa de motivo.
- Saída não pode deixar saldo negativo.
- Transferência não pode deixar saldo negativo na origem.
- Toda movimentação precisa gravar auditoria em `raw_estoque_eventos`.
- Saldo atual vem de `estoque_saldos`, atualizado pelo backend.
- Histórico não é apagado.
- Item inativo não pode receber nova movimentação.

## Erros

Usa códigos existentes:

- `VALID_210`
- `VALID_211`
- `SYSTEM_900`

Códigos novos do módulo:

- `STOCK_810`: Item de estoque não encontrado.
- `STOCK_811`: Local de estoque não encontrado.
- `STOCK_812`: Saldo insuficiente.
- `STOCK_813`: Item inativo.
- `STOCK_814`: Tipo de movimentação inválido.

## Exportações

Primeiro ciclo prepara os dados para:

- inventário atual em Excel
- movimentações por período em Excel

Implementação do exportador fica para depois da tela estar validada.

## Testes Obrigatórios

- cadastrar item válido
- rejeitar item sem nome/unidade/categoria
- registrar entrada e atualizar saldo
- rejeitar saída acima do saldo
- registrar saída e atualizar saldo
- registrar transferência entre locais
- registrar ajuste com motivo
- listar itens com saldo atual
- listar movimentações por período

## Fora De Escopo Agora

- custo médio contábil
- integração fiscal
- baixa automática por produção
- importação de planilha
- leitura por código de barras
- aprovação em duas etapas
- inventário cego

## Pendências / Perguntas

- Quais categorias iniciais serão usadas: embalagens, limpeza, laboratório, produção, manutenção?
- O estoque será controlado por setor ou por local físico?
- Quais itens precisam obrigatoriamente de lote e validade?
- Quem poderá lançar ajuste?
