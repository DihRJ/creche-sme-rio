/**
 * Fila Única — contrato entre `web` e `server`.
 *
 * FONTE DA VERDADE. Este arquivo é copiado para os dois lados por `npm run sync`
 * (vira `src/contracts.gen.ts`). Não edite as cópias.
 *
 * CONGELADO no minuto 20. Mudança depois disso: anuncie em voz alta, commite sozinho.
 */

export const VERSAO_CONTRATO = "1.0.0";

/* ────────────────────────────  envelope  ──────────────────────────── */

export type ISODate = string;      // "2026-03-15"
export type ISODateTime = string;  // ISO 8601 com fuso

export type Resposta<T> = { ok: true; data: T } | { ok: false; erro: ErroApi };

export interface ErroApi {
  codigo: CodigoErro;
  mensagem: string;
  /** Campo do formulário que causou o erro, quando aplicável. */
  campo?: string;
}

export type CodigoErro =
  | "NAO_AUTENTICADO"
  | "SEM_PERMISSAO"
  | "NAO_ENCONTRADO"
  | "VALIDACAO"
  | "CPF_JA_INSCRITO"
  | "LIMITE_OPCOES"
  | "INSCRICAO_JA_ENVIADA"
  | "FORA_DO_PRAZO"
  | "ARQUIVO_INVALIDO"
  | "ERRO_INTERNO";

/** Status HTTP correto E envelope no corpo. O cliente lê o envelope. */
export const STATUS_POR_ERRO: Record<CodigoErro, number> = {
  NAO_AUTENTICADO: 401,
  SEM_PERMISSAO: 403,
  NAO_ENCONTRADO: 404,
  VALIDACAO: 422,
  CPF_JA_INSCRITO: 409,
  LIMITE_OPCOES: 422,
  INSCRICAO_JA_ENVIADA: 409,
  FORA_DO_PRAZO: 409,
  ARQUIVO_INVALIDO: 422,
  ERRO_INTERNO: 500,
};

/* ────────────────────────────  enums  ──────────────────────────── */

export type Grupamento = "BERCARIO" | "MATERNAL I" | "MATERNAL II";
export type Turno = "Integral" | "Parcial";

export type SituacaoInscricao =
  | "rascunho"
  | "enviada"
  | "classificada"
  | "convocada"
  | "matriculada"
  | "nao_alocada";

/** O estado item a item que o RF2.3 exige que a família enxergue. */
export type SituacaoCriterio =
  | "nao_declarado"
  | "confirmado_base"      // cruzamento automático confirmou. DISPENSA documento (RF2.2)
  | "documento_pendente"   // declarado, documento anexado, será conferido na matrícula
  | "nao_comprovado";      // declarado sem lastro. NÃO PONTUA (RF2.4)

export type CanalContato = "telefone_principal" | "telefone_alternativo" | "email";

export type TipoFase = "inscricao" | "rodada_1" | "rodada_2" | "remanescentes" | "matricula";

export const GRUPAMENTOS: Grupamento[] = ["BERCARIO", "MATERNAL I", "MATERNAL II"];
export const TURNOS: Turno[] = ["Integral", "Parcial"];
export const MAX_OPCOES = 5;
export const MAX_ARQUIVO_BYTES = 5 * 1024 * 1024;
export const MIMES_ACEITOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const ROTULO_GRUPAMENTO: Record<Grupamento, string> = {
  BERCARIO: "Berçário",
  "MATERNAL I": "Maternal I",
  "MATERNAL II": "Maternal II",
};

export const ROTULO_SITUACAO_CRITERIO: Record<SituacaoCriterio, string> = {
  nao_declarado: "Não declarado",
  confirmado_base: "Confirmado pela base",
  documento_pendente: "Documento recebido",
  nao_comprovado: "Não comprovado",
};

/* ────────────────────────────  modelos  ──────────────────────────── */

export interface Contato {
  id: string;
  canal: CanalContato;
  valor: string;
  /** Contato é versionado, nunca sobrescrito (RF1.5). */
  versao: number;
  atualizado_em: ISODateTime;
}

export interface Responsavel {
  id: string;
  nome: string;
  cpf: string;
  nascimento: ISODate;
  contatos: Contato[];
}

export interface Crianca {
  id: string;
  nome: string;
  cpf: string;
  nascimento: ISODate;
}

export interface Unidade {
  /** Sete dígitos, string com zero à esquerda. Nunca number. */
  codigo: string;
  nome: string;
  tipo: string | null;
  bairro: string | null;
  cre: number | null;
  lat: number | null;
  lng: number | null;
}

/** Histórico público por oferta. Hoje só existe o processo de 2025. */
export interface HistoricoOferta {
  processo_ano: number;
  vagas: number;
  fila: number;
  matriculou: number;
  ociosas: number;
  nota_de_corte: number | null;
}

export interface Oferta {
  id: string;
  unidade: Unidade;
  grupamento: Grupamento;
  turno: Turno;
  vagas_no_processo: number;
  historico: HistoricoOferta[];
}

export interface Criterio {
  id: string;
  /** perg_id da régua oficial da SME. */
  codigo: number;
  texto: string;
  pontos: number;
  e_desempate: boolean;
  exige_documento: boolean;
}

export interface DocumentoResumo {
  id: string;
  nome_arquivo: string;
  mime: string;
  tamanho: number;
  enviado_em: ISODateTime;
}

export interface RespostaCriterio {
  criterio_id: string;
  declarado: boolean;
  situacao: SituacaoCriterio;
  /** Quanto o critério valeria se tivesse lastro. */
  pontos_se_valer: number;
  /** Quanto ele efetivamente soma hoje. 0 quando `nao_comprovado`. */
  pontos_que_contam: number;
  documento: DocumentoResumo | null;
}

