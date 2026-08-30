# Dev C · Frontend — vulnerabilidade, documentos e acompanhamento

**Sua missão:** as telas que carregam o achado central do projeto. Hoje, 93% das inscrições entram
na fila com zero ponto porque a comprovação de vulnerabilidade quase nunca é validada: o CadÚnico,
que sozinho vale 51 dos 100 pontos, foi declarado por 35.141 famílias e validado em **6,8%**. Suas
telas são a resposta a isso.

**Você depende do Dev B** para a pasta `web/` existir (~minuto 50). Até lá, escreva componentes e
fixtures em arquivos soltos e cole depois.

**Seus arquivos:** `web/src/ui/**`, `web/src/telas/Vulnerabilidades.tsx`, `Documentos.tsx`,
`MinhaInscricao.tsx`, e as fixtures de `web/src/api/mock.ts`.

**Você NÃO faz:** roteador, `auth.tsx`, nem as telas do Dev B.

---

## Cronograma

### 0:20 → 0:50 · Kit de UI e fixtures (antes da pasta existir)

- [ ] `Botao`, `Campo`, `Chip`, `Aviso`, `Carregando`, `Vazio`, `Passos` — sem dependência de rota
- [ ] Fixtures do mock com **dado realista**, tirado de `server/dados/regua.json` (os 13 critérios
      reais com os pesos reais) e `server/dados/unidades.json`. Mock com dado plausível revela
      problema de layout que mock com "Lorem ipsum" esconde
- [ ] Tokens de cor por variável CSS, tema claro e escuro. Contraste WCAG AA (RNF6)

### 0:50 → 1:50 · Vulnerabilidades — a tela do achado

- [ ] Lista dos 13 critérios (**E5**), cada um com **o valor em pontos ao lado**. A família precisa
      ver que o CadÚnico vale 51
- [ ] Marcar/desmarcar → **E10**. O servidor devolve a `situacao` de cada um
- [ ] **Estado item a item** (RF2.3), com rótulo e cor distintos:
  - `confirmado_base` → **"Confirmado pela base. Você não precisa enviar documento."** ← RF2.2, e é
    o momento mais forte da demonstração
  - `documento_pendente` → "Documento recebido. Será conferido no dia da matrícula."
  - `nao_comprovado` → "Falta o comprovante. Este critério **não vai pontuar**."
- [ ] Contador permanente no rodapé: **"Sua pontuação: X. Você declarou Y."** Quando X < Y, diga em
      uma frase quantos pontos estão sendo perdidos e o que fazer. É o RF4.3 antecipado para a
      inscrição, e é o coração do projeto/btw 
- [ ] Nada de jargão: "família monoparental" ganha uma linha de explicação em português simples

### 1:50 → 2:50 · Documentos

- [ ] Para cada critério `documento_pendente`, um cartão de envio (**E11**)
- [ ] **Foto pelo celular:** `<input type="file" accept="image/*,application/pdf" capture="environment">`.
      A maioria vai fotografar o documento, não escolher arquivo
- [ ] Miniatura da imagem (`URL.createObjectURL`), nome e tamanho do arquivo
- [ ] Remover (**E12**), baixar (**E13**, autenticado — o `<img>` precisa do token, use `fetch` +
      `createObjectURL`, não `src` direto)
- [ ] Erros: acima de 5 MB e tipo não aceito → `ARQUIVO_INVALIDO`, com mensagem em português
- [ ] Barra de progresso de upload, ou ao menos estado desabilitado. Em rede móvel, upload de foto
      demora e sem retorno visual a família clica de novo

### 2:50 → 3:30 · MinhaInscricao

- [ ] Situação da inscrição, número de sorteio, criança e as 5 opções na ordem
- [ ] **Linha do tempo do calendário** (**E4**): inscrição, rodada 1, rodada 2, remanescentes,
      matrícula, com a fase atual destacada. Resolve o G6: hoje a família descobre o prazo ao ser
      chamada
- [ ] Se houver resultado (**E15**): onde a criança ficou, **a nota de corte da unidade que ela
      queria contra a pontuação dela** (RF4.1), e a explicação em texto
- [ ] Se um critério declarado não foi comprovado, a explicação diz com todas as letras quantos
      pontos ele valeria (RF4.3). O texto vem pronto do servidor — **não escreva regra no cliente**

### 3:30 → 4:00 · Integração e acessibilidade

- [ ] Trocar mock por API real
- [ ] Foco visível, `aria-label` nos ícones, `alt` nas miniaturas, navegação por teclado
- [ ] Testar em 360px de largura

---

## O que você consome do contrato

`Criterio`, `RespostaCriterio`, `SituacaoCriterio`, `ROTULO_SITUACAO_CRITERIO`, `DocumentoResumo`,
`Inscricao`, `Processo`, `Fase`, `Resultado`, `CorpoCriterios`, `MAX_ARQUIVO_BYTES`,
`MIMES_ACEITOS`, `ROTAS`.

---

## Armadilhas

1. **`pontos_que_contam` × `pontos_declarados`.** Não some pontos no cliente. O servidor manda os
   dois números prontos; sua tela só mostra a diferença.
2. **`GET /documentos/:id` exige token**, então `<img src={url}>` devolve 401. Busque com `fetch` e
   crie um object URL.
3. **`capture` no input** só funciona em celular; no desktop cai no seletor de arquivo. É o
   comportamento correto, não é bug.
4. **Não bloqueie a finalização** por documento faltando. Critério sem lastro não pontua (RF2.4),
   mas a inscrição vai assim mesmo. Quem bloqueia é o servidor, e ele não bloqueia por isto.

---

## Se sobrar tempo — E16, atualizar dados cadastrais

O primeiro item da fila de folga, e é seu porque cabe dentro de `MinhaInscricao`.

Hoje o contato cadastrado **não pode ser corrigido** e é preciso ir à unidade. Resultado: 5.994
crianças convocadas e não matriculadas em 2025, cerca de 44 mil de 2021 a 2025 (gargalo G4). Uma
tela de edição de telefone e e-mail, com salvamento em **E16**, é o item de maior retorno por minuto
gasto que sobrou fora do MVP.

- [ ] Formulário com telefone principal, telefone alternativo e e-mail
- [ ] `PUT /me/contatos` — o servidor **versiona**, não sobrescreve (RF1.5)
- [ ] Mostrar "atualizado em ..." ao lado de cada contato

---

## Regra de corte, se atrasar

Nesta ordem: **tema escuro** → **miniatura** (deixe só nome e tamanho) → **linha do tempo** (vire
uma lista simples) → **MinhaInscricao** inteira, se for preciso.
**Nunca** corte: os três estados por critério, o rótulo "não precisa enviar documento" do
`confirmado_base`, e o contador de pontos perdidos. São o pitch.
