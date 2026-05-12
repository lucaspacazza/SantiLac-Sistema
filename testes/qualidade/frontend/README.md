# Frontend Do Laboratorio Qualidade

Tela inicial do modulo Qualidade em React + TypeScript + Vite, feita para rodar no laboratorio antes de entrar no frontend principal.

## Arquivos

- `package.json`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/api/qualidadeApi.ts`
- `src/styles.css`

## API Esperada

Base:

```text
/api/qualidade
```

Contratos:

```text
testes/qualidade/backend/contracts/api.md
```

## Regra

Esta tela consome somente o backend real do modulo.

Sem dados mockados. Se a API nao responder, a tela mostra estado de erro/vazio.

## Comandos

```bash
npm install
npm run dev
```
