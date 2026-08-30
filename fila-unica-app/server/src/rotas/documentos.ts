/**
 * E11 anexar · E12 remover · E13 baixar — a etapa de comprovação.
 *
 * Muda o rito do processo atual (R3): hoje a família leva o documento à unidade no
 * dia seguinte à inscrição, antes da classificação, e é essa barreira que derruba a
 * validação a 6,8%. Aqui o documento sobe no ato da inscrição, pelo aplicativo, e é
 * conferido no ato da matrícula (RF2.5).
 *
 * O arquivo vai para coluna `bytea`. É atalho de MVP declarado: o disco do Render é
 * efêmero, e guardar no banco elimina bucket e credencial. Em produção é object
 * storage com URL assinada, varredura de malware e expurgo (PLANO.md AD-18).
 */
import { Router } from "express";
import multer from "multer";
import { autor, exigeAuth } from "../auth.ts";
import { auditar } from "../auditoria.ts";
import { recalcularSituacoes } from "../criterios.ts";
import { sql, transacao } from "../db.ts";
import { ErroHttp, ok, rota } from "../http.ts";
import { exigirDono, montarInscricao } from "../inscricao.ts";
import { MAX_ARQUIVO_BYTES, MIMES_ACEITOS, type RespostaCriterio } from "../contracts.gen.ts";

export const documentos = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARQUIVO_BYTES, files: 1 },
});

/** Traduz o erro do multer para o envelope do contrato. */
const receberArquivo = (req: never, res: never, next: (e?: unknown) => void) =>
  upload.single("arquivo")(req, res, (e: unknown) => {
    if (e && typeof e === "object" && "code" in e) {
      const codigo = (e as { code: string }).code;
      if (codigo === "LIMIT_FILE_SIZE")
        return next(
          new ErroHttp("ARQUIVO_INVALIDO", `O arquivo passa de ${MAX_ARQUIVO_BYTES / 1024 / 1024} MB.`, "arquivo"),
        );
      return next(new ErroHttp("ARQUIVO_INVALIDO", "Não consegui ler o arquivo enviado.", "arquivo"));
    }
    return next(e);
  });

/** Devolve a resposta_criterio já atualizada, no formato do contrato. */
async function respostaAtual(inscricaoId: string, criterioId: string): Promise<RespostaCriterio> {
  const inscricao = await montarInscricao(inscricaoId);
  const r = inscricao.respostas.find((x) => x.criterio_id === criterioId);
  if (!r) throw new ErroHttp("NAO_ENCONTRADO", "Critério não encontrado nesta inscrição.");
  return r;
}

// ── E11 ───────────────────────────────────────────────────────────────
documentos.post(
  "/inscricoes/:id/criterios/:criterioId/documento",
  exigeAuth,
  receberArquivo as never,
  rota(async (req, res) => {
    const inscricaoId = String(req.params.id);
    const criterioId = String(req.params.criterioId);
    const responsavelId = autor(req);
    await exigirDono(inscricaoId, responsavelId);

    const arquivo = (req as { file?: Express.Multer.File }).file;
    if (!arquivo) throw new ErroHttp("ARQUIVO_INVALIDO", "Envie um arquivo no campo `arquivo`.", "arquivo");
    if (!MIMES_ACEITOS.includes(arquivo.mimetype))
      throw new ErroHttp(
        "ARQUIVO_INVALIDO",
        "Envie uma foto (JPG, PNG ou WEBP) ou um PDF.",
        "arquivo",
      );

    const [criterio] = await sql<{ id: string }>(
      `select c.id from criterio c join inscricao i on i.processo_ano = c.processo_ano
        where c.id = $1 and i.id = $2`,
      [criterioId, inscricaoId],
    );
    if (!criterio) throw new ErroHttp("NAO_ENCONTRADO", "Critério inexistente na régua deste processo.");

    await transacao(async (q) => {
      // Anexar documento é declarar o critério: não faz sentido a família
      // fotografar o comprovante de algo que ela não está reivindicando.
      const [resposta] = await q<{ id: string }>(
        `insert into resposta_criterio (inscricao_id, criterio_id, declarado, situacao)
         values ($1,$2,true,'nao_declarado')
         on conflict (inscricao_id, criterio_id) do update set declarado = true
         returning id`,
        [inscricaoId, criterioId],
      );
      // Um documento por critério: reenviar substitui, não acumula.
      await q(`delete from documento where resposta_criterio_id = $1`, [resposta.id]);
      await q(
        `insert into documento (resposta_criterio_id, nome_arquivo, mime, tamanho, conteudo)
         values ($1,$2,$3,$4,$5)`,
        [resposta.id, arquivo.originalname, arquivo.mimetype, arquivo.size, arquivo.buffer],
      );
      await recalcularSituacoes(inscricaoId, q);
      await auditar("documento", resposta.id, "anexado", responsavelId, null,
        { nome: arquivo.originalname, mime: arquivo.mimetype, tamanho: arquivo.size }, q);
    });

    return ok(res, await respostaAtual(inscricaoId, criterioId));
  }),
);

// ── E12 ───────────────────────────────────────────────────────────────
documentos.delete(
  "/documentos/:id",
  exigeAuth,
  rota(async (req, res) => {
    const documentoId = String(req.params.id);
    const responsavelId = autor(req);
    const [d] = await sql<{ inscricao_id: string; criterio_id: string; resposta_id: string }>(
      `select r.inscricao_id, r.criterio_id, r.id resposta_id
         from documento d join resposta_criterio r on r.id = d.resposta_criterio_id
        where d.id = $1`,
      [documentoId],
    );
    if (!d) throw new ErroHttp("NAO_ENCONTRADO", "Documento não encontrado.");
    await exigirDono(d.inscricao_id, responsavelId);

    await transacao(async (q) => {
      await q(`delete from documento where id = $1`, [documentoId]);
      // Sem o documento o critério perde o lastro e volta a não pontuar (RF2.4).
      await recalcularSituacoes(d.inscricao_id, q);
      await auditar("documento", d.resposta_id, "removido", responsavelId, { documento_id: documentoId }, null, q);
    });

    return ok(res, await respostaAtual(d.inscricao_id, d.criterio_id));
  }),
);

// ── E13 ───────────────────────────────────────────────────────────────
// Autenticado: comprovante de vulnerabilidade é o dado mais sensível do sistema.
documentos.get(
  "/documentos/:id",
  exigeAuth,
  rota(async (req, res) => {
    const documentoId = String(req.params.id);
    const [d] = await sql<{
      inscricao_id: string; nome_arquivo: string; mime: string; conteudo: Buffer;
    }>(
      `select r.inscricao_id, d.nome_arquivo, d.mime, d.conteudo
         from documento d join resposta_criterio r on r.id = d.resposta_criterio_id
        where d.id = $1`,
      [documentoId],
    );
    if (!d) throw new ErroHttp("NAO_ENCONTRADO", "Documento não encontrado.");
    await exigirDono(d.inscricao_id, autor(req));

    await auditar("documento", documentoId, "acessado", autor(req), null, null);
    res.setHeader("content-type", d.mime);
    res.setHeader("content-disposition", `inline; filename="${encodeURIComponent(d.nome_arquivo)}"`);
    // Dado pessoal de criança: nunca em cache compartilhado.
    res.setHeader("cache-control", "private, no-store");
    return res.send(d.conteudo);
  }),
);
