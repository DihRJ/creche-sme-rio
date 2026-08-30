# Claude Impact Lab Rio 2 — Desafio SME-Rio (30/08/2026)

**Grupo 22** (Diego, Carol, Jaron, Lucas). Entrega: **repo público + e-mail para eventos@taicor.ai até 16h30.**
Finalistas anunciados 17h30, 6 min de pitch + 6 min de Q&A.

Repos: brief `taicor-ai/claude-impact-lab-rio-2` → `./brief` · dados `CIT-SME-RJ/dadoscreche` → `./dados`

## Nota final = Impacto×8 + Produto×4 + Engenharia×4 + Ideia×2 + Apresentação×2
Impacto Real vale 40% e a pergunta é literal: **"a prefeitura usaria isso amanhã?"**

## O problema (3 eixos, segundo a SME)
1. **Planejamento da oferta** — hoje ancorado na fila do ano anterior. Vagas ociosas e filas gigantes convivem no mesmo território.
2. **Inscrição/classificação** — família escolhe até 5 unidades livremente, sem critério territorial. **A classificação é por OPÇÃO, não por criança.**
3. **Convocação** — manual, feita pelo diretor, contato desatualizado, prazo de 3 dias por convocação, em cascata.

## Números que levantei da base (2025, dados anonimizados)

| Fato | Valor |
|---|---|
| Crianças convocadas que **perderam a vaga** (cancelado na confirmação, sem confirmar em nenhuma opção) | **5.994 (11% dos convocados)** |
| Mesmo número em 2021 | 10.274 (26%) — melhorou, mas ainda sangra |
| Total 2021–2025 de crianças convocadas e perdidas | **~44.000** |
| Opções em lista de espera | 16.345 |
| Unidades com **zero fila** (e com matrículas) | **359** |
| Unidades com fila ≥ 100 | 36 (maior fila: 765) |
| Opções escolhidas **fora do bairro** da família | 42% |

**Descompasso dentro do próprio bairro (2025):** Bangu = 273 na fila + 12 unidades sem fila.
Campo Grande = 85 na fila + 23 unidades sem fila. Curicica = 1.269 na fila e só 1 unidade sem fila.

## Armadilhas dos dados (já mapeadas)
- `situacao` = `Cancelado na confirmacao` **sem cedilha e sem til**.
- `04_UnidadesEscolares` **não tem header** e `esc_codigo` precisa ser lido como **string com zero à esquerda** (`zfill(7)`) — senão o join morre.
- Só **522 das 872** unidades da Query A casam com o catálogo de endereços. Lat/long fica em `OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx`.
- Bairro vem sujo: `JACAREPAGUÁ` vs `JACAREPAGUA`, `PRAÇA SECA` vs `PRACA SECA`. Normalizar acento + trim.
- QueryB tem 4,3M linhas — usar DuckDB, não Excel/pandas em memória.
- **A régua de pontuação mudou entre 2023 e 2024** (deficiência caiu de 100 → 25 pontos). Série temporal sem normalizar isso é falsa.
- Uma criança gera até 5 linhas por ano → sempre agregar por `aluno_anon` antes de contar gente.
