# Do Dev B para o time · o que fechou e o que sobrou

Resposta ao [`PARA-DEV-B.md`](PARA-DEV-B.md), mais o que a integração e o percurso na
URL pública revelaram. Tudo abaixo está **na `dev` e no ar**, salvo onde marcado.

---

## 1. Os dois itens do `PARA-DEV-B.md` estão fechados

Obrigado pelo relatório: a raiz que vocês apontaram estava certa, e apontar a raiz em
vez do sintoma economizou o trabalho todo.

| Pedido | Onde ficou |
| --- | --- |
| `chamar<Me>` em vez de `chamar<{responsavel}>`, guardando os três campos | `web/src/auth.tsx` — o contexto agora guarda o `Me` inteiro, com `recarregar()` |
| Destino pós-login pelas quatro regras | `web/src/destino.ts`, `destinoPosLogin()` |
| Inferir a etapa do rascunho pelo que o E8 devolve | `etapaDoRascunho()`, com as quatro condições do documento |
| Tela `/inscricoes` como destino padrão | `web/src/telas/Inscricoes.tsx` |
| Situação legível em vez do enum | `ROTULO_SITUACAO` + `EXPLICACAO_SITUACAO` |
| Pontuação no cartão, com o alerta quando há diferença | feito, e é a razão de a tela existir |
| Botão de documentos em **qualquer** situação | feito, com o motivo comentado no arquivo |
| Ações por situação, botão de nova inscrição, estado vazio | feito |

Commit: `683af99`. Regressão em 12 asserções cobrindo os quatro destinos.

**Uma coisa que não deu para honrar por inteiro.** A tabela pede
`convocada → "Responda até <prazo>"`, mas o contrato não expõe prazo: o `expira_em`
vive na `convocacao`, que não está no `Inscricao`. Ficou "Responda dentro do prazo
para não perder a vaga". Fechar isso exige campo novo no contrato, que está congelado.

### Podem reverter a concessão da prosa

Vocês escreveram que cederam e mudaram o texto do servidor para o meu teste passar.
**A asserção em prosa já não existe** — foi trocada por conferência de número no
commit `27438e1`, antes de o documento chegar:

```ts
ok(insc.pontuacao.pontos_declarados - insc.pontuacao.pontos_que_contam === semBase.pontos, …)
```

O acoplamento com a frase acabou. Escrevam o texto que quiserem.

---

## 2. Três bugs que só a URL pública revelou, já corrigidos

**Corrida no E9, com perda silenciosa de escolha.** O E9 substitui a lista inteira, e
o payload era montado a partir do estado local, que só atualiza quando a resposta
chega. Durante a gravação só o cartão clicado ficava desabilitado. Resultado: um
segundo toque antes da resposta mandava a lista velha e **apagava a escolha
anterior, sem erro nenhum**. Uma família em rede móvel tocando em duas creches
rápido perdia uma. Localhost esconde; o percurso na URL pública entrou com 3 de 5
creches num roteiro que clicou cinco vezes. Corrigido em `1a21a86`, provado com um
teste que clica cinco vezes sem espera.

**Acessibilidade: o texto de ajuda dentro do `<label>`.** Ele entrava no nome
acessível do campo, então o leitor de tela anunciava "Grupamento preencha a data de
nascimento e sugerimos o grupamento" como se fosse o nome do campo. Agora vai por
`aria-describedby`. Vale como aviso para `src/ui/`: dá para checar rodando um seletor
por rótulo e vendo se ele casa com mais de um elemento.

**Sessão salva jogada no login.** O redirect da raiz decidia antes do `/me`
responder, então quem abria a URL com sessão válida caía em `/entrar`.

---

## 3. Para a trilha do backend · um bug silencioso no Windows

`npm run limpar`, `npm run seed` e `npm run seed-demo` **rodam, não imprimem nada e
não fazem nada** em máquina Windows. O guard de módulo principal nunca casa:

```
import.meta.url       file:///C:/…/src/limpar.ts     (três barras, barras normais)
file://${argv[1]}     file://C:\…\src\limpar.ts      (duas barras, contrabarras)
```

Em `limpar.ts:21`, `seed.ts:157` e `seed-demo.ts:206`. Correção de uma linha, e o
`engines` já pede Node ≥ 22:

```ts
if (import.meta.filename === process.argv[1]) {
```

Enquanto isso, dá para contornar chamando a função exportada direto. **Isso importa
porque o `AGENTS.md` manda rodar `npm run limpar` entre execuções do smoke:** quem
seguir a instrução em Windows vai ver `CPF_JA_INSCRITO` e concluir que a API está
quebrada, que é exatamente o que o documento avisa que não é.

**Detalhe menor, mesma família.** O 404 padrão do Express volta HTML, sem o envelope
que a armadilha nº 4 do brief exige. Eu blindei o lado do web, traduzindo o status
para o código do contrato, mas a raiz continua aí: falta um handler no fim do
`index.ts`.

---

## 4. Estado do app, verificado

O percurso está completo: as três telas do Dev C integradas, o E15 chegando na
`MinhaInscricao` com a explicação real, e o marcador provisório apagado.

```
build                                    ✓
npm run smoke      (contra a API real)   TODAS PASSARAM
npm run integracao (contra a API real)   SEM DIVERGENCIA DE CONTRATO
regressão da retomada pós-login          TODAS PASSARAM
percurso visual em 360px                 sem erro de console
```

Há três scripts em `web/` que valem para todos:

| Comando | O que faz |
| --- | --- |
| `npm run smoke` | percorre o fluxo contra o mock, ou contra a API real com `VITE_API_URL` |
| `npm run integracao` | checa campo por campo o que o contrato promete. CPFs aleatórios, não precisa de `limpar` |
| `npm run build` | inclui `tsc -b`, então pega divergência de tipo antes do deploy |

---

## 5. O que ainda falta, na ordem em que eu faria

1. **Acordar a API uns 2 minutos antes do pitch.** Plano free dorme após ~15 min e
   leva ~50s. Um jurado olhando tela branca por 50 segundos custa mais que qualquer
   bug desta lista.
2. **Percorrer a URL pública com olho humano**, janela anônima, modo celular. Eu
   rodei automatizado e sem erro de console, mas isso não substitui alguém olhando.
3. **Corrigir o guard** dos três scripts (seção 3).
4. **Decidir o texto do `PITCH.md` e do `EMAIL.md`** sobre a premissa da Fase 3: 3.020
   das 4.595 crianças do número anunciado entram por uma oferta em creche que a
   família não escolheu, e a simulação assume 100% de aceite, enquanto o AD-8 define
   essa oferta como convite recusável. Sem essa premissa a aceitação zero, o ganho é
   +1.575 — que ainda é positivo e vem só do emparelhamento. A tabela de
   sensibilidade está em `PRD.md` §5 e sai de `pipeline/07_sensibilidade.py`.
5. **Limpar de produção** o responsável `70712559274` e a criança `70712559275`, nomes
   "Percurso Teste", que o meu percurso criou. Não apaguei porque o `limpar` derruba
   as dez contas de demonstração junto.

---

## Contas de demonstração em produção

`90000000001` a `90000000010`, nascimento `1992-04-15`. Confirmei que o E15 devolve
explicação real (`origem: "modelo"`) para a primeira delas.

Mais as duas do `PARA-DEV-B.md`: `11122233305` (rascunho) e `11122233300` (enviada).
