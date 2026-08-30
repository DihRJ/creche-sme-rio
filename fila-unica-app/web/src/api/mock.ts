/**
 * Mock da API, para o front nao esperar o back (regra 4 do README).
 *
 * O dado NAO e inventado: unidades e regua saem de `server/dados/`, que e a base
 * real da SME. O que e simulado esta marcado como tal:
 *
 *  - `historico` de cada oferta traz os numeros da UNIDADE INTEIRA no processo de
 *    2025, nao da combinacao grupamento x turno. E o que a base publica sustenta;
 *    quebrar por turma seria inventar serie. A tela rotula isso.
 *  - `nota_de_corte` fica nula: o export publico nao tem nota de corte por unidade.
 *  - `e_desempate` fica falso em todos: `regua.json` nao exporta `perg_criterio`.
 *    O servidor real le da tabela `criterio`.
 *  - o cruzamento automatico (RF2.2) usa a MESMA funcao deterministica que o
 *    `server/src/mock-cruzamento.ts` do Dev A, para mock e API concordarem.
 */
import type {
  CodigoErro, Criterio, Crianca, CorpoCadastro, CorpoContatos, CorpoCriterios, CorpoLogin,
  CorpoNovaInscricao, CorpoOpcoes, Grupamento, Inscricao, Me, Oferta, PaginaOfertas, Processo,
  RespostaCriterio, Resultado, Sessao, SituacaoCriterio, Turno, Unidade,
} from "../contracts.gen";
import { MAX_OPCOES } from "../contracts.gen";
import { ErroDaApi, type Opcoes } from "./client";
import brutas from "./fixtures-unidades.json";
import criteriosBrutos from "./fixtures-criterios.json";

/* ────────────────────────────  catalogo  ──────────────────────────── */

type UnidadeBruta = {
  codigo: string; nome: string; tipo: string | null; bairro: string; cre: number | null;
  lat: number | null; lng: number | null;
  fila: number; matriculou: number; ociosas: number; turmas: number;
};

const GRUPAMENTOS_MOCK: Grupamento[] = ["BERCARIO", "MATERNAL I", "MATERNAL II"];

/** Hash estavel: a mesma entrada da sempre a mesma saida, entao a demo repete igual. */
function hash(s: string): number {
  return [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
}

const UNIDADES: UnidadeBruta[] = brutas as UnidadeBruta[];

const OFERTAS: Oferta[] = UNIDADES.flatMap((u) => {
  const unidade: Unidade = {
    codigo: u.codigo, nome: u.nome, tipo: u.tipo, bairro: u.bairro,
    cre: u.cre, lat: u.lat, lng: u.lng,
  };
  // Parcial nao existe em toda unidade. Deterministico pelo codigo.
  const turnos: Turno[] = hash(u.codigo) % 3 === 0 ? ["Integral"] : ["Integral", "Parcial"];
  const combinacoes = GRUPAMENTOS_MOCK.length * turnos.length;
  return GRUPAMENTOS_MOCK.flatMap((grupamento) =>
    turnos.map((turno): Oferta => ({
      id: `${u.codigo}|${grupamento}|${turno}`,
      unidade,
      grupamento,
      turno,
      vagas_no_processo: Math.max(1, Math.round((u.turmas * 25) / combinacoes)),
      historico: [{
        processo_ano: 2025,
        vagas: u.turmas * 25,
        fila: u.fila,
        matriculou: u.matriculou,
        ociosas: u.ociosas,
        nota_de_corte: null,
      }],
    })),
  );
});

const POR_ID = new Map(OFERTAS.map((o) => [o.id, o]));

/** Confirmacao pela base sem documento (RF2.2). Taxa = a meta do PRD, nao os 6,8% de hoje. */
const TAXA_BASE: Record<number, number> = { 28: 88, 6: 85, 29: 70 };

const CRITERIOS: Criterio[] = (criteriosBrutos as { codigo: number; texto: string; pontos: number }[])
  .map((c) => ({
    id: `crit-${c.codigo}`,
    codigo: c.codigo,
    texto: c.texto,
    pontos: c.pontos,
    e_desempate: false,
    exige_documento: !(c.codigo in TAXA_BASE),
  }));

function confirmadoPelaBase(cpf: string, codigo: number): boolean {
  const taxa = TAXA_BASE[codigo] ?? 0;
  return hash(`${cpf}:${codigo}`) % 100 < taxa;
}

const PROCESSO: Processo = {
  ano: 2026,
  situacao: "inscricoes abertas",
  max_opcoes: MAX_OPCOES,
  fases: [
    { tipo: "inscricao", titulo: "Inscricao", inicio: "2026-09-01", fim: "2026-09-30", situacao: "atual" },
    { tipo: "rodada_1", titulo: "1a rodada de alocacao", inicio: "2026-10-05", fim: "2026-10-08", situacao: "futura" },
    { tipo: "rodada_2", titulo: "2a rodada de alocacao", inicio: "2026-10-19", fim: "2026-10-22", situacao: "futura" },
    { tipo: "remanescentes", titulo: "Vagas remanescentes", inicio: "2026-11-03", fim: "2026-11-10", situacao: "futura" },
    { tipo: "matricula", titulo: "Matricula na unidade", inicio: "2026-11-16", fim: "2026-12-04", situacao: "futura" },
  ],
};

/* ────────────────────────────  estado  ──────────────────────────── */

type Conta = { senha_nascimento: string; sessao: Sessao; criancas: Crianca[] };
type Documento = { id: string; nome_arquivo: string; mime: string; tamanho: number; enviado_em: string };
type Rascunho = {
  inscricao: Inscricao;
  cpf_responsavel: string;
  declarados: Set<string>;
  documentos: Map<string, Documento>;
};

type Estado = { contas: Record<string, Conta>; inscricoes: Record<string, Rascunho> };

/** Set e Map nao sobrevivem ao JSON, entao viram array na serializacao. */
type RascunhoSerializado = Omit<Rascunho, "declarados" | "documentos"> & {
  declarados: string[];
  documentos: [string, Documento][];
};

const CHAVE = "fila-unica.mock";

function carregar(): Estado {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return { contas: {}, inscricoes: {} };
    const p = JSON.parse(cru) as {
      contas?: Record<string, Conta>;
      inscricoes?: Record<string, RascunhoSerializado>;
    };
    const inscricoes: Record<string, Rascunho> = {};
    for (const [id, r] of Object.entries(p.inscricoes ?? {})) {
      inscricoes[id] = { ...r, declarados: new Set(r.declarados), documentos: new Map(r.documentos) };
    }
    return { contas: p.contas ?? {}, inscricoes };
  } catch {
    return { contas: {}, inscricoes: {} };
  }
}

