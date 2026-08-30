# Para o Dev B · um bug e uma tela que falta

Escrito pela dupla que tocou o backend (Dev A), depois de testar o app publicado.
Leia com o agente na sua máquina — ele tem contexto do repositório em [`AGENTS.md`](AGENTS.md).

**Nada aqui é problema de API.** Os dois itens abaixo têm a mesma raiz e o backend já entrega o
dado necessário. Verifiquei a resposta crua em produção antes de escrever.

---

## A raiz comum: o `/me` é buscado e jogado fora

`src/auth.tsx:31`

```ts
chamar<{ responsavel: Responsavel }>(ROTAS.me)
  .then((me) => vivo && setResponsavel(me.responsavel))
```

O tipo declarado é `{ responsavel: Responsavel }`, mas o endpoint devolve `Me`, que tem **três**
campos. `criancas` e `inscricoes` chegam na resposta e são descartados no `.then`.

Resposta real de `GET /me` em produção, para o CPF `11122233305`:

```jsonc
{
  "responsavel": { "id": "...", "nome": "Outra Responsavel", "contatos": [ ... ] },
  "criancas":    [ { "id": "982ba7a1…", "nome": "Bia Teste", "cpf": "99988877766", … } ],
  "inscricoes":  [ { "id": "4c14921d…", "situacao": "rascunho", "processo_ano": 2026,
                     "crianca": { … } } ]
}
```

O tipo `Me` está em `contracts.gen.ts` e já descreve isso. Trocar o genérico de
`chamar<{ responsavel: Responsavel }>` para `chamar<Me>` e guardar os três campos no contexto
resolve a origem dos dois itens abaixo.

---

## 1. BUG · depois do login, a família cai em "cadastrar nova criança"

`src/telas/Entrar.tsx:29`

```ts
navegar(local.state?.de ?? "/inscricao/nova", { replace: true });
```

O destino é incondicional. Quem já tem inscrição é jogado na tela de cadastrar criança, como se
nunca tivesse se inscrito.

**Como reproduzir.** Em https://fila-unica-web.onrender.com, entre com CPF `11122233305`,
nascimento `1990-01-01`. Essa conta tem a Bia Teste com inscrição em `rascunho`. Você cai em
`/inscricao/nova`.

**Por que importa mais do que parece.** A família que fecha o app no meio da inscrição volta e não
encontra o que preencheu. Ela vai tentar cadastrar a mesma criança de novo e bater em
`CPF_JA_INSCRITO`, sem entender o motivo — beco sem saída para quem está no celular, com dados
móveis, no meio do expediente. É o gargalo G4 do PRD reaparecendo por outro caminho.

**Regra sugerida**, depois de `entrar()`:

| Estado vindo do `/me` | Destino |
| --- | --- |
| Alguma inscrição em `rascunho` | Retomar de onde parou (ver "etapa" abaixo) |
| Só inscrições `enviada`/`classificada`/… | `/inscricoes` (a tela nova, item 2) |
| Mais de uma inscrição | `/inscricoes` |
| Nenhuma inscrição | `/inscricao/nova` |

Para retomar um rascunho, dá para inferir a etapa com o que `GET /inscricoes/:id` já devolve:

- `opcoes.length === 0` → `/inscricao/:id/unidades`
- tem opções, nenhuma resposta com `declarado: true` → `/inscricao/:id/vulnerabilidades`
- tem critério `documento_pendente` ou `nao_comprovado` sem documento → `/inscricao/:id/documentos`
- resto → `/inscricao/:id/revisar`

Se preferir algo mais simples: mandar sempre para `/inscricao/:id/unidades` já resolve o beco sem
saída, porque a partir dali a navegação é linear.

---

## 2. FALTA · tela com todas as inscrições

Hoje não existe rota nem tela que liste as inscrições. `src/App.tsx` vai de `/entrar` direto para
`/inscricao/nova`, e não há caminho de volta para uma inscrição já criada a não ser digitar a URL
com o id na mão.

