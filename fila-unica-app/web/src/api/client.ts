/**
 * Cliente da API. Desembrulha o envelope do contrato e transforma `ok:false`
 * em excecao, para a tela nunca ter que checar `ok` na mao.
 *
 * Alterna com o mock por VITE_USAR_MOCK, para o front nao esperar o back (regra 4
 * do README). Sem VITE_API_URL definida, assume o mock: e o default seguro para
 * quem acabou de clonar o repositorio.
 */
import type { CodigoErro, ErroApi, Resposta } from "../contracts.gen";
import { BASE_API } from "../contracts.gen";

const URL_API: string | undefined = import.meta.env.VITE_API_URL;

export const USANDO_MOCK =
  import.meta.env.VITE_USAR_MOCK === "true" ||
  (import.meta.env.VITE_USAR_MOCK !== "false" && !URL_API);

const BASE = URL_API ?? `http://localhost:3001${BASE_API}`;

const CHAVE_TOKEN = "fila-unica.token";

export const token = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  gravar: (t: string) => localStorage.setItem(CHAVE_TOKEN, t),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
};

/** Erro de negocio vindo do contrato. `codigo` e o que a tela usa para decidir. */
export class ErroDaApi extends Error {
  codigo: CodigoErro;
  campo?: string;

  constructor(erro: ErroApi) {
    super(erro.mensagem);
    this.name = "ErroDaApi";
    this.codigo = erro.codigo;
    this.campo = erro.campo;
  }
}

export type Opcoes = {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  corpo?: unknown;
  /** Upload do E11: vai como multipart, nunca como base64 em JSON. */
  arquivo?: File;
  sinal?: AbortSignal;
};

export async function chamar<T>(rota: string, opts: Opcoes = {}): Promise<T> {
  if (USANDO_MOCK) {
    const { chamarMock } = await import("./mock");
    return chamarMock<T>(rota, opts);
  }

  const cabecalhos: Record<string, string> = {};
  const jwt = token.ler();
  if (jwt) cabecalhos.Authorization = `Bearer ${jwt}`;

  let body: BodyInit | undefined;
  if (opts.arquivo) {
    const fd = new FormData();
    fd.append("arquivo", opts.arquivo);
    body = fd; // sem Content-Type: o browser precisa definir o boundary
  } else if (opts.corpo !== undefined) {
    cabecalhos["Content-Type"] = "application/json";
    body = JSON.stringify(opts.corpo);
  }

  let resp: Response;
  try {
    resp = await fetch(`${BASE}${rota}`, {
      method: opts.metodo ?? (body ? "POST" : "GET"),
      headers: cabecalhos,
      body,
      signal: opts.sinal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Inclui o cold start do Render, que dorme depois de ~15 min e leva ~50s pra acordar.
    throw new ErroDaApi({
      codigo: "ERRO_INTERNO",
      mensagem: "Nao foi possivel falar com o servidor. Verifique a conexao e tente de novo.",
    });
  }

  if (resp.status === 401) {
    token.limpar();
    throw new ErroDaApi({ codigo: "NAO_AUTENTICADO", mensagem: "Sua sessao expirou. Entre de novo." });
  }

  let envelope: Resposta<T>;
  try {
    envelope = (await resp.json()) as Resposta<T>;
  } catch {
    throw new ErroDaApi({
      codigo: "ERRO_INTERNO",
      mensagem: `O servidor respondeu ${resp.status} sem corpo entendivel.`,
    });
  }

  if (!envelope.ok) throw new ErroDaApi(envelope.erro);
  return envelope.data;
}

/** Baixa arquivo autenticado (E13). `<img src>` nao carrega header, entao vai por fetch. */
export async function baixarArquivo(rota: string): Promise<Blob> {
  if (USANDO_MOCK) {
    const { blobMock } = await import("./mock");
    return blobMock();
  }
  const jwt = token.ler();
  const resp = await fetch(`${BASE}${rota}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  });
  if (!resp.ok) {
    throw new ErroDaApi({ codigo: "NAO_ENCONTRADO", mensagem: "Nao foi possivel baixar o arquivo." });
  }
  return resp.blob();
}

/**
 * Lista de bairros para o filtro. O contrato nao tem endpoint para isso, entao
 * contra a API real cai para busca por texto e a tela some com os atalhos.
 */
export async function listarBairros(): Promise<string[]> {
  if (USANDO_MOCK) {
    const { BAIRROS_MOCK } = await import("./mock");
    return BAIRROS_MOCK;
  }
  return [];
}

export function mensagemDe(e: unknown): string {
  if (e instanceof ErroDaApi) return e.message;
  if (e instanceof Error) return e.message;
  return "Erro inesperado.";
}
