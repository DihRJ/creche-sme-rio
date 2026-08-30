/**
 * `montarInscricao` — a peça central do backend.
 *
 * Não é um endpoint: é a função que E7, E8, E9, E10 e E14 reusam. O contrato manda
 * que todo endpoint de inscrição devolva o objeto INTEIRO, para o front nunca
 * precisar remontar estado no cliente. Se esta função sair torta, cinco endpoints
 * saem tortos junto.
 */
import { sql } from "./db.ts";
import { ErroHttp } from "./http.ts";
import type {
  Inscricao, OpcaoEscolhida, RespostaCriterio, SituacaoCriterio,
} from "./contracts.gen.ts";

type LinhaOpcao = {
  ordem: number; oferta_id: string; grupamento: string; turno: string; vagas_no_processo: number;
  codigo: string; nome: string; tipo: string | null; bairro: string | null;
  cre: number | null; lat: number | null; lng: number | null;
  historico: OpcaoEscolhida["oferta"]["historico"] | null;
};

/** Confere que a inscrição existe e pertence a quem está pedindo. */
export async function exigirDono(inscricaoId: string, responsavelId: string): Promise<void> {
  const [linha] = await sql<{ dono: string }>(
    `select c.responsavel_id dono from inscricao i join crianca c on c.id = i.crianca_id where i.id = $1`,
    [inscricaoId],
  );
  if (!linha) throw new ErroHttp("NAO_ENCONTRADO", "Inscrição não encontrada.");
  if (linha.dono !== responsavelId) throw new ErroHttp("SEM_PERMISSAO", "Esta inscrição não é sua.");
}

