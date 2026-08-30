-- Fila Única · esquema do MVP.
-- Roda no boot pela conexão DIRETA (poolDireto). Idempotente.
-- Nomes iguais aos de PLANO.md §4, para o MVP não criar vocabulário paralelo.

-- ─────────────────────────── processo e régua ───────────────────────────

create table if not exists processo (
  ano          integer primary key,
  situacao     text    not null default 'inscricao',
  max_opcoes   integer not null default 5,
  -- Semente do número de sorteio. Publicada junto do calendário, antes do fim
  -- das inscrições: é o que torna o desempate verificável por terceiro (AD-6).
  semente      text    not null,
  criado_em    timestamptz not null default now()
);

create table if not exists fase_calendario (
  id           uuid primary key default gen_random_uuid(),
  processo_ano integer not null references processo(ano) on delete cascade,
  tipo         text    not null check (tipo in ('inscricao','rodada_1','rodada_2','remanescentes','matricula')),
  titulo       text    not null,
  inicio       date    not null,
  fim          date    not null,
  unique (processo_ano, tipo)
);

create table if not exists criterio (
  id               uuid primary key default gen_random_uuid(),
  processo_ano     integer not null references processo(ano) on delete cascade,
  -- perg_id da régua oficial da SME.
  codigo           integer not null,
  texto            text    not null,
  pontos           integer not null check (pontos >= 0),
  e_desempate      boolean not null default false,
  exige_documento  boolean not null default true,
  ordem            integer not null,
  unique (processo_ano, codigo)
);

-- ─────────────────────────── catálogo de oferta ───────────────────────────

create table if not exists unidade (
  -- Sete dígitos, com zero à esquerda. TEXT, nunca integer: ler como número
  -- faz o zero sumir e o join morre em silêncio.
  codigo     text primary key check (length(codigo) = 7),
  nome       text not null,
  tipo       text,
  bairro     text,
  cre        integer,
  microarea  numeric,
  lat        double precision,
  lng        double precision,
  -- Colunas de busca normalizadas (sem acento, caixa alta). A família digita
  -- "jacarepagua" no teclado do celular e precisa achar "Jacarepaguá".
  nome_busca   text not null default '',
  bairro_busca text not null default ''
);

-- Para bancos já criados antes destas colunas existirem.
alter table unidade add column if not exists nome_busca   text not null default '';
alter table unidade add column if not exists bairro_busca text not null default '';

create table if not exists oferta (
  id                uuid primary key default gen_random_uuid(),
  unidade_codigo    text    not null references unidade(codigo) on delete cascade,
  grupamento        text    not null check (grupamento in ('BERCARIO','MATERNAL I','MATERNAL II')),
  turno             text    not null check (turno in ('Integral','Parcial')),
  vagas_no_processo integer not null default 0,
  unique (unidade_codigo, grupamento, turno)
);

-- O histórico publicado é da UNIDADE, não da oferta: a base anonimizada da SME
-- agrega fila e ociosidade por unidade e não quebra por grupamento e turno.
-- Guardamos na granularidade em que o dado existe e não inventamos rateio.
create table if not exists historico_unidade (
  id             uuid primary key default gen_random_uuid(),
  unidade_codigo text    not null references unidade(codigo) on delete cascade,
  processo_ano   integer not null,
  vagas          integer not null default 0,
  fila           integer not null default 0,
  matriculou     integer not null default 0,
  ociosas        integer not null default 0,
  turmas         integer not null default 0,
  nota_de_corte  integer,
  unique (unidade_codigo, processo_ano)
);

-- ─────────────────────────── família ───────────────────────────

create table if not exists responsavel (
  id          uuid primary key default gen_random_uuid(),
  cpf         text not null unique check (length(cpf) = 11),
  nome        text not null,
  nascimento  date not null,
  criado_em   timestamptz not null default now()
);

-- Contato é VERSIONADO, nunca sobrescrito (RF1.5). Corrigir contato é inserir
-- versão nova e desativar a anterior: sem contato válido não há convocação (G4).
create table if not exists contato (
  id              uuid primary key default gen_random_uuid(),
  responsavel_id  uuid not null references responsavel(id) on delete cascade,
  canal           text not null check (canal in ('telefone_principal','telefone_alternativo','email')),
  valor           text not null,
  versao          integer not null default 1,
  ativo           boolean not null default true,
  atualizado_em   timestamptz not null default now()
);

create table if not exists crianca (
  id              uuid primary key default gen_random_uuid(),
  cpf             text not null unique check (length(cpf) = 11),
  nome            text not null,
  nascimento      date not null,
  responsavel_id  uuid not null references responsavel(id) on delete cascade
);

-- ─────────────────────────── inscrição ───────────────────────────

