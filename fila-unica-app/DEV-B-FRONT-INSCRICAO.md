# Dev B · Frontend — fluxo de inscrição

**Sua missão:** o caminho que a família percorre do login até a inscrição enviada, e em especial a
**tela de escolha de unidades**, que é a que carrega o pitch.

**Você é dona do scaffold.** Crie `web/` nos primeiros minutos e **commite imediatamente**, porque o
Dev C está bloqueado até a pasta existir. Depois disso, pastas disjuntas.

**Seus arquivos:** `web/` (config), `web/src/api/**`, `web/src/auth.tsx`, `web/src/telas/Entrar.tsx`,
`Cadastrar.tsx`, `DadosDaCrianca.tsx`, `EscolherUnidades.tsx`, `Revisar.tsx`, e o roteador.

**Você NÃO faz:** `Vulnerabilidades.tsx`, `Documentos.tsx`, `MinhaInscricao.tsx` nem `web/src/ui/**`
— são do Dev C. Precisa de um botão? Peça, ou faça um provisório **dentro do seu arquivo**.

---

## Cronograma

### 0:20 → 0:50 · Scaffold (todo mundo depende disto)

```bash
cd fila-unica-app
npm create vite@latest web -- --template react-ts
cd web && npm install
npm install react-router-dom tailwindcss @tailwindcss/vite
```

- [ ] `vite.config.ts`: `plugins: [react(), tailwindcss()]`
- [ ] `src/index.css`: `@import "tailwindcss";`
- [ ] `package.json`: os scripts `sync`, `dev` e `build` (estão no `README.md`)
- [ ] `src/api/client.ts` — `chamar<T>(rota, opts): Promise<T>`, injeta `Authorization`, desembrulha
      o envelope, **lança `ErroApi`** em `ok:false`. Alterna com o mock por
      `import.meta.env.VITE_USAR_MOCK`
- [ ] `src/api/mock.ts` — o Dev C traz as fixtures; você pluga
- [ ] Roteador com as 7 rotas e um `<Layout>` com banner de demonstração
- [ ] **COMMIT E AVISE.** Este é o desbloqueio do Dev C

### 0:50 → 1:30 · Entrar e cadastrar

- [ ] `Cadastrar.tsx` (**E1**) — nome, CPF, nascimento, telefone, e-mail
- [ ] `Entrar.tsx` (**E2**) — CPF + nascimento, sem senha. Aviso de ambiente de demonstração
- [ ] `auth.tsx` — contexto com token em `localStorage`, `<RotaProtegida>`, `useSessao()`
- [ ] Máscara e validação de CPF no cliente (só formato; o servidor decide o resto)

### 1:30 → 1:55 · Dados da criança

- [ ] `DadosDaCrianca.tsx` (**E7**) — nome, CPF, nascimento, grupamento e turno
- [ ] Sugira o grupamento a partir da data de nascimento, mas deixe editável
- [ ] Trate `CPF_JA_INSCRITO` com mensagem clara: uma inscrição ativa por criança (RF1.1)
- [ ] Componente `Passos` no topo: Criança › Unidades › Vulnerabilidade › Documentos › Revisão

### 1:55 → 3:00 · EscolherUnidades — a tela do pitch

É a maior janela do cronograma porque é a tela que resolve o gargalo G3: hoje a família escolhe às
cegas e 42% das opções vão para fora do bairro, muitas para unidades lotadas.

- [ ] Busca por nome e filtro por bairro (**E6**, paginado)
- [ ] **Cartão da unidade** mostrando, do processo de 2025:
      `fila` · `vagas ociosas` · `matriculados` · `turmas`, rotulado **"processo 2025"**
- [ ] Um sinal visual honesto por unidade: fila grande e zero ociosa = concorrida; ociosa > 0 =
      teve vaga sobrando. **Não invente probabilidade de entrar** — mostre o número
- [ ] Seleção de até 5, com **reordenação por setas ↑ ↓** (drag-and-drop é corte, ver abaixo)
- [ ] **Aviso permanente da ordem vinculante:** "a ordem importa. O sistema tenta a 1ª primeiro, e
      só passa para a seguinte se não houver vaga para a sua pontuação." É a regra R1 e é o que
      diferencia esta inscrição da atual
- [ ] Salvar com **E9** a cada mudança (o endpoint substitui tudo, é idempotente)
- [ ] `LIMITE_OPCOES` → desabilite o botão de adicionar ao chegar em 5, com explicação

### 3:00 → 3:30 · Revisar e finalizar

- [ ] `Revisar.tsx` — criança, as 5 opções na ordem, e o resumo de pontuação:
      **pontos que contam × pontos declarados**. Se houver diferença, diga em português quantos
      pontos estão sendo perdidos e por quê (peça o bloco pronto ao Dev C)
- [ ] **E14** finalizar → tela de sucesso com o **número de sorteio**
- [ ] Renderize `pendencias` como lista de avisos. Elas **não** bloqueiam o envio

### 3:30 → 4:00 · Integração real

- [ ] `VITE_USAR_MOCK=false`, percorrer tudo contra a API publicada
- [ ] Rodar o percurso do `README.md` inteiro, em janela anônima, modo celular

---

## O que você consome do contrato

`Sessao`, `Me`, `Crianca`, `Oferta`, `Unidade`, `HistoricoOferta`, `OpcaoEscolhida`, `Inscricao`,
`Processo`, `Fase`, `CorpoCadastro`, `CorpoLogin`, `CorpoNovaInscricao`, `CorpoOpcoes`,
`FiltroOfertas`, `PaginaOfertas`, `MAX_OPCOES`, `ROTULO_GRUPAMENTO`, `ROTAS`.

Todo endpoint de inscrição devolve o **`Inscricao` inteiro**. Guarde a resposta e re-renderize a
partir dela; não remonte estado no cliente.

---

## Armadilhas

1. **`npm create vite` recusa pasta com arquivos.** `web/` foi deixada vazia de propósito. Não crie
   nada dentro dela antes de rodar o comando.
2. **`codigo` da unidade é string** com zero à esquerda. Não converta para número em lugar nenhum.
3. **Mobile primeiro de verdade** (RNF1): a família acessa por celular, em rede móvel, muitas vezes
   em aparelho antigo. Desenhe na largura de 360px e só depois expanda.
4. **Não bloqueie a tela inteira em carregamento.** Lista de 836 unidades pede paginação e estado
   de carregamento local no cartão.

---

## Regra de corte, se atrasar

Nesta ordem: **drag-and-drop** (fique nas setas) → **mapa** (não estava no escopo, não comece) →
**filtro por CRE** → **paginação bonita** (um botão "carregar mais" resolve).
**Nunca** corte: o histórico no cartão, o aviso da ordem vinculante, e o finalizar.
