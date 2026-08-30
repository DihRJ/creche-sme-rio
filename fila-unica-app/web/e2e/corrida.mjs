/**
 * Regressao da corrida no E9.
 *
 * O E9 substitui a lista inteira, e o payload e montado a partir do estado local, que
 * so atualiza quando a resposta chega. Enquanto so o cartao clicado ficava
 * desabilitado, um segundo toque antes da resposta mandava a lista velha e APAGAVA a
 * escolha anterior, sem erro nenhum. Uma familia em rede movel tocando em duas
 * creches rapido perdia uma.
 *
 * Localhost esconde, porque a resposta volta em milissegundos. Foi o percurso na URL
 * publica que revelou: 3 de 5 creches num roteiro que clicou cinco vezes.
 *
 * Este teste clica cinco vezes SEM ESPERA NENHUMA e exige 5 de 5.
 *
 *   URL_APP=http://localhost:5173 node e2e/corrida.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.URL_APP ?? "http://localhost:5173";
const cpf = String(80000000000 + (Date.now() % 800000000));

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "pt-BR",
});
const page = await ctx.newPage();
page.setDefaultTimeout(40000);

await page.goto(`${BASE}/cadastrar`, { waitUntil: "networkidle", timeout: 90000 });
await page.getByLabel("Nome completo").fill("Corrida Teste");
await page.getByLabel("CPF").fill(cpf);
await page.getByLabel("Data de nascimento").fill("1990-01-01");
await page.getByLabel(/Telefone/).fill("21999998888");
await page.getByLabel("E-mail").fill(`c${cpf}@exemplo.test`);
await page.getByRole("button", { name: /criar acesso/i }).click();
await page.waitForURL("**/inscricao/nova");

await page.getByLabel(/Nome completo da criança/).fill("Corrida Crianca");
await page.getByLabel(/CPF da criança/).fill(String(Number(cpf) + 1));
await page.getByLabel("Data de nascimento").fill("2024-05-05");
await page.getByRole("button", { name: /continuar para escolher/i }).click();
await page.waitForURL("**/unidades");

await page.getByRole("searchbox").fill("Bangu");
await page.getByRole("button", { name: /^Escolher$/ }).first().waitFor({ state: "visible" });
await page.waitForTimeout(800);

// O ponto do teste: zero espera entre os cliques. O Playwright espera o botao voltar
// a ficar clicavel, e e justamente isso que serializa as gravacoes — so funciona
// porque a tela desabilita TODOS os botoes enquanto ha gravacao em voo.
for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Escolher$/ }).first().click();

await page.waitForTimeout(3000);
const texto = (await page.getByText(/de 5 escolhidas/).first().textContent())?.trim();
const passou = texto?.startsWith("5 de 5");
console.log(`\n  contador: "${texto}"`);
console.log(`  ${passou ? "PASSOU: nenhuma escolha perdida" : "FALHOU: escolha perdida na corrida"}\n`);

await navegador.close();
process.exit(passou ? 0 : 1);
