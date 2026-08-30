/**
 * Normalização de texto. UM lugar só — ninguém normaliza por conta própria.
 *
 * Existe por um erro concreto das bases da SME: `JACAREPAGUÁ` e `JACAREPAGUA` são o
 * mesmo bairro, e a família digita sem acento no teclado do celular. Buscar pelo texto
 * cru devolve zero resultado e nada avisa que houve um problema.
 */
export function normalizar(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // remove os diacríticos separados pelo NFKD
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}
