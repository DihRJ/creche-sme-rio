# Dev C · ferramenta de fixtures

O kit de UI e as fixtures **já foram migrados** para `web/`. Sobrou aqui só o gerador,
que continua sendo a fonte do mock.

| Onde vive agora | O quê |
| --- | --- |
| `web/src/ui/tema.css` | tokens de cor e estilos do kit, claro e escuro |
| `web/src/ui/index.tsx` | Botao, Campo, Chip, ChipSituacao, Aviso, Carregando, Vazio, Passos, ProvedorTema, BotaoTema |
| `web/src/api/glossario.ts` | **gerado** — jargão em português simples + taxa de validação |
| `web/src/api/resultado-demo.ts` | **gerado** — caso real de 2025 com a explicação do Claude |

O kit é **autocontido**: CSS puro, sem Tailwind e sem dependência nova no
`package.json`. O `ui/index.tsx` importa o próprio `tema.css`, então nenhum arquivo
do Dev B (`index.css`, `vite.config.ts`, `package.json`) precisa mudar para ele
funcionar. Classes prefixadas com `fu-` para não colidir com o CSS do template.

## Regerar o mock

```bash
node devc/gerar-fixtures.mjs      # escreve web/src/api/{glossario,resultado-demo}.ts
```

Rode isto depois de mexer em `server/dados/*.json`. Os arquivos têm cabeçalho
avisando que são gerados, porque a próxima execução sobrescreve edição manual.

**Não gera `mock.ts`.** Aquele arquivo é o mock da API inteira, do Dev B, ligado ao
`client.ts` — critérios, ofertas e processo saem de lá. Estes dois módulos só
acrescentam o que as telas do Dev C precisam e o mock não tem: a explicação em
português simples de cada critério em jargão, a taxa de validação de 2025, e um
resultado real para o E15, que no mock é um stub. A chave é sempre o `codigo` da
régua, nunca o `id`, para não depender do formato que o mock escolheu (`crit-28`).

## De onde vem o dado

Nada é inventado — o brief pede fixture realista porque mock com "Lorem ipsum"
esconde problema de layout:

| No módulo | Vem de | O que revela |
| --- | --- | --- |
| Taxa de validação dos 13 critérios | `server/dados/regua.json`, ano 2025 | CadÚnico vale 51 de 100 pontos e validou 6,8% |
| Caso classificado + explicação | `casos.json`, `explicacoes.json` | 56 pontos declarados, 0 contados |

As 9 explicações em português simples são escritas à mão, no próprio gerador: a
régua da SME é escrita em linguagem administrativa, e "família monoparental" não é
português que a mãe na fila do posto entenda. O gerador imprime quais critérios
ficaram sem ajuda, para nenhum jargão passar batido.

## Cronograma do brief

- [x] 0:20 → 0:50 · kit de UI, fixtures, tokens de tema — **migrado para `web/`**
- [x] 0:50 → 1:50 · `web/src/telas/Vulnerabilidades.tsx` — **integrada**, rota já aponta para ela
- [x] 1:50 → 2:50 · `web/src/telas/Documentos.tsx` — **integrada**, rota já aponta para ela
- [x] 2:50 → 3:30 · `web/src/telas/MinhaInscricao.tsx` — **integrada**: situação, sorteio,
      criança, as 5 opções, a linha do tempo (E4) e o resultado (E15)
- [ ] 3:30 → 4:00 · troca do mock pela API real, acessibilidade, teste em 360px
