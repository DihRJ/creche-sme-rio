/**
 * Molde determinístico da explicação — a camada 2 da AD-12.
 *
 * A explicação da família tem três camadas, nesta ordem de precedência:
 *
 *   1. O MOTOR produz os números. Pontuação, nota de corte, quantos concorreram.
 *      Determinístico, e é o que aparece na tela como dado.
 *   2. ESTE MOLDE compõe um texto correto, sem modelo nenhum. Burocrático, feio,
 *      sempre disponível.
 *   3. O CLAUDE reescreve o molde em português de servidor público, em lote, no
 *      pós-processamento da rodada.
 *
 * Se a camada 3 falhar, expirar ou vier vazia, a família vê esta aqui. Nunca vê
 * tela vazia. Um algoritmo que ninguém consegue explicar não é adotável, por mais
 * correto que seja — e uma explicação que às vezes não carrega é a mesma coisa.
 *
 * Nenhum dado pessoal sai daqui para modelo nenhum: a camada 3 recebe pontuação,
 * régua e nota de corte, nunca nome ou CPF (RNF5).
 */
import type { Inscricao } from "./contracts.gen.ts";

type Corte = { pontos: number; candidatos: number; capacidade: number };

const ordinal = (n: number) => ["", "1ª", "2ª", "3ª", "4ª", "5ª"][n] ?? `${n}ª`;

export function molde(
  inscricao: Inscricao,
  posicao: number | null,
  porOferta: Map<string, Corte>,
): string {
  const pontos = inscricao.pontuacao.pontos_que_contam;
  const partes: string[] = [];

  if (posicao !== null) {
    const escolhida = inscricao.opcoes.find((o) => o.ordem === posicao);
    partes.push(
      `A criança foi alocada na ${escolhida?.oferta.unidade.nome ?? "unidade escolhida"}, ` +
        `${ordinal(posicao)} opção da família, com ${pontos} ponto${pontos === 1 ? "" : "s"}.`,
    );
    // Por que não a primeira, quando não foi a primeira.
    for (const o of inscricao.opcoes.filter((x) => x.ordem < posicao)) {
      const c = porOferta.get(o.oferta.id);
      if (!c) continue;
      partes.push(
        `Não houve vaga na ${ordinal(o.ordem)} opção, ${o.oferta.unidade.nome}: ` +
          `${c.candidatos} concorreram a ${c.capacidade} vaga${c.capacidade === 1 ? "" : "s"} ` +
          `e a nota de corte ficou em ${c.pontos}.`,
      );
    }
  } else {
    partes.push(
      `A criança não conseguiu vaga nesta rodada, com ${pontos} ponto${pontos === 1 ? "" : "s"}. ` +
        `Ela continua na fila e concorre na rodada seguinte, sem precisar se inscrever de novo.`,
    );
    const primeira = inscricao.opcoes[0];
    const c = primeira ? porOferta.get(primeira.oferta.id) : undefined;
    if (primeira && c) {
      partes.push(
        `Na ${ordinal(primeira.ordem)} opção, ${primeira.oferta.unidade.nome}, ` +
          `${c.candidatos} concorreram a ${c.capacidade} vaga${c.capacidade === 1 ? "" : "s"} ` +
          `e a nota de corte foi ${c.pontos}.`,
      );
    }
  }

  // RF4.3: o critério declarado e não comprovado precisa ser dito com todas as
  // letras, com o valor em pontos e a orientação. É a parte mais importante da
  // explicação quando aparece, porque é acionável.
  const semLastro = inscricao.respostas.filter((r) => r.declarado && r.situacao === "nao_comprovado");
  if (semLastro.length > 0) {
    const perdidos = semLastro.reduce((s, r) => s + r.pontos_se_valer, 0);
    partes.push(
      `A família declarou ${semLastro.length === 1 ? "1 critério" : `${semLastro.length} critérios`} ` +
        `de prioridade que não ${semLastro.length === 1 ? "foi comprovado" : "foram comprovados"}. ` +
        `${semLastro.length === 1 ? "Ele valeria" : "Juntos valeriam"} ${perdidos} ponto${perdidos === 1 ? "" : "s"}, ` +
        `e por isso não ${semLastro.length === 1 ? "contou" : "contaram"} na classificação. ` +
        `Enviar o comprovante pelo aplicativo corrige isso para a próxima rodada.`,
    );
  }

  return partes.join(" ");
}
