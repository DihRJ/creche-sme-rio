# Fila Única — App da Família

Aplicação web que a família usa para se inscrever na creche da rede municipal do Rio:
cadastro, escolha de até 5 unidades **com o histórico de vagas na tela**, declaração de critérios de
vulnerabilidade, envio dos comprovantes e finalização da inscrição.

Independente do painel analítico em `../app/`. Backend Node, frontend React.
Contexto e justificativa de cada requisito: [`../PRD.md`](../PRD.md).
Plano do sistema de produção (o que faríamos sem o limite de 4h): [`../PLANO.md`](../PLANO.md).

| Quem | Arquivo | Missão |
| --- | --- | --- |
| **Dev A** | [`DEV-A-BACKEND.md`](DEV-A-BACKEND.md) | API, banco, seed, upload, deploy da API |
| **Dev B** | [`DEV-B-FRONT-INSCRICAO.md`](DEV-B-FRONT-INSCRICAO.md) | Scaffold, login, dados da criança, **escolha de unidades**, finalização, deploy do web |
| **Dev C** | [`DEV-C-FRONT-COMPROVACAO.md`](DEV-C-FRONT-COMPROVACAO.md) | Kit de UI, **vulnerabilidades**, **documentos**, acompanhamento |

> **Leia [`AGENTS.md`](AGENTS.md) antes de codar.** Como rodar o backend, como apontar o smoke para
> a API real, `npm run limpar` entre execuções, e as convenções que existem por causa de um erro
> concreto. Vale para você e para o agente que estiver na sua máquina.

---

## Bloco 0 · Os primeiros 20 minutos (as três pessoas juntas)

**Nada de código de feature neste bloco.** O objetivo é um só: no minuto 20, deploy verde e contrato
ratificado. O modo de falhar deste projeto é descobrir problema de deploy às 3h50.

O que **já está pronto** neste repositório, e que você não precisa escrever:

- ✅ `contracts/api.ts` — o contrato inteiro, 17 endpoints, compilando. **Leia, não reescreva.**
- ✅ `server/package.json`, `server/tsconfig.json`, `server/.env.exemplo`
- ✅ `server/dados/` — unidades, régua, casos e explicações reais, copiados da SME
- ✅ Estrutura de pastas

### Passo 1 · Ratificar o contrato (5 min, os três)

Leiam `contracts/api.ts` em voz alta, juntos. Discordou de um nome de campo? **Agora** é a hora, e
só agora. Ao fim destes 5 minutos o arquivo está congelado: mudança depois disso é anunciada em voz
alta e vai num commit sozinho.

### Passo 2 · Cada um sobe a sua parte (15 min, em paralelo)

**Dev A — banco e API no ar**

O banco **já está pronto e vinculado**: projeto Neon "Creche SME RIO"
(`curly-shadow-00730359`, org Jarom), PostgreSQL 18.6, branch `dev`. O `.env` já tem as duas
connection strings. Você não precisa criar nada no Neon.

```bash
cd fila-unica-app/server
npm install
npm run verifica          # prova as duas conexões. Deve imprimir PostgreSQL 18.6 / neondb
# escreve APENAS isto em src/index.ts: express + cors + GET /api/saude
npm run dev               # confirma http://localhost:3001/api/saude
# cria o Web Service no Render (ver "Deploy" abaixo) e faz o primeiro deploy
```

**Dev B — web no ar**

```bash
cd fila-unica-app
npm create vite@latest web -- --template react-ts   # a pasta web/ está vazia de propósito
cd web
npm install
npm install react-router-dom
npm install tailwindcss @tailwindcss/vite
# vite.config.ts: plugins: [react(), tailwindcss()]
# src/index.css: @import "tailwindcss";
npm run dev               # confirma http://localhost:5173
# cria o Static Site no Render e faz o primeiro deploy
```

Depois do `create vite`, acrescente ao `web/package.json`:

```jsonc
"scripts": {
  "sync": "cp ../contracts/api.ts src/contracts.gen.ts",
  "dev": "npm run sync && vite",
  "build": "npm run sync && tsc -b && vite build"
}
```

**Dev C — mock e ambiente**

```bash
# enquanto B faz o scaffold, escreva as fixtures do mock em um arquivo solto,
# para colar em web/src/api/mock.ts assim que a pasta existir.
# Fonte de dado realista para as fixtures: server/dados/unidades.json e regua.json
```

### Definição de pronto do Bloco 0

- [ ] `GET /api/saude` responde em **produção**, não só em localhost
- [ ] O `web` de produção abre a tela padrão do Vite
- [ ] `contracts/api.ts` lido pelos três e commitado
- [ ] Todo mundo com o repositório clonado, `npm install` feito e commitando na `main`

