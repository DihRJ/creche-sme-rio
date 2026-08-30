/**
 * Dois pools, e a distinção não é decorativa.
 *
 *   pool        → DATABASE_URL          (host com sufixo `-pooler`)  runtime da API
 *   poolDireto  → DATABASE_URL_UNPOOLED (host direto)                DDL, seed, migração
 *
 * Rodar DDL pela conexão pooled falha de forma intermitente e a mensagem não ajuda.
 * O pooler multiplexa sessões, então `CREATE TABLE`, `ALTER` e qualquer coisa que dependa
 * de estado de sessão não têm garantia de cair sempre na mesma conexão física.
 */
import { Pool, type QueryResultRow } from "pg";

function exigir(nome: string): string {
  const v = process.env[nome];
  if (!v) throw new Error(`Variável de ambiente ausente: ${nome}. Rode: neon env pull --file .env --service postgres`);
  return v;
}

export const pool = new Pool({
  connectionString: exigir("DATABASE_URL"),
  max: 10,
  // O compute do Neon suspende após ~5 min ocioso; a primeira consulta depois disso
  // paga o cold start. Damos folga para não derrubar requisição legítima.
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
});

export const poolDireto = new Pool({
  connectionString: exigir("DATABASE_URL_UNPOOLED"),
  max: 4,
  connectionTimeoutMillis: 15_000,
});

/** Consulta pelo pool de runtime. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  texto: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query<T>(texto, params);
  return rows;
}

/** Consulta pela conexão direta. Use para DDL, seed e migração. */
export async function sqlDireto<T extends QueryResultRow = QueryResultRow>(
  texto: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await poolDireto.query<T>(texto, params);
  return rows;
}

/** Uma transação no pool de runtime. Devolve o resultado do callback ou faz rollback. */
export async function transacao<T>(fn: (q: typeof sql) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const consultar = async <R extends QueryResultRow = QueryResultRow>(t: string, p: unknown[] = []) =>
      (await cliente.query<R>(t, p)).rows;
    const r = await fn(consultar as typeof sql);
    await cliente.query("commit");
    return r;
  } catch (e) {
    await cliente.query("rollback");
    throw e;
  } finally {
    cliente.release();
  }
}

export async function fechar(): Promise<void> {
  await Promise.all([pool.end(), poolDireto.end()]);
}
