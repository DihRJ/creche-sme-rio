/**
 * Gera os dois módulos de dado do Dev C, a partir dos JSONs reais da SME
 * em `server/dados/`.
 *
 *   node devc/gerar-fixtures.mjs
 *
 * NÃO gera `web/src/api/mock.ts`: aquele arquivo é o mock da API inteira, do
 * Dev B, ligado ao `client.ts`. Critérios, ofertas e processo saem de lá. Aqui
 * fica só o que as telas do Dev C precisam e que o mock não tem — e a chave é
 * sempre o `codigo` da régua, nunca o `id`, para não depender do formato de id
 * que o mock escolheu (`crit-28`) nem do que o servidor vier a usar.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const dados = (n) => JSON.parse(readFileSync(join(aqui, "../server/dados", n), "utf8"));
const escreve = (rel, txt) => writeFileSync(join(aqui, "../web/src", rel), txt);

const regua = dados("regua.json");
const casos = dados("casos.json");
const explicacoes = dados("explicacoes.json");

const ANO_REGUA = Math.max(...regua.map((r) => r.ano)); // 2025 — a régua vigente
const criterios = regua.filter((r) => r.ano === ANO_REGUA).sort((a, b) => b.pontos - a.pontos);

/* ── 1. glossário ───────────────────────────────────────────────────────────
 * O brief do Dev C é explícito: "nada de jargão". A régua da SME é escrita em
 * linguagem administrativa, e "família monoparental" não é português que a mãe
 * de dois filhos na fila do posto entenda. Cada texto abaixo foi escrito para
 * caber em uma linha embaixo do critério.
 *
 * Só os critérios com jargão de verdade entram. Os outros já se explicam.
 */
const AJUDA = {
  28: "O CadÚnico é o cadastro do governo para programas sociais. Se a família já está inscrita, a prefeitura confirma sozinha.",
  31: "Criança com deficiência, transtorno do espectro autista ou altas habilidades.",
  20: "Família monoparental é a família em que uma pessoa só cria a criança — em geral a mãe ou o pai, sem companheiro.",
  25: "Pai, mãe ou responsável legal com deficiência.",
  18: "Doença de longa duração e grave, na criança ou em quem mora com ela.",
  23: "Pessoa que veio de outro país fugindo de guerra ou perseguição.",
  27: "A criança ficou na fila do ano passado e não conseguiu vaga.",
  29: "Irmão já matriculado em creche ou escola da prefeitura, ou em unidade parceira.",
  30: "Pai, mãe ou responsável com menos de 18 anos.",
};

const semAjuda = criterios.filter((c) => !(c.perg_id in AJUDA)).map((c) => c.perg_id);

escreve(
  "api/glossario.ts",
  `/**
 * Glossário e taxa de validação dos critérios — GERADO por \`devc/gerar-fixtures.mjs\`.
 * Não edite à mão: a próxima geração sobrescreve.
 *
 * Complementa o \`mock.ts\` (e, depois, o E5 da API real), que devolve \`codigo\`,
 * \`texto\` e \`pontos\` mas não tem nem a explicação em português simples nem o
 * histórico de validação. Chaveado por \`codigo\` da régua, então funciona igual
 * contra o mock e contra o servidor.
 */

/** Uma linha em português simples para os critérios escritos em jargão. */
export const AJUDA_CRITERIO: Record<number, string> = ${JSON.stringify(
    Object.fromEntries(Object.entries(AJUDA).sort(([a], [b]) => Number(a) - Number(b))),
    null,
    2,
  )};

/**
 * Percentual do que foi declarado e efetivamente validado no processo de ${ANO_REGUA}.
 *
 * É o achado central do projeto: o CadÚnico vale ${criterios.find((c) => c.perg_id === 28)?.pontos} dos 100 pontos da régua,
 * foi declarado por dezenas de milhares de famílias e validou em ${criterios.find((c) => c.perg_id === 28)?.pct}%.
 * Por isso ${"93%"} das inscrições entram na fila com zero ponto.
 */
export const VALIDACAO_${ANO_REGUA}: Record<number, number> = ${JSON.stringify(
    Object.fromEntries(criterios.map((c) => [c.perg_id, c.pct])),
    null,
    2,
  )};
`,
);

/* ── 2. resultado de demonstração ───────────────────────────────────────────
 * O mock do Dev B devolve um stub no E15 e marca, no próprio texto, que a tela
 * é do Dev C. Este é o caso real que preenche aquele buraco: uma família que
 * declarou 56 pontos, não comprovou nenhum, e foi classificada com 0.
 * A explicação é a que o Claude gerou sobre os números do motor, não um texto
 * escrito para a demonstração.
 */
const CASO_ID = "aluno_0012265";
const caso = casos.casos.find((c) => c.id === CASO_ID) ?? casos.casos[0];
const declarados = caso.criterios_so_declarados.reduce((s, c) => s + c.pontos, 0);

escreve(
  "api/resultado-demo.ts",
  `/**
 * Resultado de demonstração — GERADO por \`devc/gerar-fixtures.mjs\`.
 * Não edite à mão: a próxima geração sobrescreve.
 *
 * Caso real do processo de ${casos.ano} (\`${caso.id}\`), com a explicação real gerada
 * pelo Claude sobre os números do motor. É o passo 7 do percurso de demonstração.
 *
 * Existe porque o \`mock.ts\` responde o E15 com um stub — a classificação não roda
 * no mock. Quando a API real classificar, isto sai e a tela passa a ler o E15.
 */
import type { Resultado } from "../contracts.gen";

/** ${declarados} pontos declarados, ${caso.pontos} contados: a diferença é o argumento do projeto. */
export const PONTOS_DECLARADOS_DEMO = ${declarados};
export const PONTOS_QUE_CONTAM_DEMO = ${caso.pontos};

export const RESULTADO_DEMO: Resultado = {
  alocada: ${caso.resultado_fila_unica.conseguiu},
  oferta: null,
  posicao_preferencia: ${caso.resultado_fila_unica.opcao ?? "null"},
  explicacao: ${JSON.stringify(explicacoes[caso.id] ?? "")},
  origem_explicacao: "modelo",
  detalhe_opcoes: ${JSON.stringify(
    caso.opcoes.map((o) => ({
      ordem: o.posicao,
      unidade: o.unidade,
      capacidade: o.capacidade,
      candidatos: o.candidatos,
      nota_de_corte: o.nota_de_corte,
      sua_pontuacao: caso.pontos,
      conseguiu: o.conseguiu,
    })),
    null,
    2,
  )},
};
`,
);

console.log(
  `glossario.ts: ${Object.keys(AJUDA).length} explicações, ` +
    `${criterios.length} taxas de validação (régua ${ANO_REGUA})` +
    (semAjuda.length ? `\n  sem ajuda (sem jargão): ${semAjuda.join(", ")}` : "") +
    `\nresultado-demo.ts: caso ${caso.id}, ${declarados} declarados / ${caso.pontos} contados`,
);
