/** E1 cadastro · E2 login · E3 /me. */
import { Router } from "express";
import { assinar, autor, exigeAuth, exigirData, exigirTexto, limparCpf } from "../auth.ts";
import { auditar } from "../auditoria.ts";
import { sql, transacao } from "../db.ts";
import { ErroHttp, ok, rota } from "../http.ts";
import type { CanalContato, Contato, Me, Responsavel, Sessao } from "../contracts.gen.ts";

export const sessao = Router();

async function carregarResponsavel(id: string, consultar: typeof sql = sql): Promise<Responsavel> {
  const [r] = await consultar<{ id: string; nome: string; cpf: string; nascimento: string }>(
    `select id, nome, cpf, to_char(nascimento,'YYYY-MM-DD') nascimento from responsavel where id = $1`,
    [id],
  );
  if (!r) throw new ErroHttp("NAO_ENCONTRADO", "Responsável não encontrado.");
  const contatos = await consultar<Contato>(
    `select id, canal, valor, versao, to_char(atualizado_em,'YYYY-MM-DD"T"HH24:MI:SSOF') atualizado_em
       from contato where responsavel_id = $1 and ativo order by canal`,
    [id],
  );
  return { ...r, contatos };
}

// ── E1 ────────────────────────────────────────────────────────────────
sessao.post(
  "/auth/cadastro",
  rota(async (req, res) => {
    const cpf = limparCpf(req.body?.cpf);
    const nome = exigirTexto(req.body?.nome, "nome", "Nome");
    const nascimento = exigirData(req.body?.nascimento, "nascimento", "Data de nascimento");
    const telefone = exigirTexto(req.body?.telefone, "telefone", "Telefone");
    const email = exigirTexto(req.body?.email, "email", "E-mail");

    const [existente] = await sql<{ id: string }>(`select id from responsavel where cpf = $1`, [cpf]);
    if (existente) throw new ErroHttp("VALIDACAO", "Já existe cadastro com este CPF. Entre em vez de se cadastrar.", "cpf");

    const responsavel = await transacao(async (q) => {
      const [novo] = await q<{ id: string }>(
        `insert into responsavel (cpf, nome, nascimento) values ($1,$2,$3) returning id`,
        [cpf, nome, nascimento],
      );
      const contatos: [CanalContato, string][] = [["telefone_principal", telefone], ["email", email]];
      for (const [canal, valor] of contatos) {
        await q(`insert into contato (responsavel_id, canal, valor) values ($1,$2,$3)`, [novo.id, canal, valor]);
      }
      await auditar("responsavel", novo.id, "cadastro", novo.id, null, { cpf, nome }, q);
      return carregarResponsavel(novo.id, q);
    });

    return ok(res, { token: assinar(responsavel.id), responsavel } satisfies Sessao);
  }),
);

// ── E2 ────────────────────────────────────────────────────────────────
// Sem senha: CPF + data de nascimento. Atalho de MVP declarado (ver auth.ts).
sessao.post(
  "/auth/login",
  rota(async (req, res) => {
    const cpf = limparCpf(req.body?.cpf);
    const nascimento = exigirData(req.body?.nascimento, "nascimento", "Data de nascimento");
    const [r] = await sql<{ id: string }>(
      `select id from responsavel where cpf = $1 and nascimento = $2`,
      [cpf, nascimento],
    );
    if (!r) throw new ErroHttp("NAO_AUTENTICADO", "CPF ou data de nascimento não conferem.");
    const responsavel = await carregarResponsavel(r.id);
    return ok(res, { token: assinar(r.id), responsavel } satisfies Sessao);
  }),
);

// ── E3 ────────────────────────────────────────────────────────────────
sessao.get(
  "/me",
  exigeAuth,
  rota(async (req, res) => {
    const id = autor(req);
    const responsavel = await carregarResponsavel(id);
    const criancas = await sql<Me["criancas"][number]>(
      `select id, nome, cpf, to_char(nascimento,'YYYY-MM-DD') nascimento
         from crianca where responsavel_id = $1 order by nome`,
      [id],
    );
    const inscricoes = await sql<Me["inscricoes"][number]>(
      `select i.id, i.situacao, i.processo_ano,
              json_build_object('id', c.id, 'nome', c.nome, 'cpf', c.cpf,
                                'nascimento', to_char(c.nascimento,'YYYY-MM-DD')) crianca
         from inscricao i join crianca c on c.id = i.crianca_id
        where c.responsavel_id = $1
        order by i.data_inscricao desc`,
      [id],
    );
    return ok(res, { responsavel, criancas, inscricoes } satisfies Me);
  }),
);
