/**
 * Vídeo de apresentação do app da família, gravado num navegador de verdade.
 *
 *   node e2e/video.mjs                       # contra o mock, em localhost:5173
 *   URL_APP=http://localhost:5173 node e2e/video.mjs
 *
 * Sai um .webm em `e2e/videos/`. O Playwright grava nativamente, então não precisa
 * de ffmpeg — que não existe nesta máquina.
 *
 * SEM ÁUDIO. Narração é legenda na tela: não há como gerar voz aqui, e legenda tem
 * a vantagem de funcionar no mudo, que é como a maioria assiste vídeo institucional.
 *
 * Roda contra o MOCK de propósito: é determinístico, não escreve em banco nenhum e
 * o cruzamento por CPF é estável, então o CadÚnico confirma sempre no mesmo ponto.
 * O `percurso.mjs` ao lado avisa que contra a URL pública ele escreve em produção —
 * este aqui nunca deve apontar para lá.
 *
 * Os seletores são os mesmos do `percurso.mjs`, para não haver duas verdades sobre
 * como se chega em cada tela.
 */
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, "videos");
const BASE = process.env.URL_APP ?? "http://localhost:5173";

if (!BASE.includes("localhost")) {
  console.error("Recuse-se: este roteiro preenche formulário e finaliza inscrição.");
  console.error("Contra a URL pública isso escreve no banco de produção. Use o mock.");
  process.exit(1);
}

/* CPF que o cruzamento determinístico do mock CONFIRMA para o CadÚnico. É o que faz
 * a cena do "você não precisa enviar documento" acontecer, que é o ponto do vídeo. */
const CPF_RESP = "11122233300";
const CPF_CRIANCA = "55566677788";

const t0 = Date.now();
const decorrido = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3);

mkdirSync(SAIDA, { recursive: true });
const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: 420, height: 900 },
  locale: "pt-BR",
  colorScheme: "light",
  recordVideo: { dir: SAIDA, size: { width: 420, height: 900 } },
});
const page = await ctx.newPage();
page.setDefaultTimeout(30000);

const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

/**
 * Legenda fixa no rodapé. Injetada por página, e reinjetada a cada navegação
 * porque o React troca o documento inteiro no `goto`.
 */
async function legenda(titulo, texto, ms = 3200) {
  await page.evaluate(
    ([t, x]) => {
      let el = document.getElementById("fu-legenda");
      if (!el) {
        el = document.createElement("div");
        el.id = "fu-legenda";
        el.style.cssText = [
          "position:fixed", "left:0", "right:0", "bottom:0", "z-index:2147483647",
          "background:linear-gradient(to top, rgba(0,42,72,.97) 72%, rgba(0,42,72,0))",
          "color:#fff", "padding:26px 20px 22px",
          "font:400 15px/1.5 -apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Roboto,Arial,sans-serif",
          "pointer-events:none",
        ].join(";");
        document.body.appendChild(el);
      }
      el.innerHTML =
        `<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.72;margin-bottom:5px">${t}</div>` +
        `<div style="font-weight:500">${x}</div>`;
    },
    [titulo, texto],
  );
  console.log(`  ${decorrido()}s  ${titulo} — ${texto.replace(/<[^>]+>/g, "").slice(0, 62)}`);
  await page.waitForTimeout(ms);
}

const pausa = (ms) => page.waitForTimeout(ms);

console.log(`\n— gravando contra ${BASE} —\n`);

/* ─────────────────  1. o problema  ───────────────── */
await page.goto(`${BASE}/entrar`, { waitUntil: "networkidle", timeout: 90000 });
await legenda("Fila Única · SME-Rio", "Inscrição em creche da Prefeitura do Rio, refeita para a família entender a própria posição na fila.", 4200);
await legenda("O problema", "Em 2025, <b>93% das inscrições</b> entraram na fila com <b>zero ponto</b>.", 4000);
await legenda("Por quê", "O CadÚnico vale <b>51 dos 100 pontos</b> da régua. Foi declarado por 35 mil famílias e validado em <b>6,8%</b>.", 5000);

