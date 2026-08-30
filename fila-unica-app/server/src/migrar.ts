/** Aplica o schema.sql pela conexão DIRETA. Idempotente: só `create ... if not exists`. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { poolDireto } from "./db.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));

export async function migrar(): Promise<void> {
  const ddl = readFileSync(join(AQUI, "schema.sql"), "utf8");
  const cliente = await poolDireto.connect();
  try {
    await cliente.query(ddl);
    console.log("schema aplicado");
  } finally {
    cliente.release();
  }
}
