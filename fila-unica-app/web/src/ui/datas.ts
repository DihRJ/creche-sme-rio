/**
 * Datas do calendário do processo, para a linha do tempo do E4.
 *
 * Módulo separado da tela porque são funções puras e precisam ser testáveis sem
 * montar React — e porque a `formato.ts` é do Dev B, e período de fase é
 * vocabulário do acompanhamento, não do formulário de inscrição.
 */

/**
 * Meio-dia em toda conversão, e isto não é detalhe: `new Date("2026-09-01")` é
 * meia-noite UTC, que no fuso do Rio (UTC-3) cai em 31 de agosto às 21h. A linha
 * do tempo inteira andaria um dia para trás, e o "último dia" apareceria cedo.
 */
export const aoMeioDia = (iso: string) => new Date(`${iso}T12:00:00`);

/**
 * "1 a 30 de setembro", ou "3 de novembro a 4 de dezembro" quando cruza o mês.
 * Por extenso de propósito: "01/09 a 30/09" é dado, não é recado.
 */
export function periodo(inicio: string, fim: string): string {
  const a = aoMeioDia(inicio);
  const b = aoMeioDia(fim);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${inicio} a ${fim}`;

  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });
  const mesmoMes = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  return mesmoMes
    ? `${a.getDate()} a ${b.getDate()} de ${mes(b)}`
    : `${a.getDate()} de ${mes(a)} a ${b.getDate()} de ${mes(b)}`;
}

/**
 * Dias inteiros entre hoje e o fim da fase. Aritmética de exibição sobre uma data
 * que o servidor mandou — quem decide qual fase está aberta continua sendo o
 * servidor, pelo campo `situacao` da `Fase`.
 */
export function diasAte(fim: string, hoje = new Date()): number | null {
  const d = aoMeioDia(fim);
  if (Number.isNaN(d.getTime())) return null;
  const base = new Date(hoje);
  base.setHours(12, 0, 0, 0);
  return Math.round((d.getTime() - base.getTime()) / 86_400_000);
}
