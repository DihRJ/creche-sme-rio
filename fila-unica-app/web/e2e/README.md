# `e2e` — os testes que rodam num navegador de verdade

Complementam os de `../smoke/`, que exercitam a camada de dados sem navegador. Estes
abrem Chromium em **360px**, que é a largura de alvo do RNF1, e capturam o console.

Foi essa passada que achou as coisas que typecheck e teste de lógica não pegam:

| Achado | Onde estava |
| --- | --- |
| Texto de ajuda dentro do `<label>` entrava no nome acessível do campo | `provisorio-ui.tsx` |
| Nome de unidade cortado em "EDI PROFESSO...", duas unidades indistinguíveis | `EscolherUnidades.tsx` |
| Aviso preso no topo comendo 300px de um viewport de 780 | `EscolherUnidades.tsx` |
| "0 de 0 pontos" com a frase "tudo que você declarou tem lastro" | `Revisar.tsx`, `Inscricoes.tsx` |
| **Corrida no E9 apagando escolha em silêncio** | só apareceu contra a URL pública |
| Sessão salva sendo jogada no login | `App.tsx` |

## Instalação

O Playwright **não está no `package.json` de propósito**: o pacote baixa navegador no
`postinstall`, e isso entraria no `npm ci` do Render sem servir para nada lá.

```bash
npm i --no-save playwright && npx playwright install chromium
```

## Rodar

```bash
node e2e/percurso.mjs     # percurso inteiro, uma captura por etapa, console capturado
node e2e/retomada.mjs     # destino pós-login: os 4 casos + precedência da rota de origem
node e2e/corrida.mjs      # clica 5x sem espera e exige 5 de 5 (regressão da corrida do E9)
```

Contra a API real ou contra a URL pública, aponte `URL_APP`:

```bash
URL_APP=http://localhost:5173 node e2e/retomada.mjs
URL_APP=https://fila-unica-web.onrender.com node e2e/percurso.mjs
```

Sem `URL_APP` é `localhost:5173`. Se o `web` local estiver sem `VITE_API_URL`, ele fala
com o mock, e aí nada disso toca banco.

## Dois avisos

**Contra a URL pública, o `percurso.mjs` escreve no banco de produção**: cria
responsável, criança e inscrição. Os CPFs são sorteados e os nomes dizem "Percurso
Teste"; ele imprime os CPFs no fim para dar para limpar depois. Não rode isso por
hábito.

**Contra a API real, rode a limpeza antes do `retomada.mjs`** se ele já tiver rodado —
veja o `AGENTS.md`. O `corrida.mjs` e o `percurso.mjs` usam CPF sorteado e não
precisam.

As capturas vão para `e2e/capturas/`, que não é versionada.
