/** E7 criar rascunho · E8 buscar. */
import { Router } from "express";
import { autor, exigeAuth, exigirData, exigirTexto, limparCpf } from "../auth.ts";
import { auditar } from "../auditoria.ts";
import { sql, transacao } from "../db.ts";
import { ErroHttp, ok, rota } from "../http.ts";
import { exigirDono, montarInscricao } from "../inscricao.ts";
import { GRUPAMENTOS, TURNOS, type Grupamento, type Turno } from "../contracts.gen.ts";

export const inscricoes = Router();

// ── E7 ────────────────────────────────────────────────────────────────
inscricoes.post(
  "/inscricoes",
  exigeAuth,
  rota(async (req, res) => {
    const responsavelId = autor(req);
    const nome = exigirTexto(req.body?.crianca?.nome, "crianca.nome", "Nome da criança");
    const cpf = limparCpf(req.body?.crianca?.cpf, "crianca.cpf");
    const nascimento = exigirData(req.body?.crianca?.nascimento, "crianca.nascimento", "Data de nascimento da criança");

    const grupamento = String(req.body?.grupamento ?? "") as Grupamento;
    if (!GRUPAMENTOS.includes(grupamento))
      throw new ErroHttp("VALIDACAO", `Grupamento inválido. Use um de: ${GRUPAMENTOS.join(", ")}.`, "grupamento");
    const turno = String(req.body?.turno ?? "") as Turno;
    if (!TURNOS.includes(turno))
      throw new ErroHttp("VALIDACAO", `Turno inválido. Use um de: ${TURNOS.join(", ")}.`, "turno");

    const [processo] = await sql<{ ano: number }>(`select ano from processo order by ano desc limit 1`);
    if (!processo) throw new ErroHttp("ERRO_INTERNO", "Nenhum processo aberto.");

    // INV1: uma inscrição ativa por criança por processo. É metade da correção do
    // gargalo G1 — hoje o mesmo CPF gera até cinco filas independentes.
    const [jaInscrita] = await sql<{ id: string }>(
      `select i.id from inscricao i join crianca c on c.id = i.crianca_id
        where c.cpf = $1 and i.processo_ano = $2`,
      [cpf, processo.ano],
    );
    if (jaInscrita)
      throw new ErroHttp("CPF_JA_INSCRITO", "Esta criança já tem inscrição neste processo.", "crianca.cpf");

    const id = await transacao(async (q) => {
      // A criança pode já existir de um processo anterior; nesse caso reaproveita,
      // desde que seja do mesmo responsável.
      const [existente] = await q<{ id: string; responsavel_id: string }>(
        `select id, responsavel_id from crianca where cpf = $1`,
        [cpf],
      );
      if (existente && existente.responsavel_id !== responsavelId)
        throw new ErroHttp("SEM_PERMISSAO", "Esta criança está vinculada a outro responsável.", "crianca.cpf");

      const criancaId = existente
        ? existente.id
        : (
            await q<{ id: string }>(
              `insert into crianca (cpf, nome, nascimento, responsavel_id) values ($1,$2,$3,$4) returning id`,
              [cpf, nome, nascimento, responsavelId],
            )
          )[0].id;

      const [nova] = await q<{ id: string }>(
        `insert into inscricao (processo_ano, crianca_id, grupamento, turno) values ($1,$2,$3,$4) returning id`,
        [processo.ano, criancaId, grupamento, turno],
      );
      await auditar("inscricao", nova.id, "criada", responsavelId, null, { grupamento, turno }, q);
      return nova.id;
    });

    return ok(res, await montarInscricao(id));
  }),
);

// ── E8 ────────────────────────────────────────────────────────────────
inscricoes.get(
  "/inscricoes/:id",
  exigeAuth,
  rota(async (req, res) => {
    // Express 5 tipa req.params como string | string[].
    const id = String(req.params.id);
    await exigirDono(id, autor(req));
    return ok(res, await montarInscricao(id));
  }),
);
