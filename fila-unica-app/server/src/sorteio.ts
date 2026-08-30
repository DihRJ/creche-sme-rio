/**
 * Número de sorteio — o último desempate da fila.
 *
 * Existe por causa de um bug latente do protótipo em `pipeline/`: a prioridade era
 * `(-pontos, -desempates, data_inscricao)`, e empate nos três é frequente, porque a
 * maior parte das inscrições tem zero ponto. Quando empata, o resultado passa a
 * depender da ordem em que a lista foi montada, e o determinismo (RNF3) morre em
 * silêncio.
 *
 * A aceitação diferida só produz UM emparelhamento estável ótimo para as crianças
 * se a prioridade for uma ordem total ESTRITA. O número de sorteio garante isso.
 *
 * Por que HMAC e não `random()`:
 *
 *   VERIFICÁVEL   quem tem a semente e o id refaz a conta e confere o resultado
 *   DETERMINÍSTICO a mesma entrada dá sempre a mesma saída, então a rodada é
 *                  reconstituível meses depois (RF3.8)
 *   NÃO PREVISÍVEL sem a semente, ninguém calcula o próprio número antes da hora
 *
 * A semente é publicada junto do calendário, ANTES do fim das inscrições. É isso
 * que permite a um terceiro auditar o desempate. Ver PLANO.md AD-6.
 *
 * Efeito colateral desejado: chegar mais cedo não dá vantagem, o que remove o
 * incentivo à corrida ao servidor no primeiro minuto (RNF7).
 */
import { createHmac } from "node:crypto";

export function numeroDeSorteio(inscricaoId: string): string {
  const semente = process.env.SEMENTE_PROCESSO;
  if (!semente) throw new Error("SEMENTE_PROCESSO ausente: sem ela o desempate não é auditável");
  return createHmac("sha256", semente).update(inscricaoId).digest("hex").slice(0, 8);
}
