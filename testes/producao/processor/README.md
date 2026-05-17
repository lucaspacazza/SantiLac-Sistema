# Processor De Producao Industrial

Modulo Python de calculos industriais do laboratorio.

Funcoes publicas:

- `calculate_daily_production(payload)`
- `calculate_stock_balance(payload)`

Rodar testes:

```bash
python3 -m pytest testes/producao/processor/tests
```

Executar por CLI:

```bash
python3 testes/producao/processor/modules/producao/calculations.py --function daily-production --input payload.json
python3 testes/producao/processor/modules/producao/calculations.py --function stock-balance --input payload.json
```