const estado: Estado = carregar();

function salvar() {
  const inscricoes = Object.fromEntries(
    Object.entries(estado.inscricoes).map(([id, r]) => [id, {
      ...r, declarados: [...r.declarados], documentos: [...r.documentos],
    }]),
  );
  localStorage.setItem(CHAVE, JSON.stringify({ contas: estado.contas, inscricoes }));
}

const so_digitos = (s: string) => s.replace(/\D/g, "");
const uid = () => Math.random().toString(36).slice(2, 10);

function erro(codigo: CodigoErro, mensagem: string, campo?: string): never {
  throw new ErroDaApi({ codigo, mensagem, campo });
}

/* ────────────────────────────  regras  ──────────────────────────── */

/**
 * ATENCAO, DEV C: quem manda na tela e `situacao`, nao `exige_documento`.
 *
 * `exige_documento: false` quer dizer "a base PODE confirmar sozinha", e nao "esta
 * familia nunca precisa de documento". O cruzamento confirma 88% dos CadUnico, nao
 * 100%; nos outros 12% o critério cai para exigencia de documento, que e o modo
 * degradado que o AD-13 do PLANO manda declarar em vez de virar "nao pontua" silencioso.
 *
 * Ou seja: ofereca o envio de comprovante sempre que `situacao === "nao_comprovado"`,
 * mesmo em critério com `exige_documento: false`. Senao a familia fica sem saida.
 */
function situacaoDo(r: Rascunho, c: Criterio): SituacaoCriterio {
  if (!r.declarados.has(c.id)) return "nao_declarado";
  if (!c.exige_documento && confirmadoPelaBase(r.cpf_responsavel, c.codigo)) return "confirmado_base";
  if (r.documentos.has(c.id)) return "documento_pendente";
  return "nao_comprovado";
}

function respostas(r: Rascunho): RespostaCriterio[] {
  return CRITERIOS.map((c) => {
    const situacao = situacaoDo(r, c);
    const conta = situacao === "confirmado_base" || situacao === "documento_pendente";
    const doc = r.documentos.get(c.id) ?? null;
    return {
      criterio_id: c.id,
      declarado: r.declarados.has(c.id),
      situacao,
      pontos_se_valer: c.pontos,
      pontos_que_contam: conta ? c.pontos : 0,
      documento: doc,
    };
  });
}

