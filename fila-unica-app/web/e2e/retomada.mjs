/**
 * Regressao do bug do PARA-DEV-B.md: depois do login, quem tinha inscricao em
 * andamento caia em /inscricao/nova, tentava a mesma crianca e batia em
 * CPF_JA_INSCRITO sem entender. Beco sem saida no celular.
 *
 * Cobre os quatro destinos da regra, mais a precedencia da rota de origem e a
 * espera pelo /me antes de decidir.
 *
 *   URL_APP=http://localhost:5173 node e2e/retomada.mjs
 *
 * Contra a API real, rode a limpeza antes (ver AGENTS.md). Contra o mock nao precisa.
 */
import { chromium } from "playwright";

const BASE = process.env.URL_APP ?? "http://localhost:5173";
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? "  ok  " : " FALHA"} ${msg}`); if (!c) falhas++; };

const cpf = (s) => String(90000000000 + (Date.now() % 800000000) + s);
const CPF = cpf(1), CPF_CRIANCA = cpf(2), NASC = "1991-03-03";

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "pt-BR",
});
const page = await ctx.newPage();
page.setDefaultTimeout(40000);
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });

const sair = async () => {
  await page.getByRole("button", { name: /^Sair$/ }).click();
  await page.waitForURL("**/entrar");
};
const entrar = async () => {
  await page.getByLabel("CPF do responsável").fill(CPF);
  await page.getByLabel("Data de nascimento do responsável").fill(NASC);
  await page.getByRole("button", { name: /^Entrar$/ }).click();
  await page.waitForTimeout(2500);
  return new URL(page.url()).pathname;
};
/**
 * Entra por /entrar SEM estado de rota de origem. Recarregar a mesma URL preserva o
 * history.state, e o `de` sobreviveria e mascararia a regra de destino.
 */
const entrarLimpo = async () => {
  await page.goto(`${BASE}/cadastrar`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /^Entrar$/ }).click();
  await page.waitForURL("**/entrar");
  await page.waitForTimeout(600);
  return entrar();
};

console.log(`\n— destino pos-login contra ${BASE} —\n`);

// 1. conta nova, nenhuma inscricao
await page.goto(`${BASE}/cadastrar`, { waitUntil: "networkidle" });
await page.getByLabel("Nome completo").fill("Retomada Teste");
await page.getByLabel("CPF").fill(CPF);
await page.getByLabel("Data de nascimento").fill(NASC);
await page.getByLabel(/Telefone/).fill("21977776666");
await page.getByLabel("E-mail").fill(`r${CPF}@exemplo.test`);
await page.getByRole("button", { name: /criar acesso/i }).click();
await page.waitForTimeout(2500);
ok(new URL(page.url()).pathname === "/inscricao/nova", `sem inscricao -> ${new URL(page.url()).pathname}`);

await page.getByLabel(/Nome completo da criança/).fill("Retomada Crianca");
await page.getByLabel(/CPF da criança/).fill(CPF_CRIANCA);
await page.getByLabel("Data de nascimento").fill("2024-09-09");
await page.getByRole("button", { name: /continuar para escolher/i }).click();
await page.waitForURL("**/unidades");
const id = new URL(page.url()).pathname.split("/")[2];

// 2. rascunho SEM opcoes -> retoma nas unidades. Era aqui que caia em /inscricao/nova.
await sair();
let destino = await entrar();
ok(destino === `/inscricao/${id}/unidades`, `rascunho sem opcoes -> ${destino}`);
ok(destino !== "/inscricao/nova", "NAO cai em cadastrar nova crianca (o bug do PARA-DEV-B)");

await page.getByRole("searchbox").fill("Bangu");
await page.getByRole("button", { name: /^Escolher$/ }).first().waitFor({ state: "visible" });
await page.waitForTimeout(700);
for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Escolher$/ }).first().click();
await page.waitForTimeout(2000);
const contador = (await page.getByText(/de 5 escolhidas/).first().textContent())?.trim();
ok(contador?.startsWith("3 de 5"), `opcoes gravadas: "${contador}"`);

// 3. rascunho COM opcoes e sem critério declarado -> vulnerabilidades
await sair();
destino = await entrarLimpo();
ok(destino === `/inscricao/${id}/vulnerabilidades`, `rascunho com opcoes -> ${destino}`);

// 4. a rota de origem tem precedencia sobre a regra
await page.goto(`${BASE}/inscricao/${id}/revisar`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await sair();
const voltou = await entrar();
ok(voltou === `/inscricao/${id}/revisar`, `rota de origem tem precedencia -> ${voltou}`);

// 5. a lista de inscricoes
await page.goto(`${BASE}/inscricoes`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
ok(await page.getByText("Retomada Crianca").count() > 0, "a lista mostra o nome da crianca");
ok(await page.getByText("Não enviada").count() > 0, 'situacao legivel ("Nao enviada"), nao o enum');
ok(await page.getByText("Pontos que contam").count() > 0, "a pontuacao aparece no cartao");
ok(await page.getByRole("link", { name: /continuar inscrição/i }).count() > 0, "rascunho tem acao de continuar");
ok(await page.getByRole("link", { name: /documentos|comprovantes/i }).count() > 0, "ha acao de documentos");

// 6. a raiz espera o /me antes de decidir, em vez de jogar no login
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
ok(new URL(page.url()).pathname === "/inscricoes", `raiz com sessao salva -> ${new URL(page.url()).pathname}`);

await navegador.close();
console.log(erros.length ? `\nCONSOLE:\n  ${[...new Set(erros)].join("\n  ")}` : "\nnenhum erro de console");
console.log(`\n${falhas === 0 ? "TODAS PASSARAM" : `${falhas} FALHA(S)`}`);
process.exit(falhas === 0 ? 0 : 1);
