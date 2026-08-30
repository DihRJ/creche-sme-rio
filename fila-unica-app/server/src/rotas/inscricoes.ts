/** E7 criar rascunho · E8 buscar. */
import { Router } from "express";
import { autor, exigeAuth, exigirData, exigirTexto, limparCpf } from "../auth.ts";
import { auditar } from "../auditoria.ts";
import { sql, transacao } from "../db.ts";
import { ErroHttp, ok, rota } from "../http.ts";
import { exigirDono, montarInscricao } from "../inscricao.ts";
import { recalcularSituacoes } from "../criterios.ts";
import { GRUPAMENTOS, MAX_OPCOES, TURNOS, type Grupamento, type Turno } from "../contracts.gen.ts";

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

/** Rascunho pode ser editado; enviada, não. */
async function exigirRascunho(inscricaoId: string): Promise<{ grupamento: string; turno: string }> {
  const [i] = await sql<{ situacao: string; grupamento: string; turno: string }>(
    `select situacao, grupamento, turno from inscricao where id = $1`,
    [inscricaoId],
  );
  if (!i) throw new ErroHttp("NAO_ENCONTRADO", "Inscrição não encontrada.");
  if (i.situacao !== "rascunho")
    throw new ErroHttp("INSCRICAO_JA_ENVIADA", "Esta inscrição já foi enviada e não pode mais ser alterada.");
  return { grupamento: i.grupamento, turno: i.turno };
}

// ── E9 ────────────────────────────────────────────────────────────────
// Substitui as opções INTEIRAS. A ordem do array é a ordem de preferência, e ela
// é vinculante (R1): o sistema aloca na melhor opção possível e libera as demais
// na mesma rodada. É o que acaba com o bloqueio de 5 vagas por CPF (G1).
inscricoes.put(
  "/inscricoes/:id/opcoes",
  exigeAuth,
  rota(async (req, res) => {
    const id = String(req.params.id);
    await exigirDono(id, autor(req));
    const { grupamento, turno } = await exigirRascunho(id);

    const ofertaIds: unknown = req.body?.oferta_ids;
    if (!Array.isArray(ofertaIds))
      throw new ErroHttp("VALIDACAO", "Envie a lista `oferta_ids`.", "oferta_ids");
    if (ofertaIds.length > MAX_OPCOES)
      throw new ErroHttp("LIMITE_OPCOES", `Você pode escolher no máximo ${MAX_OPCOES} creches.`, "oferta_ids");

    const ids = ofertaIds.map((v) => String(v));
    if (new Set(ids).size !== ids.length)
      throw new ErroHttp("VALIDACAO", "Você escolheu a mesma creche duas vezes.", "oferta_ids");

    if (ids.length > 0) {
      // As ofertas precisam existir E bater com o grupamento/turno da inscrição:
      // a criança concorre a um grupamento só.
      const achadas = await sql<{ id: string; grupamento: string; turno: string }>(
        `select id, grupamento, turno from oferta where id = any($1::uuid[])`,
        [ids],
      );
      if (achadas.length !== ids.length)
        throw new ErroHttp("NAO_ENCONTRADO", "Alguma das creches escolhidas não existe mais.", "oferta_ids");
      const divergente = achadas.find((o) => o.grupamento !== grupamento || o.turno !== turno);
      if (divergente)
        throw new ErroHttp(
          "VALIDACAO",
          `Todas as opções precisam ser de ${grupamento} em turno ${turno}.`,
          "oferta_ids",
        );
    }

    await transacao(async (q) => {
      await q(`delete from opcao where inscricao_id = $1`, [id]);
      for (const [i, ofertaId] of ids.entries()) {
        await q(`insert into opcao (inscricao_id, ordem, oferta_id) values ($1,$2,$3)`, [id, i + 1, ofertaId]);
      }
      await auditar("inscricao", id, "opcoes_alteradas", autor(req), null, { oferta_ids: ids }, q);
    });

    return ok(res, await montarInscricao(id));
  }),
);

// ── E10 ───────────────────────────────────────────────────────────────
// Substitui as declarações INTEIRAS e dispara o cruzamento automático (RF2.2).
// Critério confirmado por base dispensa upload; o resto precisa de documento (RF2.4).
inscricoes.put(
  "/inscricoes/:id/criterios",
  exigeAuth,
  rota(async (req, res) => {
    const id = String(req.params.id);
    await exigirDono(id, autor(req));
    await exigirRascunho(id);

    const declarados: unknown = req.body?.declarados;
    if (!Array.isArray(declarados))
      throw new ErroHttp("VALIDACAO", "Envie a lista `declarados`.", "declarados");
    const marcados = new Set(declarados.map((v) => String(v)));

    const criterios = await sql<{ id: string }>(
      `select c.id from criterio c join inscricao i on i.processo_ano = c.processo_ano where i.id = $1`,
      [id],
    );
    const validos = new Set(criterios.map((c) => c.id));
    const invalido = [...marcados].find((c) => !validos.has(c));
    if (invalido) throw new ErroHttp("NAO_ENCONTRADO", "Critério inexistente na régua deste processo.", "declarados");

    await transacao(async (q) => {
      for (const c of criterios) {
        // Não apagamos a linha de quem desmarcou: o documento já anexado fica
        // preservado, e remarcar o critério não faz a família fotografar de novo.
        await q(
          `insert into resposta_criterio (inscricao_id, criterio_id, declarado, situacao)
           values ($1,$2,$3,'nao_declarado')
           on conflict (inscricao_id, criterio_id) do update set declarado = excluded.declarado`,
          [id, c.id, marcados.has(c.id)],
        );
      }
      await recalcularSituacoes(id, q);
      await auditar("inscricao", id, "criterios_declarados", autor(req), null, { declarados: [...marcados] }, q);
    });

    return ok(res, await montarInscricao(id));
  }),
);
