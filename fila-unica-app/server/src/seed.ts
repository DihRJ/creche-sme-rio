/**
 * Seed do Fila Única, a partir das bases reais da SME publicadas em CIT-SME-RJ/dadoscreche.
 *
 * Idempotente: pode rodar quantas vezes quiser. Roda pela conexão DIRETA.
 *
 * O que é real e o que é derivado, para ninguém confundir depois:
 *   REAL      fila, matriculou, ociosas, turmas por unidade (processo 2025)
 *   REAL      os 13 critérios da régua oficial de 2025 e seus pesos (somam 100)
 *   DERIVADO  vagas = turmas x 25. O teto de 25 não foi arbitrado: é o p90 observado
 *             de alunos por turma nos seis grupamentos de 2025, e é a mesma definição
 *             que o motor em pipeline/ usa.
 *   AFORDÂNCIA  as 6 combinações grupamento x turno por unidade. A base anonimizada
 *             agrega por unidade e não publica a quebra por turno, então a combinação
 *             existe para a família poder escolher — nenhum número exibido vem dela.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { poolDireto, sqlDireto } from "./db.ts";
import { GRUPAMENTOS, TURNOS } from "./contracts.gen.ts";
import { normalizar } from "./texto.ts";
import { confirmavelPelaBase } from "./mock-cruzamento.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, "..", "dados");
const ANO = 2026;
const ANO_HISTORICO = 2025;
const TETO_TURMA = 25;

type LinhaUnidade = {
  unidade: string; nome: string; fila: number | null; matriculou: number | null;
  perdeu: number | null; cre: number | null; microarea: number | null;
  bairro: string | null; lat: number | null; lng: number | null;
  tipo: string | null; turmas: number | null; ociosas: number | null;
};
type LinhaRegua = { ano: number; perg_id: number; pontos: number; pergunta_texto: string };

const ler = <T>(arq: string): T => JSON.parse(readFileSync(join(DADOS, arq), "utf8")) as T;
const inteiro = (v: number | null | undefined) => Math.max(0, Math.round(v ?? 0));

export async function semear(): Promise<void> {
  const t0 = Date.now();

  // ── processo e calendário ────────────────────────────────────────────
  await sqlDireto(
    `insert into processo (ano, situacao, max_opcoes, semente) values ($1,'inscricao',5,$2)
     on conflict (ano) do nothing`,
    [ANO, process.env.SEMENTE_PROCESSO ?? "fila-unica-2026"],
  );

  const fases: [string, string, string, string][] = [
    ["inscricao",      "Inscrição",                  "2026-09-01", "2026-09-30"],
    ["rodada_1",       "Resultado da 1ª rodada",     "2026-10-05", "2026-10-08"],
    ["rodada_2",       "Resultado da 2ª rodada",     "2026-10-15", "2026-10-18"],
    ["remanescentes",  "Vagas remanescentes",        "2026-10-22", "2026-10-27"],
    ["matricula",      "Matrícula nas unidades",     "2026-10-28", "2026-11-10"],
  ];
  for (const [tipo, titulo, inicio, fim] of fases) {
    await sqlDireto(
      `insert into fase_calendario (processo_ano, tipo, titulo, inicio, fim) values ($1,$2,$3,$4,$5)
       on conflict (processo_ano, tipo) do nothing`,
      [ANO, tipo, titulo, inicio, fim],
    );
  }

  // ── régua oficial ────────────────────────────────────────────────────
  const regua = ler<LinhaRegua[]>("regua.json")
    .filter((r) => r.ano === ANO_HISTORICO)
    .sort((a, b) => b.pontos - a.pontos || a.perg_id - b.perg_id);

  for (const [i, c] of regua.entries()) {
    await sqlDireto(
      `insert into criterio (processo_ano, codigo, texto, pontos, e_desempate, exige_documento, ordem)
       values ($1,$2,$3,$4,false,$5,$6)
       on conflict (processo_ano, codigo) do update
         set texto = excluded.texto, pontos = excluded.pontos,
             exige_documento = excluded.exige_documento, ordem = excluded.ordem`,
      // exige_documento = false quando alguma base publica consegue confirmar o
      // criterio (RF2.2). Serve para a tela avisar ANTES de a familia declarar se
      // ela vai precisar do papel, em vez de descobrir depois.
      [ANO, c.perg_id, c.pergunta_texto, c.pontos, !confirmavelPelaBase(c.perg_id), i + 1],
    );
  }

  // ── unidades, ofertas e histórico ────────────────────────────────────
  // Só unidades com turma de creche: as demais não têm capacidade nem histórico,
  // e ofertar uma unidade sem dado é pedir para a família escolher às cegas —
  // exatamente o gargalo G3 que o produto existe para resolver.
  const unidades = ler<LinhaUnidade[]>("unidades.json").filter((u) => inteiro(u.turmas) > 0);

  // Inserção em LOTE, via unnest. Uma linha por vez custava 8 idas ao banco por
  // unidade — 3.900 round-trips, ~8 minutos pagando latência até us-east-2, o que
  // estoura o tempo de boot no Render. Assim são três statements no total.
  const cod = unidades.map((u) => String(u.unidade).padStart(7, "0"));
  const turmasDe = unidades.map((u) => inteiro(u.turmas));

  await sqlDireto(
    `insert into unidade (codigo, nome, tipo, bairro, cre, microarea, lat, lng, nome_busca, bairro_busca)
     select * from unnest($1::text[], $2::text[], $3::text[], $4::text[],
                          $5::int[], $6::numeric[], $7::float8[], $8::float8[],
                          $9::text[], $10::text[])
     on conflict (codigo) do update
       set nome = excluded.nome, tipo = excluded.tipo, bairro = excluded.bairro,
           cre = excluded.cre, lat = excluded.lat, lng = excluded.lng,
           nome_busca = excluded.nome_busca, bairro_busca = excluded.bairro_busca`,
    [cod, unidades.map((u) => u.nome), unidades.map((u) => u.tipo), unidades.map((u) => u.bairro),
     unidades.map((u) => u.cre), unidades.map((u) => u.microarea),
     unidades.map((u) => u.lat), unidades.map((u) => u.lng),
     unidades.map((u) => normalizar(u.nome)), unidades.map((u) => normalizar(u.bairro))],
  );

  await sqlDireto(
    `insert into historico_unidade (unidade_codigo, processo_ano, vagas, fila, matriculou, ociosas, turmas)
     select * from unnest($1::text[], $2::int[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[])
     on conflict (unidade_codigo, processo_ano) do update
       set vagas = excluded.vagas, fila = excluded.fila, matriculou = excluded.matriculou,
           ociosas = excluded.ociosas, turmas = excluded.turmas`,
    [cod, unidades.map(() => ANO_HISTORICO), turmasDe.map((t) => t * TETO_TURMA),
     unidades.map((u) => inteiro(u.fila)), unidades.map((u) => inteiro(u.matriculou)),
     unidades.map((u) => inteiro(u.ociosas)), turmasDe],
  );

  // Capacidade por oferta: distribuímos o teto físico da unidade entre as seis
  // combinações. É estimativa declarada, não dado da SME — por isso nenhuma tela
  // exibe este número como se fosse histórico.
  const oCod: string[] = [], oGrup: string[] = [], oTurno: string[] = [], oVagas: number[] = [];
  for (const [i, c] of cod.entries()) {
    const porOferta = Math.max(1, Math.floor((turmasDe[i] * TETO_TURMA) / (GRUPAMENTOS.length * TURNOS.length)));
    for (const g of GRUPAMENTOS) {
      for (const t of TURNOS) {
        oCod.push(c); oGrup.push(g); oTurno.push(t); oVagas.push(porOferta);
      }
    }
  }
  await sqlDireto(
    `insert into oferta (unidade_codigo, grupamento, turno, vagas_no_processo)
     select * from unnest($1::text[], $2::text[], $3::text[], $4::int[])
     on conflict (unidade_codigo, grupamento, turno) do update
       set vagas_no_processo = excluded.vagas_no_processo`,
    [oCod, oGrup, oTurno, oVagas],
  );

  const [n] = await sqlDireto<{ unidades: string; ofertas: string; criterios: string; fases: string }>(
    `select (select count(*) from unidade)                                as unidades,
            (select count(*) from oferta)                                 as ofertas,
            (select count(*) from criterio where processo_ano = $1)       as criterios,
            (select count(*) from fase_calendario where processo_ano = $1) as fases`,
    [ANO],
  );
  console.log(
    `seed: ${n.unidades} unidades · ${n.ofertas} ofertas · ${n.criterios} critérios · ${n.fases} fases ` +
      `(${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
}

// Permite rodar isolado: `node --env-file=.env --experimental-strip-types src/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { migrar } = await import("./migrar.ts");
  await migrar();
  await semear();
  await poolDireto.end();
}
