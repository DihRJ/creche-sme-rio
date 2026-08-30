# `web` — app da família

React + Vite + Tailwind 4. Consome a API descrita em `../contracts/api.ts`.

```bash
npm install
npm run dev     # http://localhost:5173, já com o mock ligado
npm run smoke   # percorre o fluxo inteiro contra o mock, sem navegador
npm run build   # sync do contrato + tsc + vite build -> dist/
npm run lint
```

## Mock ou API real

`npm run dev` sobe com o **mock** por padrão: sem `VITE_API_URL` definida, o cliente não
tenta rede. Para bater na API do Dev A, copie `.env.exemplo` para `.env.local` e defina:

```
VITE_API_URL=http://localhost:3001/api
VITE_USAR_MOCK=false
```

O mock não é dado inventado: unidades e régua saem de `../server/dados/`, que é a base real
da SME. O que é simulado está listado no cabeçalho de `src/api/mock.ts` — em especial, o
histórico por unidade é do **processo de 2025 e da unidade inteira**, não da combinação
grupamento × turno, porque é isso que a série pública sustenta. A tela rotula assim.

O cruzamento automático (RF2.2) usa a **mesma função determinística** que o
`server/src/mock-cruzamento.ts` do Dev A, então mock e API concordam para o mesmo CPF.

## Estrutura

| Caminho | Dono | O que é |
| --- | --- | --- |
| `src/api/client.ts` | Dev B | `chamar<T>()`, desembrulha o envelope, lança `ErroDaApi`, alterna mock |
| `src/api/mock.ts` | Dev B | API de mentira com dado real; implementa E1–E15 |
| `src/auth.tsx` | Dev B | Sessão, `useSessao()`, `<RotaProtegida>` |
| `src/formato.ts` | Dev B | Máscara de CPF/telefone, validação de formato, grupamento sugerido |
| `src/App.tsx` | Dev B | Roteador e `<Layout>` com o banner de demonstração |
| `src/telas/Entrar,Cadastrar,DadosDaCrianca,EscolherUnidades,Revisar` | Dev B | Fluxo de inscrição |
| `src/telas/provisorio-ui.tsx` | Dev B | **Kit provisório.** Morre quando `src/ui/` do Dev C chegar |
| `src/ui/**`, `Vulnerabilidades`, `Documentos`, `MinhaInscricao` | Dev C | Ainda não integradas |

As rotas do Dev C já existem no roteador, apontando para um marcador
(`AguardandoDevC`, dentro de `App.tsx`) que mantém o percurso navegável ponta a ponta.
Trocar por `import` quando as telas chegarem, e apagar o marcador.

## Deploy (Render, Static Site)

Root dir `fila-unica-app/web` · Build `npm ci && npm run build` · Publish `dist`.

Duas coisas que não podem faltar:

1. `VITE_API_URL` com a URL pública da API, **com `/api` no fim**, e `VITE_USAR_MOCK=false`.
2. Regra de rewrite `Source /*` → `Destination /index.html`, ação **Rewrite**. Sem ela,
   recarregar em `/inscricao/xyz/unidades` devolve 404.

## Decisões que valem saber

- **Mobile primeiro de verdade.** Desenhado em 360px. Alvo de toque de 44px, `font-size`
  de 16px nos campos (abaixo disso o iOS dá zoom no foco).
- **Tokens de cor iguais aos do painel** em `../../app/src/app/globals.css`: a paleta já foi
  validada para daltonismo nos dois temas, e duas paletas seriam duas verdades.
- **Nada de probabilidade de entrar.** O cartão da unidade mostra o número de 2025 e para
  aí. O sistema não sabe a chance da família, e fingir que sabe seria pior que o silêncio.
- **O servidor é a fonte do estado.** Todo endpoint de inscrição devolve a `Inscricao`
  inteira, e a tela re-renderiza a partir dela em vez de remontar estado no cliente.