Se aos 20 minutos o deploy não estiver verde: **as três pessoas param e resolvem o deploy.** É a
única dependência que não pode ser paralelizada.

---

## Regras de trabalho paralelo

1. **Commits pequenos e frequentes, direto na `main`.** Sem branch, sem PR, sem review. Não é
   descuido: com 4h e 3 pessoas, o custo de coordenação de branch é maior que o risco de conflito.
2. **Pastas disjuntas.** Cada trilha tem os seus arquivos, listados no respectivo `.md`. O único
   arquivo genuinamente compartilhado é `contracts/api.ts`.
3. **Antes de commitar:** `git pull --rebase=false`. Sem rebase.
4. **Front não espera back.** Dev B e Dev C trabalham contra `web/src/api/mock.ts` desde o minuto 20
   e trocam para a API real a partir das 2:30, endpoint por endpoint.
5. **Back responde antes de estar bonito.** Endpoint devolvendo dado meia-boca é melhor que endpoint
   ausente, porque destrava a integração.
6. **Às 3:30 acaba o desenvolvimento de feature.** Os últimos 30 minutos são integração, o percurso
   de demonstração rodado inteiro na URL pública, e correção do que quebrar.

---

## Deploy (Render)

> Os dois serviços estão descritos em [`../render.yaml`](../render.yaml), com a regra de rewrite
> e as variáveis já declaradas. Criar um Blueprint no Render apontando para este repositório
> resolve as armadilhas 1 e 2 sem depender de clicar certo na interface. O arquivo não faz deploy
> sozinho, e se os serviços já existirem criados à mão ele vale como documentação da configuração.

| Serviço | Tipo | Configuração |
| --- | --- | --- |
| `fila-unica-api` | Web Service · Node | Root dir `fila-unica-app/server` · Build `npm ci` · Start `npm start` |
| `fila-unica-web` | Static Site | Root dir `fila-unica-app/web` · Build `npm ci && npm run build` · Publish `dist` |
| Banco | Neon · projeto `curly-shadow-00730359` · região `us-east-2` | Branch `dev` no desenvolvimento, `production` no deploy final |

Variáveis de ambiente da API: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SEGREDO`,
`SEMENTE_PROCESSO`, `WEB_ORIGIN`. Do web: `VITE_API_URL` (a URL pública da API, com `/api` no fim).

Copie os valores do `server/.env` local — **exceto** que em produção o `WEB_ORIGIN` é o domínio do
Static Site, não `localhost`. Para apontar o deploy para a branch `production` do Neon em vez de
`dev`, rode `neon env pull --branch production --file /tmp/prod.env` e use aqueles valores.

**Três armadilhas, cada uma de 5 minutos se antecipada e de 40 se descoberta às 3h50:**

1. **CORS.** `app.use(cors({ origin: process.env.WEB_ORIGIN }))` com o domínio exato do Static Site.
2. **Rewrite do SPA.** No Static Site, adicione a regra `Source /*` → `Destination /index.html`,
   ação **Rewrite**. Sem ela, recarregar em `/inscricao/xyz` devolve 404 e o jurado vê erro.
3. **Hibernação.** O Web Service free dorme após ~15 min de inatividade e demora ~50s para acordar.
   **Acorde a API 2 minutos antes do pitch**, ou aponte um ping externo para `/api/saude`.

---

## Percurso de demonstração (é também o roteiro do pitch, ~3 min)

1. Cadastrar → dados da criança.
2. **Escolher unidades**: buscar um bairro, ver fila e vagas ociosas de cada unidade, escolher 5 e
   reordenar. *"Hoje a família escolhe às cegas. Aqui ela escolhe com o histórico na tela."*
3. **Vulnerabilidades**: marcar CadÚnico e ver "confirmado pela base, não precisa enviar documento".
   Contra os 6,8% de validação de hoje.
4. Marcar um critério que exige documento, fotografar, anexar.
5. **Revisar**: pontuação que conta × pontuação declarada, e o aviso da ordem vinculante.
6. **Finalizar** → número de sorteio.
7. Entrar numa conta de demonstração já classificada e mostrar o resultado com a explicação real.

Rode o percurso inteiro **na URL pública**, em janela anônima, com o DevTools em modo celular,
antes de apresentar.

---

## Avisos que ficam na tela

- Banner permanente de **ambiente de demonstração**. Ninguém digita CPF real.
- O histórico por unidade é do **processo de 2025** apenas, rotulado como tal. O RF1.3 pede três
  processos; não inventamos série que não temos.
- O cruzamento automático com o CadÚnico é **simulado** de forma determinística (`MOCK_CRUZAMENTO`).
  A integração real é com o Data Lake da SME.
