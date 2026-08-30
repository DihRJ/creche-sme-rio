/** Fila Única · API. Sobe o schema, semeia e serve. */
import cors from "cors";
import express from "express";
import { BASE_API } from "./contracts.gen.ts";
import { fechar, pool } from "./db.ts";
import { ok, rota, tratarErro } from "./http.ts";
import { migrar } from "./migrar.ts";
import { catalogo } from "./rotas/catalogo.ts";
import { semear } from "./seed.ts";

const PORTA = Number(process.env.PORT ?? 3001);
const app = express();

app.use(cors({ origin: process.env.WEB_ORIGIN ?? true }));
app.use(express.json({ limit: "1mb" }));

// E17 — o primeiro endpoint a existir, porque é o que prova o deploy.
app.get(
  `${BASE_API}/saude`,
  rota(async (_req, res) => {
    let banco: "ok" | "erro" = "ok";
    try {
      await pool.query("select 1");
    } catch {
      banco = "erro";
    }
    return ok(res, { ok: true as const, versao: "1.0.0", banco });
  }),
);

app.use(BASE_API, catalogo);
app.use(tratarErro);

const servidor = app.listen(PORTA, async () => {
  console.log(`API em http://localhost:${PORTA}${BASE_API}`);
  try {
    await migrar();
    await semear();
  } catch (e) {
    // Não derruba o processo: o /saude precisa responder para o Render marcar o
    // serviço como vivo, e um erro de seed é diagnosticável pelo log.
    console.error("falha ao preparar o banco:", e);
  }
});

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, () => servidor.close(() => fechar().then(() => process.exit(0))));
}