/* ─────────────────  2. cadastro  ───────────────── */
await page.goto(`${BASE}/cadastrar`, { waitUntil: "networkidle" });
await legenda("Etapa 1 de 6 · Criar acesso", "Sem senha: o acesso é por CPF e data de nascimento. Uma senha a menos para esquecer.", 3600);
await page.getByLabel("Nome completo").fill("Vanessa Souza");
await pausa(500);
await page.getByLabel("CPF").fill(CPF_RESP);
await pausa(400);
await page.getByLabel("Data de nascimento").fill("1994-05-02");
await pausa(400);
await page.getByLabel(/Telefone/).fill("21990001111");
await pausa(400);
await page.getByLabel("E-mail").fill("vanessa@exemplo.br");
await legenda("Etapa 1 de 6 · Criar acesso", "Telefone e e-mail ficam <b>versionados</b>: dá para corrigir depois sem ir à unidade.", 3800);
await page.getByRole("button", { name: /criar acesso/i }).click();

/* ─────────────────  3. dados da criança  ───────────────── */
await page.waitForURL("**/inscricao/nova");
await pausa(900);
await legenda("Etapa 2 de 6 · A criança", "Nome, CPF e data de nascimento da criança.", 3000);
await page.getByLabel(/Nome completo da criança/).fill("Ana Souza");
await pausa(400);
await page.getByLabel(/CPF da criança/).fill(CPF_CRIANCA);
await pausa(400);
await page.getByLabel("Data de nascimento").fill("2025-03-10");
await pausa(900);
await legenda("Etapa 2 de 6 · A criança", "O grupamento é <b>sugerido pela idade</b>. A família não precisa saber o que é Maternal I.", 4200);
await page.getByRole("button", { name: /continuar para escolher/i }).click();

/* ─────────────────  4. unidades  ───────────────── */
await page.waitForURL("**/unidades");
await pausa(1600);
await legenda("Etapa 3 de 6 · Escolher creches", "O catálogo é o real da SME: 173 ofertas para este grupamento e turno.", 3600);
await page.getByRole("searchbox").fill("Bangu");
await page.getByRole("button", { name: /^Escolher$/ }).first().waitFor({ state: "visible" });
await pausa(900);
await legenda("Etapa 3 de 6 · Escolher creches", "Busca por bairro. <b>JACAREPAGUÁ e JACAREPAGUA</b> são o mesmo bairro — o acento não atrapalha.", 4200);
for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Escolher$/ }).first().click();
await pausa(1600);
await page.evaluate(() => window.scrollTo(0, 0));
await pausa(400);
await legenda("Etapa 3 de 6 · Escolher creches", "Até 5 creches, e <b>a ordem vale</b>: a vaga é procurada na 1ª antes da 2ª.", 4200);
await page.getByRole("button", { name: /^Descer / }).first().click();
await pausa(1200);
await legenda("Etapa 3 de 6 · Escolher creches", "Dá para reordenar. Nenhuma tela promete chance de entrar — o sistema não sabe, e fingir seria pior.", 4400);
await page.getByRole("button", { name: /^Continuar$/ }).click();

/* ─────────────────  5. vulnerabilidades: o achado  ───────────────── */
await page.waitForURL("**/vulnerabilidades");
await pausa(1800);
await legenda("Etapa 4 de 6 · Situação da família", "Aqui está o achado do projeto. Os 13 critérios reais da régua da SME, <b>com o valor em pontos ao lado</b>.", 4800);
await legenda("Etapa 4 de 6 · Situação da família", "O CadÚnico abre a lista porque vale <b>51 pontos</b>. Hoje a família descobre isso depois de perder a vaga.", 4800);
const cadunico = page.locator("label").filter({ hasText: /Cad[Úú]nico/i }).locator('input[type="checkbox"]').first();
await cadunico.check();
await pausa(1800);
await legenda("Etapa 4 de 6 · O momento", "<b>“Confirmado pela base. Você não precisa enviar documento.”</b> O cruzamento automático resolve sozinho.", 5200);
await legenda("Etapa 4 de 6 · O contador", "O rodapé mostra sempre <b>quanto conta contra quanto foi declarado</b> — e quantos pontos estão sendo perdidos.", 4600);
await page.getByRole("button", { name: /^(Continuar|Enviar comprovantes)$/ }).click();

