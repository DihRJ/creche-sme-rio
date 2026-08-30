/**
 * RF2.2 — cruzamento automático com as bases do Data Lake, SIMULADO.
 *
 * ISTO É UM MOCK. Em produção é integração real com CadÚnico, Bolsa Família e o
 * Registro Municipal Integrado (PLANO.md AD-13). Está aqui porque o cruzamento é
 * o coração da proposta e precisa aparecer na demonstração.
 *
 * Duas propriedades importam:
 *
 * 1. DETERMINÍSTICO. O mesmo CPF dá sempre o mesmo resultado, então a demonstração
 *    repete igual e ninguém é surpreendido no pitch.
 * 2. SÓ ALGUNS CRITÉRIOS. Nem tudo é verificável em base: violência doméstica e
 *    doença crônica exigem documento. Confirmar tudo automaticamente seria uma
 *    mentira conveniente e destruiria o argumento do RF2.4.
 *
 * As taxas são a META do PRD (>= 85%), não os 6,8% de hoje. O contraste é o ponto:
 * o CadÚnico, que sozinho vale 51 dos 100 pontos, foi declarado por 35.141 famílias
 * e validado em 2.390 — porque exigia ida presencial à unidade no dia seguinte.
 */

/** Critérios que uma base pública consegue confirmar, e com que cobertura. */
const TAXA_BASE: Record<number, number> = {
  28: 88, // CadÚnico ....................... 51 pts · Data Lake
  6: 85, // Bolsa Família / Cartão Carioca ... 2 pts · Data Lake
  29: 92, // Irmão matriculado na rede ....... 0 pts · gestão acadêmica
  30: 80, // Responsável menor de 18 anos .... 0 pts · registro civil
};

/** Os demais critérios não são verificáveis em base e exigem documento (RF2.4). */
export const confirmavelPelaBase = (codigoCriterio: number): boolean => codigoCriterio in TAXA_BASE;

export function confirmadoPelaBase(cpf: string, codigoCriterio: number): boolean {
  const taxa = TAXA_BASE[codigoCriterio];
  if (taxa === undefined) return false;
  // Hash simples e estável. Não precisa ser criptográfico: precisa ser repetível.
  let h = 7;
  for (const ch of `${cpf}:${codigoCriterio}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100 < taxa;
}