export interface OpcaoEscolhida {
  /** 1 a 5. A ordem é vinculante (R1). */
  ordem: number;
  oferta: Oferta;
}

export interface Inscricao {
  id: string;
  processo_ano: number;
  situacao: SituacaoInscricao;
  crianca: Crianca;
  grupamento: Grupamento;
  turno: Turno;
  opcoes: OpcaoEscolhida[];
  respostas: RespostaCriterio[];
  pontuacao: {
    /** Só critérios com lastro (RF2.4). É esta que classifica. */
    pontos_que_contam: number;
    /** Tudo que foi declarado. A diferença entre as duas é o argumento do projeto. */
    pontos_declarados: number;
    desempates: number;
  };
  numero_sorteio: string | null;
  enviada_em: ISODateTime | null;
  /** Mensagens legíveis do que falta. Vazio = pode finalizar. */
  pendencias: string[];
}

export interface Fase {
  tipo: TipoFase;
  titulo: string;
  inicio: ISODate;
  fim: ISODate;
  situacao: "futura" | "atual" | "encerrada";
}

export interface Processo {
  ano: number;
  situacao: string;
  max_opcoes: number;
  fases: Fase[];
}

/** P1 — tela de resultado (RF4.1, RF4.3). */
export interface Resultado {
  alocada: boolean;
  oferta: Oferta | null;
  posicao_preferencia: number | null;
  explicacao: string;
  origem_explicacao: "molde" | "modelo";
  detalhe_opcoes: {
    ordem: number;
    unidade: string;
    capacidade: number;
    candidatos: number;
    nota_de_corte: number | null;
    sua_pontuacao: number;
    conseguiu: boolean;
  }[];
}

export interface Sessao {
  token: string;
  responsavel: Responsavel;
}

export interface Me {
  responsavel: Responsavel;
  criancas: Crianca[];
  inscricoes: Pick<Inscricao, "id" | "situacao" | "crianca" | "processo_ano">[];
}

/* ────────────────────────────  corpos de requisição  ──────────────────────────── */

export interface CorpoCadastro {
  nome: string;
  cpf: string;
  nascimento: ISODate;
  telefone: string;
  email: string;
}

export interface CorpoLogin {
  cpf: string;
  nascimento: ISODate;
}

export interface CorpoNovaInscricao {
  crianca: { nome: string; cpf: string; nascimento: ISODate };
  grupamento: Grupamento;
  turno: Turno;
}

/** Substitui as opções inteiras. Ordem do array = ordem de preferência. */
export interface CorpoOpcoes {
  oferta_ids: string[];
}

/** Substitui as declarações inteiras. Ids dos critérios marcados. */
export interface CorpoCriterios {
  declarados: string[];
}

export interface CorpoContatos {
  contatos: { canal: CanalContato; valor: string }[];
}

export interface FiltroOfertas {
  busca?: string;
  bairro?: string;
  cre?: number;
  grupamento?: Grupamento;
  turno?: Turno;
  pagina?: number;
}

export interface PaginaOfertas {
  itens: Oferta[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface Saude {
  ok: true;
  versao: string;
  banco: "ok" | "erro";
}

/* ────────────────────────────  rotas  ──────────────────────────── */

/** Prefixo de toda rota. */
export const BASE_API = "/api";

/**
 * Contrato de rotas. 🔓 = pública; as demais exigem `Authorization: Bearer <token>`.
 *
 * E1  🔓 POST   /auth/cadastro                                   CorpoCadastro     -> Sessao
 * E2  🔓 POST   /auth/login                                      CorpoLogin        -> Sessao
 * E3     GET    /me                                                                -> Me
 * E4  🔓 GET    /processo                                                          -> Processo
 * E5  🔓 GET    /criterios                                                         -> Criterio[]
 * E6  🔓 GET    /ofertas?busca&bairro&cre&grupamento&turno&pagina                  -> PaginaOfertas
 * E7     POST   /inscricoes                                      CorpoNovaInscricao-> Inscricao
 * E8     GET    /inscricoes/:id                                                    -> Inscricao
 * E9     PUT    /inscricoes/:id/opcoes                           CorpoOpcoes       -> Inscricao
 * E10    PUT    /inscricoes/:id/criterios                        CorpoCriterios    -> Inscricao
 * E11    POST   /inscricoes/:id/criterios/:criterioId/documento  multipart(arquivo)-> RespostaCriterio
 * E12    DELETE /documentos/:id                                                    -> RespostaCriterio
 * E13    GET    /documentos/:id                                                    -> bytes
 * E14    POST   /inscricoes/:id/finalizar                                          -> Inscricao
 * E15    GET    /inscricoes/:id/resultado                                          -> Resultado      (P1)
 * E16    PUT    /me/contatos                                     CorpoContatos     -> Responsavel    (P1)
 * E17 🔓 GET    /saude                                                             -> Saude
 */
export const ROTAS = {
  cadastro: "/auth/cadastro",
  login: "/auth/login",
  me: "/me",
  contatos: "/me/contatos",
  processo: "/processo",
  criterios: "/criterios",
  ofertas: "/ofertas",
  inscricoes: "/inscricoes",
  inscricao: (id: string) => `/inscricoes/${id}`,
  opcoes: (id: string) => `/inscricoes/${id}/opcoes`,
  criteriosDaInscricao: (id: string) => `/inscricoes/${id}/criterios`,
  documento: (id: string, criterioId: string) => `/inscricoes/${id}/criterios/${criterioId}/documento`,
  arquivo: (documentoId: string) => `/documentos/${documentoId}`,
  finalizar: (id: string) => `/inscricoes/${id}/finalizar`,
  resultado: (id: string) => `/inscricoes/${id}/resultado`,
  saude: "/saude",
} as const;
