/**
 * Passada visual do percurso inteiro, em 360px, com o console do navegador capturado.
 *
 * Achou coisa que typecheck e teste de logica nao pegam: texto de ajuda dentro do
 * <label> entrando no nome acessivel do campo, nome de unidade cortado em
 * "EDI PROFESSO...", aviso preso no topo comendo 300px de um viewport de 780, e
 * "0 de 0 pontos" com a frase "tudo que voce declarou tem lastro".
 *
 *   URL_APP=http://localhost:5173 node e2e/percurso.mjs
 *   URL_APP=https://fila-unica-web.onrender.com node e2e/percurso.mjs   # CUIDADO: escreve
 *
 * Contra a URL publica ele CRIA responsavel, crianca e inscricao no banco. Os CPFs
 * sao sorteados e os nomes dizem "Percurso Teste"; saem impressos no fim.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, "capturas");
const BASE = process.env.URL_APP ?? "http://localhost:5173";
const PUBLICO = !BASE.includes("localhost");

const erros = [];
let n = 0;
const cpf = (s) => String(70000000000 + (Date.now() % 800000000) + s);
const CPF_RESP = cpf(1);
const CPF_CRIANCA = cpf(2);

async function tira(page, nome) {
  n++;
  await page.screenshot({ path: join(SAIDA, `${String(n).padStart(2, "0")}-${nome}.png`), fullPage: true });
  const alt = await page.evaluate(() => document.body.scrollHeight);
  console.log(`  ${String(n).padStart(2, "0")} ${nome.padEnd(26)} altura=${alt}px  rota=${new URL(page.url()).pathname}`);
}

mkdirSync(SAIDA, { recursive: true });
const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR", colorScheme: "light",
});
const page = await ctx.newPage();
page.setDefaultTimeout(PUBLICO ? 60000 : 30000);
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") erros.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message}`));

const pausa = (ms) => page.waitForTimeout(PUBLICO ? ms * 2 : ms);

console.log(`\n— percurso em 360px contra ${BASE} —`);
if (PUBLICO) console.log(`  responsavel ${CPF_RESP} · crianca ${CPF_CRIANCA}`);
console.log("");

await page.goto(`${BASE}/cadastrar`, { waitUntil: "networkidle", timeout: 90000 });
await page.getByLabel("Nome completo").fill("Percurso Teste Responsavel");
await page.getByLabel("CPF").fill(CPF_RESP);
await page.getByLabel("Data de nascimento").fill("1994-05-02");
await page.getByLabel(/Telefone/).fill("21990001111");
await page.getByLabel("E-mail").fill(`percurso${CPF_RESP}@exemplo.test`);
await tira(page, "cadastrar");

await page.getByRole("button", { name: /criar acesso/i }).click();
await page.waitForURL("**/inscricao/nova");
await pausa(500);
await page.getByLabel(/Nome completo da criança/).fill("Percurso Teste Crianca");
await page.getByLabel(/CPF da criança/).fill(CPF_CRIANCA);
await page.getByLabel("Data de nascimento").fill("2025-03-10");
await pausa(400);
await tira(page, "crianca-com-sugestao");

await page.getByRole("button", { name: /continuar para escolher/i }).click();
await page.waitForURL("**/unidades");
await pausa(1200);
await tira(page, "unidades-inicial");

await page.getByRole("searchbox").fill("Bangu");
await page.getByRole("button", { name: /^Escolher$/ }).first().waitFor({ state: "visible" });
await pausa(700);
await tira(page, "unidades-busca");

// Cinco cliques. O Playwright espera o botao voltar a ficar clicavel, o que so
// funciona porque a tela desabilita todos durante a gravacao do E9.
for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Escolher$/ }).first().click();
await pausa(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await pausa(300);
await page.screenshot({ path: join(SAIDA, "viewport-cinco-escolhidas.png") });
await tira(page, "unidades-cinco");

const contador = (await page.getByText(/de 5 escolhidas/).first().textContent())?.trim();
console.log(`\n  contador: "${contador}"  ${contador?.startsWith("5 de 5") ? "(nenhuma escolha perdida)" : "ATENCAO: escolha perdida"}`);
console.log(`  botao "Escolher" desabilitado no limite: ${await page.getByRole("button", { name: /^Escolher$/ }).first().isDisabled()}\n`);

await page.getByRole("button", { name: /^Descer / }).first().click();
await pausa(800);
await tira(page, "unidades-reordenada");

await page.getByRole("button", { name: /^Continuar$/ }).click();
await page.waitForURL("**/vulnerabilidades");
await pausa(1500);
await tira(page, "vulnerabilidades");

// CadUnico: 51 dos 100 pontos, confirmado pela base sem documento. E o momento
// mais forte da demonstracao, e o que da pontuacao diferente de zero ao Revisar.
const cadunico = page.locator("label").filter({ hasText: /Cad[Úú]nico/i }).locator('input[type="checkbox"]').first();
if (await cadunico.count()) {
  await cadunico.check();
  await pausa(1500);
  await tira(page, "vulnerabilidades-cadunico");
} else {
  console.log("     (nao achei o checkbox do CadUnico)");
}

await page.getByRole("button", { name: /^(Continuar|Enviar comprovantes)$/ }).click();
await page.waitForURL("**/documentos");
await pausa(1000);
await tira(page, "documentos");

await page.getByRole("button", { name: /revisar a inscrição/i }).click();
await page.waitForURL("**/revisar");
await pausa(1200);
await tira(page, "revisar");

await page.getByRole("button", { name: /finalizar inscrição/i }).click();
await pausa(1800);
await tira(page, "enviada");
const sorteio = await page.locator(".num").filter({ hasText: /^[0-9a-f]{8}$/ }).first().textContent().catch(() => null);
console.log(`  numero de sorteio: ${sorteio ?? "NAO ENCONTRADO"}`);

// Acompanhamento: e onde a explicacao do Claude aparece (E15).
await page.getByRole("link", { name: /acompanhar a inscrição/i }).click().catch(() => page.goto(`${BASE}/inscricoes`));
await pausa(2000);
await tira(page, "acompanhamento");

await page.goto(`${BASE}/inscricoes`, { waitUntil: "networkidle" });
await pausa(1500);
await tira(page, "lista-de-inscricoes");
await ctx.close();

// Tema escuro e largura de desktop: a paleta e validada para os dois.
for (const [tema, largura, tag] of [["dark", 360, "escuro"], ["light", 1280, "desktop"]]) {
  const c = await navegador.newContext({
    viewport: { width: largura, height: 800 }, locale: "pt-BR", colorScheme: tema,
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => erros.push(`[${tag}] ${e.message}`));
  await p.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1200);
  n = tag === "escuro" ? 90 : 95;
  await tira(p, tag);
  await c.close();
}

await navegador.close();
console.log(erros.length ? `\nCONSOLE:\n  ${[...new Set(erros)].join("\n  ")}` : "\nnenhum erro nem warning de console");
console.log(`\ncapturas em ${SAIDA}`);
if (PUBLICO) console.log(`CRIADO EM PRODUCAO: responsavel ${CPF_RESP}, crianca ${CPF_CRIANCA}`);