function pendencias(r: Rascunho, resps: RespostaCriterio[]): string[] {
  const p: string[] = [];
  if (r.inscricao.opcoes.length === 0) {
    p.push("Escolha ao menos uma creche antes de finalizar.");
  }
  const perdidos = resps.filter((x) => x.situacao === "nao_comprovado");
  if (perdidos.length > 0) {
    const pontos = perdidos.reduce((s, x) => s + x.pontos_se_valer, 0);
    p.push(
      `${perdidos.length === 1 ? "1 critério declarado está" : `${perdidos.length} critérios declarados estão`}` +
      ` sem comprovante e não vão pontuar. São ${pontos} pontos a menos na classificação. ` +
      `Você ainda pode enviar o comprovante e finalizar depois.`,
    );
  }
  return p;
}

/** Recalcula tudo que e derivado. O contrato manda devolver a Inscricao inteira. */
function montar(r: Rascunho): Inscricao {
  const resps = respostas(r);
  r.inscricao.respostas = resps;
  r.inscricao.pontuacao = {
    pontos_que_contam: resps.reduce((s, x) => s + x.pontos_que_contam, 0),
    pontos_declarados: resps.reduce((s, x) => s + (x.declarado ? x.pontos_se_valer : 0), 0),
    desempates: 0,
  };
  r.inscricao.pendencias = pendencias(r, resps);
  salvar();
  return structuredClone(r.inscricao);
}

function sessaoAtual(): Conta {
  const jwt = localStorage.getItem("fila-unica.token");
  const conta = jwt ? Object.values(estado.contas).find((c) => c.sessao.token === jwt) : undefined;
  if (!conta) erro("NAO_AUTENTICADO", "Entre para continuar.");
  return conta;
}

function minhaInscricao(id: string): Rascunho {
  const r = estado.inscricoes[id];
  if (!r) erro("NAO_ENCONTRADO", "Inscricao nao encontrada.");
  if (r.cpf_responsavel !== sessaoAtual().sessao.responsavel.cpf) {
    erro("SEM_PERMISSAO", "Esta inscricao e de outro responsavel.");
  }
  return r;
}

/* ────────────────────────────  roteador  ──────────────────────────── */

function ofertas(qs: URLSearchParams): PaginaOfertas {
  const busca = (qs.get("busca") ?? "").trim().toLowerCase();
  const bairro = (qs.get("bairro") ?? "").trim().toLowerCase();
  const cre = qs.get("cre");
  const grupamento = qs.get("grupamento");
  const turno = qs.get("turno");
  const pagina = Math.max(1, Number(qs.get("pagina") ?? 1));
  const POR_PAGINA = 12;

  let itens = OFERTAS;
  if (grupamento) itens = itens.filter((o) => o.grupamento === grupamento);
  if (turno) itens = itens.filter((o) => o.turno === turno);
  if (cre) itens = itens.filter((o) => String(o.unidade.cre) === cre);
  if (bairro) itens = itens.filter((o) => (o.unidade.bairro ?? "").toLowerCase() === bairro);
  if (busca) {
    itens = itens.filter(
      (o) => o.unidade.nome.toLowerCase().includes(busca) ||
        (o.unidade.bairro ?? "").toLowerCase().includes(busca),
    );
  }
  // Maior fila primeiro: e a informacao que o G3 diz que falta pra familia.
  itens = [...itens].sort((a, b) => (b.historico[0]?.fila ?? 0) - (a.historico[0]?.fila ?? 0));

  return {
    itens: itens.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    total: itens.length,
    pagina,
    por_pagina: POR_PAGINA,
  };
}

function novaInscricao(corpo: CorpoNovaInscricao, conta: Conta): Inscricao {
  const cpf = so_digitos(corpo.crianca.cpf);
  const jaTem = Object.values(estado.inscricoes).some((r) => so_digitos(r.inscricao.crianca.cpf) === cpf);
  if (jaTem) {
    erro("CPF_JA_INSCRITO", "Esta crianca ja tem uma inscricao ativa neste processo.", "cpf");
  }
  const id = uid();
  const crianca: Crianca = { id: uid(), ...corpo.crianca, cpf };
  const r: Rascunho = {
    cpf_responsavel: conta.sessao.responsavel.cpf,
    declarados: new Set(),
    documentos: new Map(),
    inscricao: {
      id, processo_ano: PROCESSO.ano, situacao: "rascunho", crianca,
      grupamento: corpo.grupamento, turno: corpo.turno,
      opcoes: [], respostas: [],
      pontuacao: { pontos_que_contam: 0, pontos_declarados: 0, desempates: 0 },
      numero_sorteio: null, enviada_em: null, pendencias: [],
    },
  };
  estado.inscricoes[id] = r;
  conta.criancas.push(crianca);
  return montar(r);
}

