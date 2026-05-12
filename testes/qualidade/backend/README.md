# Backend do módulo Qualidade

Este backend ainda não está no Laravel principal.

Ele é o desenho do módulo antes da promoção.

## Arquivos

- `routes/api.php`: rotas futuras do módulo
- `contracts/api.md`: contrato esperado pelo frontend
- `app/Http/Controllers/Api/QualidadeController.php`: controller do módulo
- `app/Services/QualidadeService.php`: consultas e regras de leitura
- `app/Models/ProdutorQualidade.php`: leitura de `santilac_raw.produtores`
- `app/Models/ResultadoAnalise.php`: leitura de `santilac_raw.resultadosanalises`

## Regra

Aqui nasce o backend. Quando estiver validado, copiamos/adaptamos para `backend/`.