create table if not exists inscricao (
  id              uuid primary key default gen_random_uuid(),
  processo_ano    integer not null references processo(ano),
  crianca_id      uuid not null references crianca(id) on delete cascade,
  grupamento      text not null check (grupamento in ('BERCARIO','MATERNAL I','MATERNAL II')),
  turno           text not null check (turno in ('Integral','Parcial')),
  situacao        text not null default 'rascunho'
                  check (situacao in ('rascunho','enviada','classificada','convocada','matriculada','nao_alocada')),
  numero_sorteio  text,
  data_inscricao  timestamptz not null default now(),
  enviada_em      timestamptz,
  -- INV1: uma inscrição por criança por processo. É metade da correção do G1.
  unique (processo_ano, crianca_id)
);

create table if not exists opcao (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references inscricao(id) on delete cascade,
  ordem         integer not null check (ordem between 1 and 5),
  oferta_id     uuid not null references oferta(id),
  unique (inscricao_id, ordem),
  unique (inscricao_id, oferta_id)
);

create table if not exists resposta_criterio (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references inscricao(id) on delete cascade,
  criterio_id   uuid not null references criterio(id),
  declarado     boolean not null default false,
  situacao      text not null default 'nao_declarado'
                check (situacao in ('nao_declarado','confirmado_base','documento_pendente','nao_comprovado')),
  unique (inscricao_id, criterio_id)
);

create table if not exists documento (
  id                    uuid primary key default gen_random_uuid(),
  resposta_criterio_id  uuid not null references resposta_criterio(id) on delete cascade,
  nome_arquivo          text not null,
  mime                  text not null,
  tamanho               integer not null,
  -- No MVP o arquivo mora no banco: o disco do Render é efêmero e isso elimina
  -- bucket e credencial. Em produção vai para object storage (PLANO.md AD-18).
  conteudo              bytea not null,
  enviado_em            timestamptz not null default now()
);

-- ─────────────────────────── rodada e resultado ───────────────────────────

create table if not exists rodada (
  id            uuid primary key default gen_random_uuid(),
  processo_ano  integer not null references processo(ano),
  numero        integer not null,
  tipo          text not null check (tipo in ('R1','R2','REMANESCENTE')),
  executada_em  timestamptz not null default now(),
  unique (processo_ano, numero)
);

create table if not exists alocacao (
  id                    uuid primary key default gen_random_uuid(),
  rodada_id             uuid not null references rodada(id) on delete cascade,
  inscricao_id          uuid not null references inscricao(id) on delete cascade,
  oferta_id             uuid not null references oferta(id),
  posicao_preferencia   integer,
  origem                text not null default 'emparelhamento'
                        check (origem in ('emparelhamento','remanescente')),
  -- INV3: no máximo uma alocação por criança por rodada. A outra metade do G1.
  unique (rodada_id, inscricao_id)
);

-- A prova de estabilidade: a pior prioridade entre os que ficaram na oferta.
create table if not exists nota_corte (
  id          uuid primary key default gen_random_uuid(),
  rodada_id   uuid not null references rodada(id) on delete cascade,
  oferta_id   uuid not null references oferta(id),
  pontos      integer not null,
  candidatos  integer not null default 0,
  capacidade  integer not null default 0,
  lotada      boolean not null default false,
  unique (rodada_id, oferta_id)
);

create table if not exists explicacao (
  id            uuid primary key default gen_random_uuid(),
  rodada_id     uuid not null references rodada(id) on delete cascade,
  inscricao_id  uuid not null references inscricao(id) on delete cascade,
  texto         text not null,
  origem        text not null default 'molde' check (origem in ('molde','modelo')),
  unique (rodada_id, inscricao_id)
);

-- ─────────────────────────── auditoria ───────────────────────────

-- Append-only. Toda mutação de contato, conferência e rodada passa por aqui (RNF4).
create table if not exists evento_auditoria (
  id           bigserial primary key,
  entidade     text not null,
  entidade_id  text not null,
  acao         text not null,
  autor_id     uuid,
  antes        jsonb,
  depois       jsonb,
  em           timestamptz not null default now()
);

-- ─────────────────────────── índices ───────────────────────────

create index if not exists ix_oferta_unidade      on oferta(unidade_codigo);
create index if not exists ix_unidade_bairro      on unidade(bairro_busca);
create index if not exists ix_unidade_nome        on unidade(nome_busca);
create index if not exists ix_historico_unidade   on historico_unidade(unidade_codigo);
create index if not exists ix_opcao_inscricao     on opcao(inscricao_id);
create index if not exists ix_resposta_inscricao  on resposta_criterio(inscricao_id);
create index if not exists ix_crianca_responsavel on crianca(responsavel_id);
create index if not exists ix_contato_responsavel on contato(responsavel_id) where ativo;
create index if not exists ix_inscricao_crianca   on inscricao(crianca_id);
create index if not exists ix_auditoria_entidade  on evento_auditoria(entidade, entidade_id);