/* ─────────────────  6. documentos  ───────────────── */
await page.waitForURL("**/documentos");
await pausa(1400);
await legenda("Etapa 5 de 6 · Comprovantes", "O que a base não confirma ganha um cartão de envio: <b>foto pelo celular</b>, direto da câmera.", 4400);
await legenda("Etapa 5 de 6 · Comprovantes", "Comprovante faltando <b>não trava a inscrição</b>. O critério não pontua, mas a inscrição vai assim mesmo.", 4400);
await page.getByRole("button", { name: /revisar a inscrição/i }).click();

/* ─────────────────  7. revisar e finalizar  ───────────────── */
await page.waitForURL("**/revisar");
await pausa(1600);
await legenda("Etapa 6 de 6 · Revisar", "A conferência antes de enviar: a criança, as creches na ordem e a pontuação.", 4000);
await page.getByRole("button", { name: /finalizar inscrição/i }).click();
await pausa(2200);
await legenda("Inscrição enviada", "O <b>número de inscrição</b> vem de uma semente publicada antes do fim das inscrições. Qualquer pessoa pode conferir que ele não foi escolhido depois de saber o resultado.", 5600);

/* ─────────────────  8. acompanhamento  ───────────────── */
await page.goto(`${BASE}/inscricoes`, { waitUntil: "networkidle" });
await pausa(1400);
await legenda("Depois do envio", "A família acompanha sem precisar ligar para ninguém.", 3200);
/* O card da lista NÃO é um link com o nome da criança: quem navega é o
 * "Ver detalhes". A primeira gravação errou isso e as legendas do resultado
 * tocaram sobre a tela de lista. */
await legenda("Depois do envio", "Uma criança tem uma inscrição, e é ela que concorre em todas as opções ao mesmo tempo.", 4000);
const detalhes = page.getByRole("link", { name: /ver detalhes/i }).first();
await detalhes.waitFor({ state: "visible" });
await detalhes.click();
await page.waitForURL(/\/inscricao\/[^/]+$/);
await pausa(2000);
await legenda("Acompanhamento", "Situação, número de inscrição, a criança e as creches na ordem escolhida.", 4000);
await page.evaluate(() => window.scrollBy(0, 700));
await pausa(1200);
await legenda("Calendário", "Todas as datas do processo, com a fase atual destacada. Hoje a família descobre o prazo ao ser chamada — às vezes tarde.", 5000);
await page.evaluate(() => window.scrollBy(0, 900));
await pausa(1200);
await legenda("Resultado", "Creche por creche: <b>a nota de corte contra a pontuação da criança</b>, e quantos concorreram a quantas vagas.", 5000);
await page.evaluate(() => window.scrollBy(0, 900));
await pausa(1200);
await legenda("Explicação", "E a explicação em português. Um algoritmo que ninguém consegue explicar não é adotável, por mais correto que seja.", 5000);

/* ─────────────────  9. fecho  ───────────────── */
await legenda("Fila Única", "Uma criança, uma fila, uma vaga.", 4000);

await ctx.close();
await navegador.close();

const arquivos = readdirSync(SAIDA).filter((f) => f.endsWith(".webm"));
const bruto = arquivos.map((f) => ({ f, t: statSync(join(SAIDA, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
const destino = join(SAIDA, "fila-unica.webm");
if (bruto && bruto.f !== "fila-unica.webm") renameSync(join(SAIDA, bruto.f), destino);

const total = (Date.now() - t0) / 1000;
console.log(`\nduração ≈ ${Math.floor(total / 60)}min ${String(Math.round(total % 60)).padStart(2, "0")}s`);
console.log(erros.length ? `erros de página: ${[...new Set(erros)].join(" | ")}` : "nenhum erro de página");
console.log(`vídeo: ${destino}`);