export async function montarInscricao(inscricaoId: string): Promise<Inscricao> {
  const [base] = await sql<{
    id: string; processo_ano: number; situacao: Inscricao["situacao"];
    grupamento: Inscricao["grupamento"]; turno: Inscricao["turno"];
    numero_sorteio: string | null; enviada_em: string | null;
    crianca_id: string; crianca_nome: string; crianca_cpf: string; crianca_nascimento: string;
  }>(
    `select i.id, i.processo_ano, i.situacao, i.grupamento, i.turno, i.numero_sorteio,
            to_char(i.enviada_em, 'YYYY-MM-DD"T"HH24:MI:SSOF') enviada_em,
            c.id crianca_id, c.nome crianca_nome, c.cpf crianca_cpf,
            to_char(c.nascimento,'YYYY-MM-DD') crianca_nascimento
       from inscricao i join crianca c on c.id = i.crianca_id
      where i.id = $1`,
    [inscricaoId],
  );
  if (!base) throw new ErroHttp("NAO_ENCONTRADO", "Inscrição não encontrada.");

  // ── opções, na ordem declarada ────────────────────────────────────────
  const linhasOpcao = await sql<LinhaOpcao>(
    `select p.ordem, o.id oferta_id, o.grupamento, o.turno, o.vagas_no_processo,
            u.codigo, u.nome, u.tipo, u.bairro, u.cre, u.lat, u.lng,
            (select coalesce(json_agg(json_build_object(
                      'processo_ano', h.processo_ano, 'vagas', h.vagas, 'fila', h.fila,
                      'matriculou', h.matriculou, 'ociosas', h.ociosas,
                      'nota_de_corte', h.nota_de_corte) order by h.processo_ano desc), '[]'::json)
               from historico_unidade h where h.unidade_codigo = u.codigo) as historico
       from opcao p
       join oferta o on o.id = p.oferta_id
       join unidade u on u.codigo = o.unidade_codigo
      where p.inscricao_id = $1
      order by p.ordem`,
    [inscricaoId],
  );

  const opcoes: OpcaoEscolhida[] = linhasOpcao.map((l) => ({
    ordem: l.ordem,
    oferta: {
      id: l.oferta_id,
      grupamento: l.grupamento as OpcaoEscolhida["oferta"]["grupamento"],
      turno: l.turno as OpcaoEscolhida["oferta"]["turno"],
      vagas_no_processo: l.vagas_no_processo,
      unidade: { codigo: l.codigo, nome: l.nome, tipo: l.tipo, bairro: l.bairro, cre: l.cre, lat: l.lat, lng: l.lng },
      historico: l.historico ?? [],
    },
  }));

  // ── critérios: TODOS os 13, não só os declarados ──────────────────────
  // A tela da família é uma lista dos 13 com estado e pontos de cada (RF2.3).
  // Devolver só os declarados obrigaria o front a cruzar com GET /criterios,
  // que é trabalho duplicado e uma fonte de bug a mais.
  const linhasCriterio = await sql<{
    criterio_id: string; pontos: number; declarado: boolean | null; situacao: SituacaoCriterio | null;
    doc_id: string | null; doc_nome: string | null; doc_mime: string | null;
    doc_tamanho: number | null; doc_enviado: string | null;
  }>(
    `select c.id criterio_id, c.pontos, r.declarado, r.situacao,
            d.id doc_id, d.nome_arquivo doc_nome, d.mime doc_mime, d.tamanho doc_tamanho,
            to_char(d.enviado_em,'YYYY-MM-DD"T"HH24:MI:SSOF') doc_enviado
       from criterio c
       left join resposta_criterio r on r.criterio_id = c.id and r.inscricao_id = $1
       left join documento d on d.resposta_criterio_id = r.id
      where c.processo_ano = $2
      order by c.ordem`,
    [inscricaoId, base.processo_ano],
  );

  const respostas: RespostaCriterio[] = linhasCriterio.map((l) => {
    const situacao: SituacaoCriterio = l.situacao ?? "nao_declarado";
    // RF2.4: só pontua o que tem lastro. Declarado sem comprovação vale zero.
    const comLastro = situacao === "confirmado_base" || situacao === "documento_pendente";
    return {
      criterio_id: l.criterio_id,
      declarado: l.declarado ?? false,
      situacao,
      pontos_se_valer: l.pontos,
      pontos_que_contam: comLastro ? l.pontos : 0,
      documento: l.doc_id
        ? {
            id: l.doc_id,
            nome_arquivo: l.doc_nome!,
            mime: l.doc_mime!,
            tamanho: l.doc_tamanho!,
            enviado_em: l.doc_enviado!,
          }
        : null,
    };
  });

  const pontosQueContam = respostas.reduce((s, r) => s + r.pontos_que_contam, 0);
  // O que a família teria se tudo que ela declarou fosse comprovado. A diferença
  // entre os dois números é o argumento inteiro do projeto: hoje 93% das inscrições
  // entram com zero ponto porque a comprovação quase nunca é validada.
  const pontosDeclarados = respostas.reduce((s, r) => s + (r.declarado ? r.pontos_se_valer : 0), 0);

  return {
    id: base.id,
    processo_ano: base.processo_ano,
    situacao: base.situacao,
    crianca: {
      id: base.crianca_id,
      nome: base.crianca_nome,
      cpf: base.crianca_cpf,
      nascimento: base.crianca_nascimento,
    },
    grupamento: base.grupamento,
    turno: base.turno,
    opcoes,
    respostas,
    pontuacao: {
      pontos_que_contam: pontosQueContam,
      pontos_declarados: pontosDeclarados,
      desempates: respostas.filter((r) => r.pontos_que_contam > 0).length,
    },
    numero_sorteio: base.numero_sorteio,
    enviada_em: base.enviada_em,
    pendencias: calcularPendencias(opcoes, respostas, base.situacao),
  };
}

/**
 * O que falta para a inscrição ficar completa. Vazio = pode finalizar.
 *
 * Critério sem comprovação NÃO bloqueia o envio (RF2.4): ele só deixa de pontuar.
 * A pendência existe para avisar quantos pontos a família está deixando na mesa,
 * não para barrá-la — barrar é o que hoje derruba a validação a 6,8%.
 */
function calcularPendencias(
  opcoes: OpcaoEscolhida[],
  respostas: RespostaCriterio[],
  situacao: Inscricao["situacao"],
): string[] {
  const p: string[] = [];
  if (situacao === "rascunho" && opcoes.length === 0) {
    p.push("Escolha pelo menos uma creche antes de finalizar.");
  }
  const semLastro = respostas.filter((r) => r.declarado && r.situacao === "nao_comprovado");
  const pontosPerdidos = semLastro.reduce((s, r) => s + r.pontos_se_valer, 0);
  if (semLastro.length > 0) {
    p.push(
      `${semLastro.length === 1 ? "1 critério declarado está" : `${semLastro.length} critérios declarados estão`} ` +
        `sem comprovante e não vai${semLastro.length === 1 ? "" : "o"} pontuar. ` +
        `São ${pontosPerdidos} ponto${pontosPerdidos === 1 ? "" : "s"} que você está deixando na mesa.`,
    );
  }
  return p;
}