async function resolver<T>(rota: string, opts: Opcoes): Promise<T> {
  const [caminho, query = ""] = rota.split("?");
  const qs = new URLSearchParams(query);
  const partes = caminho.split("/").filter(Boolean);
  const metodo = opts.metodo ?? (opts.corpo !== undefined || opts.arquivo ? "POST" : "GET");
  const chave = `${metodo} /${partes.join("/")}`;

  // rotas publicas
  if (chave === "GET /saude") return { ok: true, versao: "mock", banco: "ok" } as T;
  if (chave === "GET /processo") return PROCESSO as T;
  if (chave === "GET /criterios") return CRITERIOS as T;
  if (chave === "GET /ofertas") return ofertas(qs) as T;

  if (chave === "POST /auth/cadastro") {
    const c = opts.corpo as CorpoCadastro;
    const cpf = so_digitos(c.cpf);
    if (cpf.length !== 11) erro("VALIDACAO", "CPF deve ter 11 digitos.", "cpf");
    if (estado.contas[cpf]) erro("VALIDACAO", "Ja existe conta com este CPF. Entre em vez de cadastrar.", "cpf");
    const sessao: Sessao = {
      token: `mock.${cpf}.${uid()}`,
      responsavel: {
        id: uid(), nome: c.nome, cpf, nascimento: c.nascimento,
        contatos: [
          { id: uid(), canal: "telefone_principal", valor: c.telefone, versao: 1, atualizado_em: new Date().toISOString() },
          { id: uid(), canal: "email", valor: c.email, versao: 1, atualizado_em: new Date().toISOString() },
        ],
      },
    };
    estado.contas[cpf] = { senha_nascimento: c.nascimento, sessao, criancas: [] };
    salvar();
    return sessao as T;
  }

  if (chave === "POST /auth/login") {
    const c = opts.corpo as CorpoLogin;
    const conta = estado.contas[so_digitos(c.cpf)];
    if (!conta || conta.senha_nascimento !== c.nascimento) {
      erro("VALIDACAO", "CPF ou data de nascimento nao conferem.", "cpf");
    }
    conta.sessao.token = `mock.${so_digitos(c.cpf)}.${uid()}`;
    salvar();
    return conta.sessao as T;
  }

  // daqui pra baixo, autenticado
  const conta = sessaoAtual();

  if (chave === "GET /me") {
    const me: Me = {
      responsavel: conta.sessao.responsavel,
      criancas: conta.criancas,
      inscricoes: Object.values(estado.inscricoes)
        .filter((r) => r.cpf_responsavel === conta.sessao.responsavel.cpf)
        .map((r) => ({
          id: r.inscricao.id, situacao: r.inscricao.situacao,
          crianca: r.inscricao.crianca, processo_ano: r.inscricao.processo_ano,
        })),
    };
    return me as T;
  }

  if (chave === "PUT /me/contatos") {
    for (const novo of (opts.corpo as CorpoContatos).contatos) {
      const versoes = conta.sessao.responsavel.contatos.filter((x) => x.canal === novo.canal);
      // versiona, nunca sobrescreve (RF1.5)
      conta.sessao.responsavel.contatos.push({
        id: uid(), canal: novo.canal, valor: novo.valor,
        versao: versoes.length + 1, atualizado_em: new Date().toISOString(),
      });
    }
    salvar();
    return conta.sessao.responsavel as T;
  }

  if (chave === "POST /inscricoes") return novaInscricao(opts.corpo as CorpoNovaInscricao, conta) as T;

  const id = partes[1];

  if (chave === `GET /inscricoes/${id}`) return montar(minhaInscricao(id)) as T;

  if (chave === `PUT /inscricoes/${id}/opcoes`) {
    const r = minhaInscricao(id);
    if (r.inscricao.situacao !== "rascunho") erro("INSCRICAO_JA_ENVIADA", "Inscricao ja enviada.");
    const ids = (opts.corpo as CorpoOpcoes).oferta_ids;
    if (ids.length > MAX_OPCOES) erro("LIMITE_OPCOES", `Sao no maximo ${MAX_OPCOES} opcoes.`);
    if (new Set(ids).size !== ids.length) erro("VALIDACAO", "Ha oferta repetida na lista.");
    const escolhidas = ids.map((oid) => {
      const o = POR_ID.get(oid);
      if (!o) erro("NAO_ENCONTRADO", `Oferta ${oid} nao existe.`);
      if (o.grupamento !== r.inscricao.grupamento || o.turno !== r.inscricao.turno) {
        erro("VALIDACAO", "A oferta e de outro grupamento ou turno.");
      }
      return o;
    });
    r.inscricao.opcoes = escolhidas.map((oferta, i) => ({ ordem: i + 1, oferta }));
    return montar(r) as T;
  }

  if (chave === `PUT /inscricoes/${id}/criterios`) {
    const r = minhaInscricao(id);
    if (r.inscricao.situacao !== "rascunho") erro("INSCRICAO_JA_ENVIADA", "Inscricao ja enviada.");
    r.declarados = new Set((opts.corpo as CorpoCriterios).declarados);
    for (const cid of [...r.documentos.keys()]) if (!r.declarados.has(cid)) r.documentos.delete(cid);
    return montar(r) as T;
  }

  if (metodo === "POST" && partes[2] === "criterios" && partes[4] === "documento") {
    const r = minhaInscricao(id);
    const criterioId = partes[3];
    const arq = opts.arquivo;
    if (!arq) erro("ARQUIVO_INVALIDO", "Nenhum arquivo recebido.");
    if (arq.size > 5 * 1024 * 1024) erro("ARQUIVO_INVALIDO", "O arquivo passa de 5 MB.");
    r.documentos.set(criterioId, {
      id: `doc-${criterioId}`, nome_arquivo: arq.name, mime: arq.type,
      tamanho: arq.size, enviado_em: new Date().toISOString(),
    });
    montar(r);
    return respostas(r).find((x) => x.criterio_id === criterioId) as T;
  }

  if (metodo === "DELETE" && partes[0] === "documentos") {
    const docId = partes[1];
    for (const r of Object.values(estado.inscricoes)) {
      for (const [cid, d] of r.documentos) {
        if (d.id === docId) {
          r.documentos.delete(cid);
          montar(r);
          return respostas(r).find((x) => x.criterio_id === cid) as T;
        }
      }
    }
    erro("NAO_ENCONTRADO", "Documento nao encontrado.");
  }

  if (chave === `POST /inscricoes/${id}/finalizar`) {
    const r = minhaInscricao(id);
    if (r.inscricao.situacao !== "rascunho") erro("INSCRICAO_JA_ENVIADA", "Esta inscricao ja foi enviada.");
    if (r.inscricao.opcoes.length === 0) erro("VALIDACAO", "Escolha ao menos uma creche.");
    r.inscricao.situacao = "enviada";
    r.inscricao.enviada_em = new Date().toISOString();
    // no servidor real e HMAC-SHA256(SEMENTE_PROCESSO, inscricao_id); aqui basta ser estavel
    r.inscricao.numero_sorteio = hash(`fila-unica-2026:${id}`).toString(16).padStart(8, "0").slice(0, 8);
    return montar(r) as T;
  }

  if (chave === `GET /inscricoes/${id}/resultado`) {
    const r = minhaInscricao(id);
    const res: Resultado = {
      alocada: false, oferta: null, posicao_preferencia: null,
      explicacao: "A classificacao deste processo ainda nao foi executada. Esta tela e do Dev C e o resultado real vem do E15.",
      origem_explicacao: "molde",
      detalhe_opcoes: r.inscricao.opcoes.map((o) => ({
        ordem: o.ordem, unidade: o.oferta.unidade.nome,
        capacidade: o.oferta.vagas_no_processo, candidatos: o.oferta.historico[0]?.fila ?? 0,
        nota_de_corte: null, sua_pontuacao: r.inscricao.pontuacao.pontos_que_contam, conseguiu: false,
      })),
    };
    return res as T;
  }

  erro("NAO_ENCONTRADO", `Rota nao implementada no mock: ${chave}`);
}

export async function chamarMock<T>(rota: string, opts: Opcoes): Promise<T> {
  // latencia curta de proposito: revela estado de carregamento que sem ela passa batido
  await new Promise((r) => setTimeout(r, 120));
  return resolver<T>(rota, opts);
}

export async function blobMock(): Promise<Blob> {
  return new Blob(["comprovante de demonstracao"], { type: "text/plain" });
}

/** Bairros com unidade no catalogo, para o filtro da tela de escolha. */
export const BAIRROS_MOCK = [...new Set(UNIDADES.map((u) => u.bairro))].sort((a, b) =>
  a.localeCompare(b, "pt-BR"),
);
