/**
 * Situação de cada critério declarado. Um lugar só — E10, E11 e E12 chamam daqui.
 *
 * A regra do RF2.4: só pontua o que tem lastro.
 *
 *   confirmado por base      → confirmado_base    · pontua, e DISPENSA documento (RF2.2)
 *   documento anexado        → documento_pendente · pontua, conferido na matrícula (RF2.5)
 *   nem base nem documento   → nao_comprovado     · NÃO pontua
 *
 * Não comprovado não impede o envio da inscrição. Barrar é o que hoje derruba a
 * validação a 6,8%, porque atinge sobretudo quem tem direito real e não consegue
 * faltar ao trabalho para comprovar.
 */
import type { sql } from "./db.ts";
import { confirmadoPelaBase } from "./mock-cruzamento.ts";
import type { SituacaoCriterio } from "./contracts.gen.ts";

export function situacaoDoCriterio(
  declarado: boolean,
  cpfCrianca: string,
  codigoCriterio: number,
  temDocumento: boolean,
): SituacaoCriterio {
  if (!declarado) return "nao_declarado";
  if (confirmadoPelaBase(cpfCrianca, codigoCriterio)) return "confirmado_base";
  return temDocumento ? "documento_pendente" : "nao_comprovado";
}

/**
 * Recalcula a situação de todas as respostas de uma inscrição.
 *
 * Chamada depois de declarar critério (E10), anexar documento (E11) e remover
 * documento (E12) — as três coisas que podem mudar o lastro.
 */
export async function recalcularSituacoes(inscricaoId: string, consultar: typeof sql): Promise<void> {
  const linhas = await consultar<{
    id: string; declarado: boolean; codigo: number; cpf: string; tem_documento: boolean;
  }>(
    `select r.id, r.declarado, c.codigo, cr.cpf,
            exists (select 1 from documento d where d.resposta_criterio_id = r.id) tem_documento
       from resposta_criterio r
       join criterio c on c.id = r.criterio_id
       join inscricao i on i.id = r.inscricao_id
       join crianca cr on cr.id = i.crianca_id
      where r.inscricao_id = $1`,
    [inscricaoId],
  );

  for (const l of linhas) {
    const situacao = situacaoDoCriterio(l.declarado, l.cpf, l.codigo, l.tem_documento);
    await consultar(`update resposta_criterio set situacao = $1 where id = $2`, [situacao, l.id]);
  }
}
