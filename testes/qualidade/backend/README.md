# Backend Do Laboratorio Qualidade

Este backend ainda nao esta no Laravel principal.

Ele e o desenho do modulo antes da promocao.

## Arquivos

- `routes/api.php`: rotas futuras do modulo
- `contracts/api.md`: contrato esperado pelo frontend
- `app/Http/Controllers/Api/QualidadeController.php`: controller do modulo
- `app/Services/QualidadeService.php`: consultas e regras de leitura
- `app/Models/ProdutorQualidade.php`: leitura de `santilac_raw.produtores`
- `app/Models/ResultadoAnalise.php`: leitura de `santilac_clean.resultadosanalises`

## Regra

Aqui nasce o backend. Quando estiver validado, copiamos/adaptamos para `backend/`.
