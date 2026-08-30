/**
 * Formatacao e validacao de formulario (Dev B).
 *
 * A validacao de CPF aqui e SO DE FORMATO, de proposito. Nao conferimos digito
 * verificador porque os CPFs de demonstracao do seed do Dev A sao previsiveis e
 * nao passariam no digito. Quem decide se o CPF existe e a Receita, pelo servidor.
 */
import type { Grupamento } from "./contracts.gen";

export const soDigitos = (s: string) => s.replace(/\D/g, "");

export function mascaraCpf(s: string): string {
  const d = soDigitos(s).slice(0, 11);
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)].filter(Boolean);
  if (p.length <= 3) return p.join(".");
  return `${p.slice(0, 3).join(".")}-${p[3]}`;
}

export function mascaraTelefone(s: string): string {
  const d = soDigitos(s).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const corte = d.length <= 10 ? 6 : 7;
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}

export const cpfTemFormato = (s: string) => soDigitos(s).length === 11;

export function erroDeCpf(s: string): string | undefined {
  const d = soDigitos(s);
  if (d.length === 0) return "Informe o CPF.";
  if (d.length !== 11) return "O CPF tem 11 dígitos.";
  return undefined;
}

export function erroDeData(s: string, rotulo = "data"): string | undefined {
  if (!s) return `Informe a ${rotulo}.`;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return `Essa ${rotulo} não é válida.`;
  if (d.getTime() > Date.now()) return `A ${rotulo} não pode ser no futuro.`;
  return undefined;
}

/**
 * Grupamento sugerido pela idade que a crianca tera no inicio do ano letivo.
 * E sugestao: a tela deixa editavel, porque o corte oficial tem excecao e quem
 * decide e a norma do processo, nao esta funcao.
 */
export function grupamentoSugerido(nascimento: string, anoDoProcesso: number): Grupamento | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00`);
  if (Number.isNaN(n.getTime())) return null;
  // referencia: 31 de marco do ano do processo, como o calendario escolar usa
  const ref = new Date(Date.UTC(anoDoProcesso, 2, 31, 12));
  let meses = (ref.getFullYear() - n.getFullYear()) * 12 + (ref.getMonth() - n.getMonth());
  if (ref.getDate() < n.getDate()) meses -= 1;
  if (meses < 0) return null;
  if (meses < 12) return "BERCARIO";
  if (meses < 24) return "MATERNAL I";
  if (meses < 48) return "MATERNAL II";
  return null;
}

export const nf = new Intl.NumberFormat("pt-BR");

export function dataCurta(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