**O que a tela precisa ter** (rota sugerida: `/inscricoes`, e virar o destino padrão pós-login):

- **Um cartão por inscrição**, com nome da criança, grupamento e turno, e a situação em destaque
- **Situação legível**, não o enum cru:

  | `situacao` | O que a família precisa entender |
  | --- | --- |
  | `rascunho` | "Não enviada. Termine antes do fim do prazo." |
  | `enviada` | "Enviada. Número de sorteio X. Aguardando o resultado." |
  | `classificada` | "Resultado saiu." |
  | `convocada` | "Você foi chamada. Responda até \<prazo\>." |
  | `matriculada` | "Matrícula efetivada." |
  | `nao_alocada` | "Sem vaga nesta rodada. Você continua na fila." |

- **Ações por cartão**, conforme a situação:
  - `rascunho` → **Continuar inscrição** (leva à etapa em que parou)
  - qualquer uma → **Enviar/ver documentos** (`/inscricao/:id/documentos`)
  - qualquer uma → **Ver detalhes** (`/inscricao/:id`)
- **Pontuação visível no cartão**: `pontos_que_contam` e, quando diferente, `pontos_declarados`.
  Se houver diferença, o alerta de pontos a menos — é o argumento central do produto e a família
  precisa dar de cara com ele, não descobrir dentro de uma sub-tela
- **Botão de nova inscrição**, levando a `/inscricao/nova`
- **Estado vazio** com um caminho claro para a primeira inscrição

**Documentos depois de enviada.** Importante e fácil de errar: o backend **permite anexar documento
mesmo com a inscrição já enviada**. É deliberado — E11, E12 e E13 não exigem `rascunho`, ao
contrário de E9 e E10. A família pode regularizar a comprovação depois de enviar, e é isso que
ataca a validação em 6,8%. Então o botão de documentos aparece em qualquer situação, não só em
rascunho.

### Endpoints, todos já no ar

| Uso | Chamada |
| --- | --- |
| Lista de inscrições | `GET /me` → campo `inscricoes` |
| Detalhe de uma | `GET /inscricoes/:id` → `Inscricao` completo, com `pontuacao` e `pendencias` |
| Anexar documento | `POST /inscricoes/:id/criterios/:criterioId/documento` (multipart, campo `arquivo`) |
| Remover | `DELETE /documentos/:id` |
| Baixar | `GET /documentos/:id` — **exige token**, use `fetch` + `createObjectURL`, não `src` direto |

O `inscricoes` do `/me` é resumo (`id`, `situacao`, `crianca`, `processo_ano`). Para pontuação e
pendências no cartão, chame `GET /inscricoes/:id` por inscrição — a família tem uma ou duas, não
cem.

---

## Contas para testar em produção

Login é **CPF + data de nascimento**, sem senha.

| CPF | Nascimento | Estado |
| --- | --- | --- |
| `11122233305` | `1990-01-01` | Bia Teste, **rascunho**, 0 opções — reproduz o bug |
| `11122233300` | `1994-05-02` | Ana Teste, **enviada**, 5 opções, sorteio `da65f8f2` |

Ou cadastre-se do zero: validamos só o formato do CPF (11 dígitos), não o dígito verificador.

- App: https://fila-unica-web.onrender.com
- API: https://fila-unica-api.onrender.com/api

A API hiberna após ~15 min de inatividade e leva ~50s para acordar. Se a primeira chamada demorar,
é isso — não é bug.

---

## Uma coisa que aprendemos e vale para você

O smoke em `web/smoke/percurso.ts` faz asserção na substring `"pontos a menos"`, que é **prosa do
servidor**. Nós cedemos e mudamos o texto para o teste passar, mas o acoplamento continua frágil:
qualquer melhoria na frase quebra o teste. Vale trocar por conferência de número:
`pontuacao.pontos_declarados - pontuacao.pontos_que_contam`.

Para rodar o smoke contra a API real em vez do mock, e a limpeza obrigatória entre execuções, veja
[`AGENTS.md`](AGENTS.md).
