import { Pool } from "pg";
for (const [rotulo, url] of [["DIRETA (DDL/migração)", process.env.DATABASE_URL_UNPOOLED],
                             ["POOLED (runtime da API)", process.env.DATABASE_URL]]) {
  const t0 = Date.now();
  const p = new Pool({ connectionString: url });
  const { rows: [r] } = await p.query(
    "select version() v, current_database() db, current_user usr, now() agora");
  console.log(`${rotulo}\n  ${r.v.split(",")[0]}\n  banco=${r.db} usuario=${r.usr} (${Date.now()-t0}ms)`);
  await p.end();
}
