/**
 * Para onde levar a familia depois do login (Dev B).
 *
 * O destino era incondicional: `/inscricao/nova`. Quem tinha inscricao em andamento
 * caia na tela de cadastrar crianca, tentava de novo a mesma crianca e batia em
 * CPF_JA_INSCRITO sem entender por que. Beco sem saida no celular, em dados moveis.
 *
 * As regras abaixo saem do PARA-DEV-B.md, escrito por quem tocou o backend.
 */
import { chamar } from "./api/client";
import type { Inscricao, Me, SituacaoInscricao } from "./contracts.gen";
import { ROTAS } from "./contracts.gen";

/** Situacoes em que a inscricao ainda esta sendo preenchida. */
const EM_RASCUNHO: SituacaoInscricao = "rascunho";

/**
 * Etapa em que o rascunho parou, inferida do que o E8 ja devolve.
 * Nao ha campo de "etapa" no contrato, e nem deveria haver: a etapa e derivada
 * do estado, senao vira mais um dado para sair de sincronia.
 */
export function etapaDoRascunho(i: Inscricao): string {
  const base = `/inscricao/${i.id}`;
  if (i.opcoes.length === 0) return `${base}/unidades`;
  if (!i.respostas.some((r) => r.declarado)) return `${base}/vulnerabilidades`;
  // Declarou e ficou sem lastro: o proximo passo util e anexar o comprovante.
  if (i.respostas.some((r) => r.situacao === "nao_comprovado")) return `${base}/documentos`;
  return `${base}/revisar`;
}

/**
 * Resolve o destino a partir do `/me`. Faz no maximo UMA chamada extra, e so no
 * caso de haver exatamente um rascunho, que e quando vale a pena precisar a etapa.
 */
export async function destinoPosLogin(me: Me): Promise<string> {
  const inscricoes = me.inscricoes ?? [];

  if (inscricoes.length === 0) return "/inscricao/nova";
  if (inscricoes.length > 1) return "/inscricoes";

  const unica = inscricoes[0];
  if (unica.situacao !== EM_RASCUNHO) return "/inscricoes";

  try {
    return etapaDoRascunho(await chamar<Inscricao>(ROTAS.inscricao(unica.id)));
  } catch (e) {
    // Mandar para as unidades ja tira a familia do beco sem saida: dali em diante a
    // navegacao e linear. Mas o fallback RECLAMA, porque ele devolve a mesma rota
    // que o caso "rascunho sem opcoes" e sem isso um erro aqui fica indistinguivel
    // do caminho normal — foi exatamente o que me custou tempo ao testar.
    console.warn("destinoPosLogin: falha ao ler o rascunho, caindo para /unidades", e);
    return `/inscricao/${unica.id}/unidades`;
  }
}

export const ROTULO_SITUACAO: Record<SituacaoInscricao, string> = {
  rascunho: "Não enviada",
  enviada: "Enviada",
  classificada: "Resultado saiu",
  convocada: "Você foi chamada",
  matriculada: "Matrícula efetivada",
  nao_alocada: "Sem vaga nesta rodada",
};

export const EXPLICACAO_SITUACAO: Record<SituacaoInscricao, string> = {
  rascunho: "Termine antes do fim do prazo de inscrição.",
  enviada: "Aguardando o resultado da classificação.",
  classificada: "Veja em qual creche a sua criança ficou.",
  convocada: "Responda dentro do prazo para não perder a vaga.",
  matriculada: "A matrícula foi efetivada na unidade.",
  nao_alocada: "Você continua na fila para as rodadas seguintes.",
};

/** Cor do token de paleta para a situacao. */
export const TOM_SITUACAO: Record<SituacaoInscricao, string> = {
  rascunho: "var(--fila)",
  enviada: "var(--ociosa)",
  classificada: "var(--ociosa)",
  convocada: "var(--fila)",
  matriculada: "var(--ganho)",
  nao_alocada: "var(--perda)",
};
