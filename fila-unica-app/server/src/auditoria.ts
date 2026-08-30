/**
 * Trilha append-only (RNF4): toda mutação registra autor, data, valor anterior e novo.
 *
 * Grava na MESMA transação da mutação — não por trigger de banco, porque o trigger
 * não sabe quem é o autor da ação de negócio, só o usuário de conexão.
 */
import { sql } from "./db.ts";

export async function auditar(
  entidade: string,
  entidadeId: string,
  acao: string,
  autorId: string | null,
  antes: unknown,
  depois: unknown,
  consultar: typeof sql = sql,
): Promise<void> {
  await consultar(
    `insert into evento_auditoria (entidade, entidade_id, acao, autor_id, antes, depois)
     values ($1,$2,$3,$4,$5,$6)`,
    [entidade, entidadeId, acao, autorId, antes ? JSON.stringify(antes) : null,
     depois ? JSON.stringify(depois) : null],
  );
}
