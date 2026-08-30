/**
 * Resultado de demonstração — GERADO por `devc/gerar-fixtures.mjs`.
 * Não edite à mão: a próxima geração sobrescreve.
 *
 * Caso real do processo de 2025 (`aluno_0012265`), com a explicação real gerada
 * pelo Claude sobre os números do motor. É o passo 7 do percurso de demonstração.
 *
 * Existe porque o `mock.ts` responde o E15 com um stub — a classificação não roda
 * no mock. Quando a API real classificar, isto sai e a tela passa a ler o E15.
 */
import type { Resultado } from "../contracts.gen";

/** 56 pontos declarados, 0 contados: a diferença é o argumento do projeto. */
export const PONTOS_DECLARADOS_DEMO = 56;
export const PONTOS_QUE_CONTAM_DEMO = 0;

export const RESULTADO_DEMO: Resultado = {
  alocada: true,
  oferta: null,
  posicao_preferencia: 2,
  explicacao: "A família declarou três critérios importantes: a espera em fila no ano anterior (2 pontos), doenças crônicas graves no núcleo familiar (3 pontos) e a inscrição no CadÚnico (51 pontos). Nenhum desses critérios foi validado pela documentação até o momento, por isso eles não contaram na pontuação final, que ficou em 0 ponto. Ainda assim, a criança conseguiu vaga na CP CRECHE COMUNITÁRIA ALEGRIA DA CRIANÇA, sua segunda opção, já que a nota de corte dessa unidade também foi 0, então a pontuação da família foi suficiente para a aprovação ali. Não foi possível conseguir a primeira opção, o CM DOUTOR ANTÔNIO MONTEIRO, pois essa unidade teve mais candidatos do que vagas e todas as 51 crianças inscritas acabaram preenchendo a capacidade. Recomendo que a família regularize o quanto antes a documentação referente ao CadÚnico e aos demais critérios declarados, pois isso pode ser revisto e, se validado, poderá contar em futuras chamadas ou reclassificações.",
  origem_explicacao: "modelo",
  detalhe_opcoes: [
  {
    "ordem": 1,
    "unidade": "CM DOUTOR ANTÔNIO MONTEIRO",
    "capacidade": 51,
    "candidatos": 51,
    "nota_de_corte": 0,
    "sua_pontuacao": 0,
    "conseguiu": false
  },
  {
    "ordem": 2,
    "unidade": "CP CRECHE COMUNITÁRIA ALEGRIA DA CRIANÇA",
    "capacidade": 20,
    "candidatos": 20,
    "nota_de_corte": 0,
    "sua_pontuacao": 0,
    "conseguiu": true
  }
],
};
