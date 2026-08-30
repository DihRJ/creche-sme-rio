/**
 * Sessão da família.
 *
 * ATALHO DE MVP, declarado: o login é CPF + data de nascimento, sem senha. Isso
 * significa que quem souber os dois entra na conta. É aceitável aqui porque o
 * ambiente é de demonstração, com dado fictício e banner em toda tela. Num sistema
 * real isso é gov.br — ver PLANO.md AD-14.
 */
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ErroHttp } from "./http.ts";

const VALIDADE = "12h";

function segredo(): string {
  const s = process.env.JWT_SEGREDO;
  if (!s) throw new Error("JWT_SEGREDO ausente");
  return s;
}

export const assinar = (responsavelId: string): string =>
  jwt.sign({ sub: responsavelId }, segredo(), { expiresIn: VALIDADE });

/** Só dígitos. Validação de formato, não de dígito verificador: CPF de teste precisa passar. */
export function limparCpf(bruto: unknown, campo = "cpf"): string {
  const cpf = String(bruto ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) throw new ErroHttp("VALIDACAO", "CPF deve ter 11 dígitos.", campo);
  return cpf;
}

export function exigirTexto(v: unknown, campo: string, rotulo: string): string {
  const s = String(v ?? "").trim();
  if (!s) throw new ErroHttp("VALIDACAO", `${rotulo} é obrigatório.`, campo);
  return s;
}

export function exigirData(v: unknown, campo: string, rotulo: string): string {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)))
    throw new ErroHttp("VALIDACAO", `${rotulo} deve estar no formato AAAA-MM-DD.`, campo);
  return s;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      responsavelId?: string;
    }
  }
}

export function exigeAuth(req: Request, _res: Response, next: NextFunction) {
  const cabecalho = req.header("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return next(new ErroHttp("NAO_AUTENTICADO", "Faça login para continuar."));
  try {
    const carga = jwt.verify(token, segredo()) as { sub?: string };
    if (!carga.sub) throw new Error("sem sub");
    req.responsavelId = carga.sub;
    return next();
  } catch {
    return next(new ErroHttp("NAO_AUTENTICADO", "Sua sessão expirou. Entre novamente."));
  }
}

/** O id do responsável autenticado. Só use depois de `exigeAuth`. */
export function autor(req: Request): string {
  if (!req.responsavelId) throw new ErroHttp("NAO_AUTENTICADO", "Faça login para continuar.");
  return req.responsavelId;
}
