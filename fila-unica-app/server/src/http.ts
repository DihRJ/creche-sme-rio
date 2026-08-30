/**
 * Envelope do contrato. Toda resposta da API sai por aqui.
 *
 * Um endpoint devolvendo objeto cru quebra o cliente do front inteiro, porque o
 * `chamar<T>()` do web desembrulha `{ok,data}` sempre. Por isso `ok()` e `ErroHttp`
 * são o único caminho de saída.
 */
import type { NextFunction, Request, Response } from "express";
import { STATUS_POR_ERRO, type CodigoErro } from "./contracts.gen.ts";

// Sem "parameter properties" (`constructor(readonly x)`): o modo strip-only do
// Node não as suporta, e o código não deve depender de quem o executa.
export class ErroHttp extends Error {
  codigo: CodigoErro;
  campo?: string;
  constructor(codigo: CodigoErro, mensagem: string, campo?: string) {
    super(mensagem);
    this.codigo = codigo;
    this.campo = campo;
  }
}

export const ok = <T>(res: Response, data: T) => res.json({ ok: true, data });

/** Envolve um handler async para que throw vire resposta de erro em vez de processo pendurado. */
export const rota =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export function tratarErro(e: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (e instanceof ErroHttp) {
    return res.status(STATUS_POR_ERRO[e.codigo]).json({
      ok: false,
      erro: { codigo: e.codigo, mensagem: e.message, ...(e.campo ? { campo: e.campo } : {}) },
    });
  }
  console.error("erro nao tratado:", e);
  return res.status(500).json({
    ok: false,
    erro: { codigo: "ERRO_INTERNO", mensagem: "Erro interno. Tente novamente." },
  });
}
