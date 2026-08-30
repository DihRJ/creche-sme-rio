/**
 * Apaga os dados de FAMÍLIA e preserva o catálogo.
 *
 * Existe porque os smoke tests usam CPF fixo: contra o mock isso é inofensivo,
 * porque ele reseta, mas contra o Postgres a segunda execução bate em
 * CPF_JA_INSCRITO. Rode `npm run limpar` antes de repetir o smoke.
 *
 * Não toca em unidade, oferta, histórico, critério nem processo — só no que uma
 * família cria. Reconstruir o catálogo custa outro seed.
 */
import { poolDireto, sqlDireto } from "./db.ts";

export async function limpar(): Promise<void> {
  // Ordem importa: as FKs em cascata cuidam do resto a partir de responsavel.
  await sqlDireto(`truncate evento_auditoria, documento, resposta_criterio, opcao,
                            alocacao, explicacao, inscricao, crianca, contato, responsavel
                   restart identity cascade`);
  console.log("limpo: dados de família apagados, catálogo preservado");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await limpar();
  await poolDireto.end();
}
