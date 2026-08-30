/**
 * Glossário e taxa de validação dos critérios — GERADO por `devc/gerar-fixtures.mjs`.
 * Não edite à mão: a próxima geração sobrescreve.
 *
 * Complementa o `mock.ts` (e, depois, o E5 da API real), que devolve `codigo`,
 * `texto` e `pontos` mas não tem nem a explicação em português simples nem o
 * histórico de validação. Chaveado por `codigo` da régua, então funciona igual
 * contra o mock e contra o servidor.
 */

/** Uma linha em português simples para os critérios escritos em jargão. */
export const AJUDA_CRITERIO: Record<number, string> = {
  "18": "Doença de longa duração e grave, na criança ou em quem mora com ela.",
  "20": "Família monoparental é a família em que uma pessoa só cria a criança — em geral a mãe ou o pai, sem companheiro.",
  "23": "Pessoa que veio de outro país fugindo de guerra ou perseguição.",
  "25": "Pai, mãe ou responsável legal com deficiência.",
  "27": "A criança ficou na fila do ano passado e não conseguiu vaga.",
  "28": "O CadÚnico é o cadastro do governo para programas sociais. Se a família já está inscrita, a prefeitura confirma sozinha.",
  "29": "Irmão já matriculado em creche ou escola da prefeitura, ou em unidade parceira.",
  "30": "Pai, mãe ou responsável com menos de 18 anos.",
  "31": "Criança com deficiência, transtorno do espectro autista ou altas habilidades."
};

/**
 * Percentual do que foi declarado e efetivamente validado no processo de 2025.
 *
 * É o achado central do projeto: o CadÚnico vale 51 dos 100 pontos da régua,
 * foi declarado por dezenas de milhares de famílias e validou em 6.8%.
 * Por isso 93% das inscrições entram na fila com zero ponto.
 */
export const VALIDACAO_2025: Record<number, number> = {
  "6": 7.3,
  "12": 9.9,
  "16": 11.9,
  "17": 18.2,
  "18": 13.4,
  "20": 9.3,
  "23": 6.2,
  "25": 10.7,
  "27": 12.1,
  "28": 6.8,
  "29": 6,
  "30": 7,
  "31": 13.3
};
