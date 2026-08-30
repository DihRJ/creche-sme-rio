# Fila Única · instruções de trabalho

App da família para a inscrição na creche da SME-Rio. `server/` é Node + Express + Postgres,
`web/` é Vite + React. Contexto e requisitos: [`../PRD.md`](../PRD.md). Sua trilha:
[`README.md`](README.md) aponta o briefing de cada dev.

> **Pendências abertas:** [`PARA-DEV-B.md`](PARA-DEV-B.md) — bug do redirecionamento pós-login
> e a tela de listagem de inscrições que falta.

---

## Branch

**A `dev` é o tronco, não a `main`.** Commite direto nela. Sem branch de feature, sem pull request.

```bash
git pull --rebase=false      # merge, nunca rebase
git push
```

Ao integrar trabalho de outro dev, confira se ele mexeu em `contracts/api.ts`.

---

## Contrato entre web e server

`contracts/api.ts` é a **fonte da verdade** e está congelado. Ele é copiado para os dois lados
(`src/contracts.gen.ts`) pelo script `sync`, que já roda amarrado ao `dev` e ao `build`. Você não
precisa chamar à mão, e **não edite as cópias** — a próxima execução as sobrescreve.

Precisa mudar o contrato? Anuncie para o time em voz alta e commite a mudança sozinha.

---

## Rodar o backend

O banco Neon já está vinculado (projeto `curly-shadow-00730359`, branch `dev`). O `.env` **não vai
para o repositório**; gere o seu:

```bash
cd server
neon env pull --file .env --service postgres   # DATABASE_URL e DATABASE_URL_UNPOOLED
npm install
npm run verifica     # prova as duas conexões. Deve imprimir PostgreSQL 18.6 / neondb
npm run dev          # sobe em :3001, aplica o schema e semeia
```

Além do que vem do Neon, o `.env` precisa de `JWT_SEGREDO`, `SEMENTE_PROCESSO`, `WEB_ORIGIN` e
`PORT` — veja `server/.env.exemplo`.

### Duas conexões, e a distinção não é decorativa

| Uso | Variável |
| --- | --- |
| Runtime da API | `DATABASE_URL` — **pooled** (host com sufixo `-pooler`) |
| DDL, migração, seed | `DATABASE_URL_UNPOOLED` — **direta** |

DDL por conexão pooled falha de forma intermitente e a mensagem não ajuda: o pooler multiplexa
sessões, então não há garantia de cair sempre na mesma conexão física.

### Cold start é esperado

O compute do Neon suspende após ~5 min ocioso. A primeira consulta depois disso custa ~1,2s. É
scale-to-zero, não é bug — some da segunda consulta em diante.

---

## Rodar o smoke contra a API real

Os smokes rodam contra o mock por padrão. Para exercitar a **API de verdade**, aponte a variável:

```bash
# terminal 1 — a API precisa estar de pé
cd server && npm run dev

# terminal 2
cd web
VITE_API_URL=http://localhost:3001/api npm run smoke
```

Sem `VITE_API_URL`, o cliente cai no mock — que é o default seguro, mas não testa integração.

### `npm run limpar` entre execuções — obrigatório

Os smokes usam **CPF fixo**. Contra o mock isso é inofensivo, porque ele reseta a cada execução.
Contra o Postgres, a segunda rodada morre em `CPF_JA_INSCRITO: Já existe cadastro com este CPF`, e o
erro parece bug da API quando não é.

```bash
cd server && npm run limpar     # apaga dados de família, preserva o catálogo
```

Não toca em `unidade`, `oferta`, `historico_unidade`, `criterio` nem `processo` — reconstruir o
catálogo custaria outro seed.

**O ciclo completo, quando for repetir:**

```bash
cd server && npm run limpar && cd ../web && VITE_API_URL=http://localhost:3001/api npm run smoke
```

---

## Convenções que existem por causa de um erro concreto

**Normalização de texto em um lugar só** (`server/src/texto.ts`). `JACAREPAGUÁ` e `JACAREPAGUA` são
o mesmo bairro, e a família digita sem acento no teclado do celular. A busca compara contra as
colunas `nome_busca` e `bairro_busca`, já normalizadas no seed. Buscar pelo texto cru devolve zero
resultado e nada avisa.

**Código de unidade é string de 7 dígitos com zero à esquerda.** Nunca `number` — o zero some e o
join morre em silêncio.

**Contar criança, nunca linha.** Uma inscrição gera até 5 opções; indicador que conta linha infla
~2,4×.

**Envelope em toda resposta.** `{ok:true,data}` ou `{ok:false,erro}`, com o status HTTP de
`STATUS_POR_ERRO`. Um endpoint devolvendo objeto cru quebra o cliente inteiro.

**Não asserte em prosa do servidor.** Texto de pendência muda quando alguém melhora uma frase.
Confira número: `pontuacao.pontos_declarados - pontuacao.pontos_que_contam`.

---

## O que nunca vai para o repositório

`.env`, `.env.local` e `.neon` estão no `.gitignore`. **`CLAUDE.md` também está** — se você escrever
instruções lá, o resto do time não as recebe. Instrução compartilhada vai neste arquivo.
