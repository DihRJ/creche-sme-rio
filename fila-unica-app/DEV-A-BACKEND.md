# Dev A · Backend

**Sua missão:** a API inteira, o banco, o seed com dado real da SME e o upload de comprovante.
Você é a única pessoa que escreve em `server/`.

**Você NÃO faz:** nenhuma tela, nenhum CSS, nenhum componente React. Se o front pedir um ajuste de
formato, ajuste o endpoint — não vá mexer no `web/`.

**Seus arquivos** (ninguém mais toca): `server/**`, e leitura de `contracts/api.ts`.

---

## Já está pronto para você

- **O banco.** Projeto Neon "Creche SME RIO" (`curly-shadow-00730359`, org Jarom), PostgreSQL
  18.6, região `us-east-2`, banco `neondb`, role `neondb_owner`. O workspace está vinculado e
  fixado na branch **`dev`**. O `server/.env` já tem tudo — inclusive `JWT_SEGREDO` gerado.
  Confira com `npm run verifica`
- `server/package.json`, `server/tsconfig.json`, `server/.env.exemplo`
- `server/src/contracts.gen.ts` (cópia do contrato; regerada por `npm run sync`)
- `server/dados/` com os arquivos reais: `unidades.json` (836 unidades com fila, ociosas, turmas,
  bairro, CRE e geo), `regua.json` (a régua oficial, 13 critérios de 2025 com os pesos reais),
  `casos.json` e `explicacoes.json` (60 casos de auditoria com explicação já gerada)

---

## Cronograma

### 0:20 → 1:00 · Banco de pé e catálogo no ar

- [ ] `npm run verifica` antes de tudo. Se falhar, é problema de rede, não de código
- [ ] `src/db.ts` — **dois** pools, e a distinção não é decorativa:
      `pool` (runtime) usa `DATABASE_URL` (pooled) e `poolDireto` (DDL, seed, migração) usa
      `DATABASE_URL_UNPOOLED`. Helper `sql<T>(texto, params): Promise<T[]>`
- [ ] `src/schema.sql` — DDL completo (tabela abaixo). Roda no boot pelo **`poolDireto`**,
      `CREATE TABLE IF NOT EXISTS`
- [ ] `src/seed.ts` — idempotente (`ON CONFLICT DO NOTHING`), lê de `dados/`:
  - `unidade` e `oferta` a partir de `unidades.json`. **Atenção:** `unidade.codigo` é string de 7
    dígitos com zero à esquerda. Ler como number quebra o join e não avisa
  - `historico_oferta` com `fila`, `matriculou`, `ociosas`, `turmas` do processo 2025
  - `criterio` a partir de `regua.json`, filtrando `ano = 2025` (são 13)
  - `processo` (2026) e `fase_calendario` (5 fases, datas fictícias plausíveis)
- [ ] **E4** `GET /api/processo`, **E5** `GET /api/criterios`, **E6** `GET /api/ofertas`

**Pronto quando** `curl /api/ofertas?busca=freguesia` devolve unidade com histórico preenchido.
Avise o Dev B em voz alta: é o insumo da tela mais pesada dele.

### 1:00 → 1:40 · Sessão e inscrição

- [ ] `src/auth.ts` — JWT HS256, `exigeAuth` como middleware. Login sem senha: CPF + nascimento
- [ ] **E1** cadastro, **E2** login, **E3** `GET /me`
- [ ] **E7** `POST /inscricoes` (cria rascunho), **E8** `GET /inscricoes/:id`
- [ ] `montarInscricao(id)` — a função que devolve o `Inscricao` completo do contrato. **Escreva uma
      vez e reuse em E7, E8, E9, E10 e E14.** Todo endpoint de inscrição devolve o objeto inteiro,
      para o front nunca precisar remontar estado

### 1:40 → 2:20 · Opções, critérios e pontuação

- [ ] **E9** `PUT /inscricoes/:id/opcoes` — substitui tudo, ordem = ordem do array.
      Rejeita: mais de 5 (`LIMITE_OPCOES`), oferta repetida, oferta de outro grupamento/turno
- [ ] **E10** `PUT /inscricoes/:id/criterios` — substitui as declarações e dispara o cruzamento
- [ ] `src/mock-cruzamento.ts` — RF2.2 simulado, **determinístico**:

