/** E4 processo · E5 critérios · E6 ofertas. Tudo público: a família escolhe antes de se cadastrar. */
import { Router } from "express";
import { sql } from "../db.ts";
import { normalizar } from "../texto.ts";
import { ok, rota } from "../http.ts";
import type { Criterio, Fase, Oferta, PaginaOfertas, Processo } from "../contracts.gen.ts";

export const catalogo = Router();
// 12 por pagina: rede movel (RNF1) e o que a tela do front pagina. O cliente deve
// ler `por_pagina` da resposta, nunca fixar o numero.
const POR_PAGINA = 12;

function situacaoDaFase(inicio: string, fim: string, hoje: string): Fase["situacao"] {
  if (hoje < inicio) return "futura";
  if (hoje > fim) return "encerrada";
  return "atual";
}

// ── E4 ────────────────────────────────────────────────────────────────
catalogo.get(
  "/processo",
  rota(async (_req, res) => {
    const [p] = await sql<{ ano: number; situacao: string; max_opcoes: number }>(
      `select ano, situacao, max_opcoes from processo order by ano desc limit 1`,
    );
    const linhas = await sql<{ tipo: Fase["tipo"]; titulo: string; inicio: string; fim: string }>(
      `select tipo, titulo, to_char(inicio,'YYYY-MM-DD') inicio, to_char(fim,'YYYY-MM-DD') fim
         from fase_calendario where processo_ano = $1 order by inicio`,
      [p.ano],
    );
    const hoje = new Date().toISOString().slice(0, 10);
    const resposta: Processo = {
      ano: p.ano,
      situacao: p.situacao,
      max_opcoes: p.max_opcoes,
      fases: linhas.map((f) => ({ ...f, situacao: situacaoDaFase(f.inicio, f.fim, hoje) })),
    };
    return ok(res, resposta);
  }),
);

// ── E5 ────────────────────────────────────────────────────────────────
catalogo.get(
  "/criterios",
  rota(async (_req, res) => {
    const linhas = await sql<Criterio>(
      `select c.id, c.codigo, c.texto, c.pontos, c.e_desempate, c.exige_documento
         from criterio c
         join processo p on p.ano = c.processo_ano
        order by c.ordem`,
    );
    return ok(res, linhas satisfies Criterio[]);
  }),
);

// ── E6 ────────────────────────────────────────────────────────────────
// A tela mais pesada do front depende deste endpoint: é onde a família vê o
// histórico de cada unidade antes de escolher. Resolve o gargalo G3.
catalogo.get(
  "/ofertas",
  rota(async (req, res) => {
    const busca = String(req.query.busca ?? "").trim();
    const bairro = String(req.query.bairro ?? "").trim();
    const cre = req.query.cre ? Number(req.query.cre) : null;
    const grupamento = String(req.query.grupamento ?? "").trim();
    const turno = String(req.query.turno ?? "").trim();
    const pagina = Math.max(1, Number(req.query.pagina ?? 1) || 1);

    const cond: string[] = [];
    const p: unknown[] = [];
    /** Adiciona um parâmetro e devolve o placeholder ($1, $2, ...). */
    const par = (valor: unknown) => `$${p.push(valor)}`;

    if (busca) {
      // Busca contra as colunas NORMALIZADAS: a família digita "jacarepagua" sem
      // acento no teclado do celular e precisa achar "Jacarepaguá". Comparar com o
      // texto cru devolve zero resultado e nada avisa que houve um problema.
      // O mesmo termo serve para nome e bairro: UM parâmetro, usado duas vezes.
      const t = par(`%${normalizar(busca)}%`);
      cond.push(`(u.nome_busca like ${t} or u.bairro_busca like ${t})`);
    }
    if (bairro) cond.push(`u.bairro_busca = ${par(normalizar(bairro))}`);
    if (cre !== null && !Number.isNaN(cre)) cond.push(`u.cre = ${par(cre)}`);
    if (grupamento) cond.push(`o.grupamento = ${par(grupamento)}`);
    if (turno) cond.push(`o.turno = ${par(turno)}`);
    const onde = cond.length ? `where ${cond.join(" and ")}` : "";

    const [{ total }] = await sql<{ total: string }>(
      `select count(*)::text total from oferta o join unidade u on u.codigo = o.unidade_codigo ${onde}`,
      p,
    );

    const linhas = await sql<{
      id: string; grupamento: Oferta["grupamento"]; turno: Oferta["turno"]; vagas_no_processo: number;
      codigo: string; nome: string; tipo: string | null; bairro: string | null;
      cre: number | null; lat: number | null; lng: number | null;
      historico: Oferta["historico"] | null;
    }>(
      `select o.id, o.grupamento, o.turno, o.vagas_no_processo,
              u.codigo, u.nome, u.tipo, u.bairro, u.cre, u.lat, u.lng,
              (select coalesce(json_agg(json_build_object(
                        'processo_ano', h.processo_ano, 'vagas', h.vagas, 'fila', h.fila,
                        'matriculou', h.matriculou, 'ociosas', h.ociosas,
                        'nota_de_corte', h.nota_de_corte) order by h.processo_ano desc), '[]'::json)
                 from historico_unidade h where h.unidade_codigo = u.codigo) as historico
         from oferta o
         join unidade u on u.codigo = o.unidade_codigo
         ${onde}
        order by u.nome, o.grupamento, o.turno
        limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`,
      p,
    );

    const itens: Oferta[] = linhas.map((l) => ({
      id: l.id,
      grupamento: l.grupamento,
      turno: l.turno,
      vagas_no_processo: l.vagas_no_processo,
      unidade: { codigo: l.codigo, nome: l.nome, tipo: l.tipo, bairro: l.bairro, cre: l.cre, lat: l.lat, lng: l.lng },
      historico: l.historico ?? [],
    }));

    const resposta: PaginaOfertas = { itens, total: Number(total), pagina, por_pagina: POR_PAGINA };
    return ok(res, resposta);
  }),
);
