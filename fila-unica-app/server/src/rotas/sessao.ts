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

// ── E16 ───────────────────────────────────────────────────────────────
// RF1.5: o contato é editável pela família a qualquer momento, sem ida à unidade
// e sem reabrir a inscrição.
//
// É o gargalo G4, e é o mais barato de consertar de todos: 5.994 crianças foram
// convocadas e não matriculadas em 2025, cerca de 44 mil de 2021 a 2025. Sem
// contato válido não há convocação — o diretor anota o telefone novo no caderno
// porque o sistema não deixa editar, e a vaga se perde.
//
// Nunca faz UPDATE: cada correção desativa a versão anterior e insere uma nova.
// Toda alteração fica versionada com data e origem, como o requisito exige.
sessao.put(
  "/me/contatos",
  exigeAuth,
  rota(async (req, res) => {
    const id = autor(req);
    const entrada: unknown = req.body?.contatos;
    if (!Array.isArray(entrada) || entrada.length === 0)
      throw new ErroHttp("VALIDACAO", "Envie a lista `contatos`.", "contatos");

    const canaisValidos: CanalContato[] = ["telefone_principal", "telefone_alternativo", "email"];
    const pedidos = entrada.map((c) => {
      const canal = String((c as { canal?: unknown })?.canal ?? "") as CanalContato;
      if (!canaisValidos.includes(canal))
        throw new ErroHttp("VALIDACAO", `Canal inválido. Use um de: ${canaisValidos.join(", ")}.`, "canal");
      const valor = String((c as { valor?: unknown })?.valor ?? "").trim();
      if (!valor) throw new ErroHttp("VALIDACAO", "O contato não pode ficar em branco.", canal);
      if (canal === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor))
        throw new ErroHttp("VALIDACAO", "E-mail inválido.", canal);
      if (canal !== "email" && valor.replace(/\D/g, "").length < 10)
        throw new ErroHttp("VALIDACAO", "Telefone deve ter DDD e número.", canal);
      return { canal, valor };
    });
    if (new Set(pedidos.map((p) => p.canal)).size !== pedidos.length)
      throw new ErroHttp("VALIDACAO", "Você enviou o mesmo canal duas vezes.", "contatos");

    await transacao(async (q) => {
      for (const { canal, valor } of pedidos) {
        const [atual] = await q<{ id: string; valor: string; versao: number }>(
          `select id, valor, versao from contato where responsavel_id = $1 and canal = $2 and ativo`,
          [id, canal],
        );
        // Valor igual não gera versão nova: histórico de contato serve para
        // reconstituir mudança, não para registrar que a família reenviou o form.
        if (atual?.valor === valor) continue;
        if (atual) await q(`update contato set ativo = false where id = $1`, [atual.id]);
        await q(
          `insert into contato (responsavel_id, canal, valor, versao) values ($1,$2,$3,$4)`,
          [id, canal, valor, (atual?.versao ?? 0) + 1],
        );
        await auditar("contato", id, "contato_alterado", id,
          atual ? { canal, valor: atual.valor, versao: atual.versao } : null,
          { canal, valor, versao: (atual?.versao ?? 0) + 1 }, q);
      }
    });

    return ok(res, await carregarResponsavel(id));
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