```ts
// Confirma pela base sem depender de documento. Determinístico: o mesmo CPF dá
// sempre o mesmo resultado, então a demonstração repete igual.
// Taxa por critério = a meta do PRD (>=85%), não os 6,8% de hoje.
const TAXA_BASE: Record<number, number> = { 28: 88, 6: 85, 29: 70 }; // CadÚnico, Bolsa Família, irmão
export function confirmadoPelaBase(cpf: string, codigoCriterio: number): boolean {
  const taxa = TAXA_BASE[codigoCriterio] ?? 0;
  const h = [...`${cpf}:${codigoCriterio}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return h % 100 < taxa;
}
```

- [ ] Pontuação: `pontos_que_contam` soma só `confirmado_base` e `documento_pendente`;
      `pontos_declarados` soma tudo que foi declarado. **A diferença entre os dois é o argumento
      inteiro do projeto** e o Dev C mostra na tela

### 2:20 → 3:00 · Documentos e finalização

- [ ] **E11** upload `multipart` com `multer` em `memoryStorage`, gravando em `documento.conteudo`
      (`bytea`). Valide `MAX_ARQUIVO_BYTES` e `MIMES_ACEITOS` do contrato → `ARQUIVO_INVALIDO`
- [ ] **E12** remover documento, **E13** baixar (autenticado: dono ou 403)
- [ ] **E14** `POST /inscricoes/:id/finalizar`:
  - bloqueia por: nenhuma opção, dados da criança incompletos, já enviada
  - **não bloqueia** por critério sem documento. Marca `nao_comprovado`, e escreve em `pendencias`
    quantos pontos a família está deixando na mesa (RF2.4)
  - gera `numero_sorteio = HMAC-SHA256(SEMENTE_PROCESSO, inscricao_id)`, hex, 8 primeiros caracteres

### 3:00 → 3:30 · Seed de demonstração e resultado

- [ ] ~10 famílias fictícias a partir de `dados/casos.json`, com alocação, nota de corte e a
      explicação real de `dados/explicacoes.json`. **É o que faz a tela de resultado ter conteúdo
      verdadeiro no pitch.** CPFs de demonstração previsíveis, anotados no README
- [ ] **E15** `GET /inscricoes/:id/resultado`
- [ ] Se sobrar: **E16** `PUT /me/contatos` (versiona, nunca faz `UPDATE`)

### 3:30 → 4:00 · Congelamento

Nenhuma feature nova. Só correção do que a integração revelar.

---

## Esquema do banco

Nomes iguais aos de `../PLANO.md` §4, para o MVP não criar vocabulário paralelo.

| Tabela | Colunas | Nota |
| --- | --- | --- |
| `processo` | `ano PK, situacao, max_opcoes, semente` | seed: 2026 |
| `fase_calendario` | `processo_ano, tipo, titulo, inicio, fim` | 5 fases |
| `unidade` | `codigo PK text, nome, tipo, bairro, cre, microarea, lat, lng` | **codigo é text(7)** |
| `oferta` | `id PK, unidade_codigo FK, grupamento, turno, vagas_no_processo` + `UNIQUE(unidade,grup,turno)` | |
| `historico_oferta` | `oferta_id FK, processo_ano, vagas, fila, matriculou, ociosas, nota_de_corte` | só 2025 |
| `criterio` | `id PK, processo_ano, codigo, texto, pontos, e_desempate, exige_documento, ordem` | 13 reais |
| `responsavel` | `id PK, cpf UNIQUE, nome, nascimento` | |
| `contato` | `id PK, responsavel_id FK, canal, valor, versao, ativo` | versionado, sem `UPDATE` |
| `crianca` | `id PK, cpf UNIQUE, nome, nascimento, responsavel_id FK` | |
| `inscricao` | `id PK, processo_ano, crianca_id FK, grupamento, turno, situacao, numero_sorteio, enviada_em` + `UNIQUE(processo_ano, crianca_id)` | INV1 |
| `opcao` | `id PK, inscricao_id FK, ordem, oferta_id FK` + `UNIQUE(inscricao,ordem)` + `UNIQUE(inscricao,oferta)` | máx 5 |
| `resposta_criterio` | `id PK, inscricao_id FK, criterio_id FK, declarado, situacao` + `UNIQUE(inscricao,criterio)` | |
| `documento` | `id PK, resposta_criterio_id FK, nome_arquivo, mime, tamanho, conteudo bytea, enviado_em` | |
| `rodada` | `id PK, processo_ano, numero, tipo, executada_em` | seed |
| `alocacao` | `id PK, rodada_id FK, inscricao_id FK, oferta_id FK, posicao_preferencia, origem` | seed |
| `nota_corte` | `rodada_id FK, oferta_id FK, pontos, candidatos, capacidade, lotada` | seed |
| `explicacao` | `rodada_id FK, inscricao_id FK, texto, origem` | seed |
| `evento_auditoria` | `id PK, entidade, entidade_id, acao, autor_id, antes jsonb, depois jsonb, em` | toda mutação |

Índices: `oferta(unidade_codigo)`, `unidade(bairro)`, `opcao(inscricao_id)`,
`resposta_criterio(inscricao_id)`.

---

## Armadilhas que já custaram caro nesta base

1. **`unidade.codigo` como número.** Zero à esquerda some, o join morre em silêncio e você perde
   40 minutos. `String(x).padStart(7, "0")`, sempre.
2. **Bairro sujo.** `JACAREPAGUÁ` e `JACAREPAGUA` são o mesmo bairro. Normalize (sem acento, caixa
   alta, espaço colapsado) antes de agrupar ou filtrar.
3. **Contar linha em vez de criança.** Uma inscrição gera até 5 opções. Todo indicador conta
   `crianca_id` distinto, senão infla ~2,4×.
4. **Envelope.** Toda resposta usa `{ok:true,data}` ou `{ok:false,erro}` com o status HTTP de
   `STATUS_POR_ERRO`. Um endpoint devolvendo objeto cru quebra o cliente do front inteiro.
5. **Limite do body.** `express.json({ limit: "1mb" })` e o upload por `multer`, não por JSON base64.
6. **Pooled × direta.** DDL por conexão pooled falha de forma intermitente e a mensagem não ajuda.
   `schema.sql`, `seed.ts` e qualquer `ALTER` vão pelo `DATABASE_URL_UNPOOLED`; só o runtime da API
   usa o `DATABASE_URL`.
7. **Scale-to-zero.** O compute do Neon suspende após ~5 min ocioso, e a primeira consulta depois
   disso custa algumas centenas de ms. Medi 1,3s no primeiro `select` frio. Avise o front: é cold
   start, não bug. Some depois da segunda consulta.
8. **Você está na branch `dev`.** É de propósito: `production` serve a demonstração pública e não
   deve receber o seed até o schema estabilizar. `neon branches list` mostra as duas, e
   `neon checkout production` troca (e repuxa o `.env`) quando chegar a hora.

---

## Regra de corte, se atrasar

Nesta ordem, sacrifique: **E16** (contatos) → **E15** (resultado) → **E12** (remover documento).
**Nunca** sacrifique E6 (ofertas com histórico), E10 (critérios) ou E14 (finalizar): são o pitch.
