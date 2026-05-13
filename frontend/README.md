# Frontend

Frontend sera React + TypeScript + Vite.

Ele sera construido depois dos contratos do backend e do processor.

## Responsabilidades

- telas administrativas
- telas operacionais
- dashboards
- consumo da API Laravel

## Regra

Frontend nao cria regra de negocio critica.

Frontend nao consulta raw.

Frontend exibe dados clean/dash via API.

## Design system

O layout padrão do sistema fica em:

```text
src/design-system/
```

Toda tela nova deve puxar botões, cabeçalhos, status, campos e cards desse diretório. A tela só altera texto, ícone, dados e ação.
