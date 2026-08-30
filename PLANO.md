# Plano de implementação — Fila Única

**Como sair do protótipo validado para o sistema que substitui o módulo de Inscrição Creche da SME-Rio.**
Documento de engenharia que acompanha o [PRD](PRD.md). Versão 0.1 · 30 de agosto de 2026.

> O PRD define **o quê** e **por quê**. Este documento define **como**, **em que ordem** e,
> principalmente, **o que se perde em cada escolha**. Toda decisão de arquitetura aqui vem com o
> custo que ela cobra, porque um plano que só lista vantagens não é um plano, é uma peça de venda.

---

## Sumário

1. [Ponto de partida: o que já existe e o que dele sobrevive](#1-ponto-de-partida)
2. [Decisões de arquitetura](#2-decisões-de-arquitetura) — AD-1 a AD-20, com tradeoffs
3. [Padrões de código](#3-padrões-de-código)
4. [Entidades e correlações](#4-entidades-e-correlações)
5. [Invariantes do domínio](#5-invariantes-do-domínio)
6. [Fluxos críticos](#6-fluxos-críticos)
7. [Plano de execução por fase](#7-plano-de-execução-por-fase)
8. [Estratégia de testes e verificação](#8-estratégia-de-testes-e-verificação)
9. [Dívidas conhecidas do protótipo](#9-dívidas-conhecidas-do-protótipo)
10. [Riscos técnicos](#10-riscos-técnicos)
11. [Decisões que este plano deixa em aberto](#11-decisões-em-aberto)

---

## 1. Ponto de partida

O repositório de hoje é um **protótipo analítico**, não um esqueleto de produto. Separar as duas
coisas é a primeira decisão do plano, porque tratar código de análise como base de produção é a
forma mais comum de queimar a Fase 1.

| Artefato hoje | Natureza | Destino |
| --- | --- | --- |
| `pipeline/02_matching.py`, `04_cenarios.py` | Motor de aceitação diferida, validado sobre 5 anos de base real | **Sobrevive como especificação executável.** Vira `nucleo/` com tipos, testes e ordem total estrita |
| `pipeline/01_pontuacao.py` | Reconstrução da régua oficial ano a ano | **Sobrevive como fixture de teste.** Em produção a régua vem de tabela, não de engenharia reversa |
| `pipeline/05_casos.py` | Geração do insumo de auditoria (nota de corte, critérios declarados x validados) | **Sobrevive conceitualmente.** Vira o serviço de explicação (M4) |
| `pipeline/06_explicar.py` | Camada de explicação com Claude, em batch, no build | **Sobrevive quase inteiro.** Muda de "build do painel" para "pós-processamento de rodada" |
| `pipeline/03_export.py` | Agregados → JSON estático | **Descartado.** Vira consulta com filtro de escopo territorial |
| `app/` (Next.js export estático) | Painel de demonstração | **Descartado como aplicação.** Sobrevive o sistema visual: paleta validada para daltonismo, alternância gráfico/tabela, tema claro e escuro |

O que o protótipo prova e que o plano herda sem rediscutir: a aceitação diferida resolve as 62.899
crianças e as mais de 300 mil opções de um processo inteiro em um laptop, sem infraestrutura
especial; a régua da SME é reconstituível em tabela; e a explicação gerada sobre números do motor é
boa o bastante para balcão de atendimento.

O que o protótipo **não** prova e a Fase 0 tem que fechar: se os números se sustentam na base viva
de 2026, em especial a queda da validação de vulnerabilidade a 6,8%.

---

## 2. Decisões de arquitetura

Formato: contexto, decisão, alternativas descartadas, **o que se perde**, e o gatilho que obrigaria
a revisar. Decisão sem gatilho de revisão é dogma.

---

### AD-1 · Núcleo funcional puro, casca imperativa

**Contexto.** O motor precisa ser determinístico (RNF3) e auditável (RNF4). Todo acoplamento entre
regra de alocação e acesso a banco destrói as duas propriedades: deixa de ser possível rodar a
mesma entrada duas vezes e comparar.

**Decisão.** O pacote `nucleo/` não faz IO. Recebe estruturas de dados em memória (inscrições,
preferências, pontuações, capacidades, régua) e devolve estruturas de dados (alocações, notas de
corte, diagnóstico). Banco, fila, storage e integrações vivem em `adaptadores/`. A API orquestra.

```
nucleo/            sem import de banco, HTTP, relógio ou random global
  regua.py         pontuação a partir de critérios + versão da régua
  emparelhamento.py aceitação diferida com criança propondo
  remanescentes.py fase 3, oferta por proximidade
  invariantes.py   verificação de estabilidade e capacidade sobre um resultado
adaptadores/       postgres, storage, sms, email, push, datalake, receita, academico
api/               casos de uso, autorização, transação, auditoria
```

**Alternativas.** Motor como *stored procedure* no banco (rápido de escrever, impossível de testar
com propriedade e de versionar junto com a régua). Motor como serviço separado com API própria
(isola bem, mas cria um contrato de rede no caminho crítico da rodada, por nada — a rodada é um
job, não um pedido interativo).

**O que se perde.** Duplicação de estruturas: o mesmo conceito existe como linha de tabela e como
`dataclass` do núcleo, com um mapeamento no meio. É trabalho real e é a fonte mais provável de bug
de tradução. Aceitamos porque o preço da alternativa é perder o teste de propriedade sobre a
estabilidade, que é o argumento central perante órgão de controle.

**Gatilho de revisão.** Se o mapeamento passar de ~300 linhas ou se a rodada estourar RNF2 por
custo de serialização.

---

### AD-2 · Python no núcleo e no motor; TypeScript nas interfaces

**Contexto.** O motor validado é Python. As interfaces validadas são Next.js. Reescrever qualquer
um dos dois é custo sem ganho de produto.

**Decisão.** `nucleo/` e `api/` em Python 3.12 com FastAPI, Pydantic e SQLAlchemy. App da família e
painéis em TypeScript com Next.js, consumindo a API. Contrato OpenAPI gerado pela API e tipos do
cliente gerados a partir dele, para que uma mudança de campo quebre no build e não no balcão.

**Alternativas.** TypeScript de ponta a ponta, com o motor reescrito: um runtime a menos, mas joga
fora o único código já validado sobre cinco anos de base real e afasta o time de dados, que
trabalha em Python/DuckDB. Java ou .NET, que é o que costuma existir no parque municipal: melhor
aderência à operação de TI da prefeitura, muito pior aderência ao ferramental de análise que
produziu o diagnóstico.

**O que se perde.** Dois runtimes, dois gerenciadores de dependência, dois pipelines de build.
Precisa de disciplina de contrato entre eles, que é justamente a parte que o OpenAPI cobre.

**Gatilho de revisão.** Se a SME exigir aderência a um parque tecnológico fechado. Nesse caso o
`nucleo/` é o que se porta — são poucas centenas de linhas e é o que tem teste de propriedade para
provar a equivalência da porta.

> **Premissa a confirmar com a SME.** O PRD não fixa stack. Esta decisão foi tomada pelo critério
> "não jogue fora o que já está validado" e deve ser confirmada antes da Fase 1.

---

### AD-3 · Postgres transacional + trilha append-only, não *event sourcing*

**Contexto.** RNF4 exige autor, data e valor anterior para toda rodada, alteração de contato e
conferência de documento. É tentador concluir que o sistema deve ser *event sourced*.

**Decisão.** Postgres como banco transacional com estado corrente, mais duas estruturas append-only:
`evento_auditoria` (quem mudou o quê, valor antes e depois) e os **snapshots de rodada** (AD-4). A
escrita de auditoria acontece na mesma transação da mutação, por um decorador no caso de uso, nunca
por *trigger* de banco.

**Alternativas.** *Event sourcing* completo, com estado derivado de log: dá auditoria perfeita e
viagem no tempo de graça, ao custo de um modelo que a equipe de sustentação da SME não conhece e de
consultas de painel que ficam caras ou exigem projeções. Auditoria só por *trigger*: barato, mas o
*trigger* não sabe quem é o autor da ação de negócio, só o usuário de banco.

**O que se perde.** Não dá para reconstruir o estado do sistema em um instante arbitrário do
passado. Dá para reconstruir **qualquer decisão de rodada**, que é o requisito real do RF3.8. É
menos poder por muito menos complexidade.

**Gatilho de revisão.** Se aparecer exigência de reconstituir o estado completo em data arbitrária,
e não só o resultado das rodadas.

---

### AD-4 · A rodada roda sobre um snapshot imutável, nunca sobre as tabelas vivas

**Contexto.** RF3.8 e RNF3. Se o motor lê o banco enquanto famílias editam contato e o sistema
acadêmico sincroniza turma, duas execuções da mesma rodada dão resultados diferentes e a rodada
deixa de ser reconstituível.

**Decisão.** Executar uma rodada é: (1) congelar a entrada em um artefato imutável — inscrições,
preferências, pontuações, régua vigente, capacidades e calendário —; (2) calcular o hash SHA-256 do
artefato; (3) rodar o núcleo sobre ele; (4) persistir resultado, notas de corte e o mesmo hash.
Simulação (RF3.9) é exatamente isso sem o passo 4, e é por isso que ela é confiável: roda sobre o
mesmo snapshot que a execução real usaria.

Formato: Parquet particionado em *object storage*, com o manifesto em JSON no banco. Parquet porque
o núcleo já é Python/pandas e porque o mesmo artefato serve de insumo para o painel do nível central
e para a exportação em formato aberto do RF4.4.

**Alternativas.** Ler direto das tabelas com nível de isolamento serializável: mais simples, mas o
resultado deixa de ser reproduzível seis meses depois, quando as tabelas já mudaram. Guardar só a
saída: barato, e inútil — sem a entrada não se refaz a conta.

**O que se perde.** Armazenamento e um passo a mais no processo. Um snapshot de 63 mil crianças e
300 mil opções fica na casa de dezenas de megabytes; guardar todos de todos os processos é
irrelevante em custo. O passo a mais é o preço da auditabilidade e não é negociável.

**Gatilho de revisão.** Nenhum previsto. Esta é a decisão que sustenta o RF3.8 e a defesa perante
órgão de controle.

---

### AD-5 · Régua parametrizável em tabela versionada, sem linguagem de expressão

**Contexto.** RF3.3 pede mudar peso de critério sem tocar no motor. A régua já mudou na vida real:
a pergunta sobre deficiência valia 100 pontos até 2023 e passou a valer 25 em 2024.

**Decisão.** Duas tabelas: `regua_versao` (processo, vigência, publicação em Diário Oficial, hash) e
`regua_criterio` (critério, texto, pontos, se é desempate, ordem de desempate, fonte de validação
aceita: base automática, documento, ou ambas). A pontuação é soma de critérios com lastro. O
desempate é uma lista ordenada de critérios, depois a data de inscrição, depois o número de sorteio
(AD-6). Sem linguagem de expressão, sem condicional, sem fórmula digitada por usuário.

**Alternativas.** Uma DSL ou expressões tipo planilha, que cobre regra futura arbitrária ao custo de
transformar a régua em código não testado escrito por quem não programa — e de tornar o parecer
jurídico sobre a régua impossível de emitir. Régua no código, versionada em Git: perfeitamente
auditável e completamente inviável para um órgão que publica a régua em Diário Oficial e precisa
mudá-la sem *deploy*.

**O que se perde.** Régua com condicional real (por exemplo "vale 25 pontos se a criança tem irmão
na unidade **e** a família mora no bairro") não cabe no modelo e exige código. Aceitamos: é raro,
e quando acontece, mudança de norma dessa ordem merece revisão de engenharia mesmo.

**Gatilho de revisão.** O segundo critério que não couber na tabela sem gambiarra.

---

### AD-6 · Ordem total estrita e número de sorteio publicado

**Contexto.** **Este é o bug latente mais importante do protótipo.** Hoje a prioridade é
`(-pontos, -desempates, data_criacao)`. Empate nos três é possível e frequente: a maior parte das
inscrições tem zero ponto e a data de criação tem granularidade grosseira. Quando empata, o
resultado passa a depender da ordem em que a lista foi montada — e o RNF3 morre em silêncio.

**Decisão.** Toda inscrição recebe, no ato, um **número de sorteio** determinístico e verificável:
`HMAC-SHA256(semente_do_processo, id_da_inscrição)`, com a semente publicada junto do calendário,
antes do fim das inscrições. A chave de prioridade final é
`(−pontos, −desempate₁, …, −desempateₙ, data_de_inscrição, número_de_sorteio)`, uma ordem total
estrita. Com ordem estrita, o teorema vale: a aceitação diferida com a criança propondo produz **um
único** emparelhamento estável ótimo para as crianças, independente da ordem de processamento.

**Alternativas.** Desempatar por ordem de chegada até o fim: parece justo e cria corrida ao servidor
no primeiro minuto da inscrição, exatamente o comportamento que o RNF7 identifica como pico. Sorteio
aleatório em tempo de execução: quebra a reprodutibilidade, a não ser que a semente seja guardada —
e aí é o mesmo que a decisão acima, com menos transparência.

**O que se perde.** A família não pode mais melhorar posição chegando mais cedo dentro do prazo, o
que exige comunicação clara. Em troca, o sorteio é publicável, verificável por terceiro e não
premia quem tem internet melhor.

**Gatilho de revisão.** Se a norma fixar ordem de chegada como critério final de desempate. Nesse
caso, aumentar a precisão do carimbo de tempo e manter o sorteio como último desempate residual.

---

### AD-7 · Aceitação diferida com a criança propondo

**Contexto.** RF3.2. Há duas formas de rodar o algoritmo: a criança propõe ou a unidade propõe.

**Decisão.** A criança propõe.

**Por quê, e é o argumento que sustenta a mudança normativa R1.** O lado que propõe recebe o
emparelhamento estável que lhe é mais favorável. Com a criança propondo, o resultado é ótimo para as
crianças entre todos os estáveis, e — o ponto decisivo — declarar a preferência verdadeira é
estratégia dominante para a família. Sem isso, tornar a ordem vinculante (R1) seria pedir que a
família aposte: colocar em primeiro a creche que ela quer poderia custar a vaga na que ela
conseguiria. Com isso, não pode. **A ordem vinculante só é defensável porque o algoritmo é
estratégia-à-prova.** Isso precisa estar na comunicação com a família e na exposição de motivos da
norma.

**Alternativas.** Unidade propondo: resultado estável, ótimo para as unidades, e reintroduz o
incentivo a mentir na ordem. *Boston mechanism* (o que o processo atual faz na prática, um leilão
sequencial por opção): não é estável e pune quem declara preferência honesta.

**O que se perde.** Nada de substantivo. Vale registrar que "ótimo para as crianças" é ótimo no
conjunto dos emparelhamentos **estáveis**; existem emparelhamentos instáveis que colocam mais
crianças, e eles são inaceitáveis porque criam a família que vê outra com menos pontos entrar onde
ela não entrou. A Fase 3 (AD-8) recupera parte desse volume por fora, e por consentimento.

**Gatilho de revisão.** Nenhum. É o núcleo da proposta.

---

### AD-8 · Fase 3 fora do emparelhamento estável, por consentimento

**Contexto.** RF3.7 e R4. A vaga remanescente está em unidade que a família **não** escolheu. Ela
não pertence à lista de preferências e portanto não pertence ao problema de emparelhamento.

**Decisão.** A fase de remanescentes é um passo separado, guloso, ordenado pela mesma prioridade da
régua, que oferta a vaga mais próxima das unidades originalmente escolhidas, dentro de um raio
parametrizável. **A oferta é um convite, não uma alocação:** recusar não custa posição em nenhuma
fila (R6), e a vaga volta ao conjunto de remanescentes na hora.

**Alternativas.** Estender a lista de preferências com as unidades próximas e rodar tudo num
emparelhamento só: matematicamente mais elegante, e mente sobre a preferência da família — o
algoritmo passaria a poder **tirar** a criança de uma fila que ela escolheu para colocá-la numa que
ela nunca escolheu. Inaceitável, e é exatamente o risco "alocação empurra criança para longe de
casa" da seção 10 do PRD.

**O que se perde.** O resultado final deixa de ser globalmente estável no sentido estrito. O relatório
de rodada passa a declarar duas coisas separadas: o emparelhamento (estável, provado) e as ofertas
de remanescentes (aceitas por consentimento). A separação é honesta e é mais fácil de explicar do
que uma estabilidade sobre preferências inventadas.

**Gatilho de revisão.** Se a taxa de aceite das ofertas remanescentes vier muito alta (acima de ~80%),
vale testar incorporar as unidades próximas como cauda **opcional e declarada pela família** na
própria inscrição, o que devolve a fase ao emparelhamento sem inventar preferência.

---

### AD-9 · Catálogo de oferta vem do sistema acadêmico, não da demanda

**Contexto.** Dívida direta do protótipo. Hoje o identificador de vaga
(`unidade|grupamento|turno`) é derivado das linhas de inscrição: uma oferta só existe se alguma
família a escolheu. Consequência: **a unidade que ninguém escolheu é invisível**, e é exatamente
onde mora a ociosidade que a Fase 3 precisa preencher.

**Decisão.** `oferta` é entidade de catálogo, sincronizada do sistema de gestão acadêmica
(RF3.4), com capacidade por unidade × grupamento × turno, independente de existir demanda. A
capacidade entra no snapshot da rodada (AD-4) com carimbo da sincronização.

**O que se perde.** Dependência dura de uma integração que hoje não existe. Enquanto ela não
existir, a Fase 3 opera com cobertura parcial e o painel precisa declarar isso.

**Gatilho de revisão.** Nenhum. É correção de modelagem, não preferência.

---

### AD-10 · Convocação por *outbox*, canais atrás de porta, entrega ao menos uma vez

**Contexto.** RF5.1 a RF5.3: três canais simultâneos, registro de entrega e leitura, reenvio em 24h
e 48h. É onde estão as 5.994 crianças perdidas por ano.

**Decisão.** A alocação grava a convocação e as mensagens pendentes na **mesma transação**, em uma
tabela *outbox*. Um trabalhador separado despacha, com chave de idempotência por
`(convocacao, canal, tentativa)`. Cada canal é uma porta (`EnviadorSMS`, `EnviadorEmail`,
`EnviadorPush`) com implementação real e implementação de teste. *Webhooks* de entrega e leitura
atualizam `mensagem`; o escalonamento de 24h e 48h é um job que varre convocações sem resposta.

**Alternativas.** Chamar o provedor direto no fluxo da alocação: uma indisponibilidade de SMS
derruba a rodada. Fila externa desde o dia um (SQS, RabbitMQ): melhor no limite, mais peça para
operar; a tabela *outbox* em Postgres aguenta com folga o volume de um pico de convocação.

**O que se perde.** Entrega ao menos uma vez significa que a família pode receber a mesma mensagem
duas vezes numa falha de rede. É o lado certo do tradeoff: melhor duas mensagens do que nenhuma.

**Gatilho de revisão.** Se o *outbox* passar a exigir mais de um trabalhador com coordenação fina,
migrar para fila dedicada.

---

### AD-11 · Prazo em dias úteis, calculado no servidor, materializado na linha

**Contexto.** RF5.5: 3 dias úteis a partir do primeiro disparo, com contagem regressiva para família
e diretor, e a vaga não pode ficar travada além disso.

**Decisão.** Tabela `dia_nao_util` com o calendário municipal, mantida pela SME. No momento do
primeiro disparo o sistema calcula e **grava** `expira_em` (instante absoluto, UTC) na convocação.
Um job varre `expira_em < agora and status = 'aguardando'` e libera a vaga. A contagem regressiva é
renderizada no cliente a partir de `expira_em`, nunca do relógio do aparelho.

**Alternativas.** Calcular o prazo na leitura: qualquer mudança no calendário de feriados
reescreveria retroativamente prazos já comunicados à família. Inaceitável.

**O que se perde.** Se um feriado for decretado depois do disparo, o prazo gravado não se ajusta
sozinho e exige intervenção administrativa registrada. É o comportamento correto: o prazo que a
família viu é o prazo que vale.

---

### AD-12 · O modelo explica, com molde determinístico por baixo

**Contexto.** RF4.2 e RNF5. A explicação é a peça que torna o sistema adotável no balcão, e é
também a peça que não pode falhar nem vazar dado pessoal.

**Decisão.** Três camadas, nesta ordem de precedência:

1. **O motor produz os números.** Pontuação, nota de corte da unidade pretendida, quantas crianças
   tinham prioridade maior, quais critérios foram declarados e não comprovados e quantos pontos
   valeriam. Isso é `nucleo/`, é determinístico e é o que aparece na tela como dado.
2. **Um molde textual determinístico** compõe uma explicação correta, sem modelo nenhum. Feia,
   burocrática, sempre disponível.
3. **O Claude reescreve o molde** em português de servidor público. Roda em lote no
   pós-processamento da rodada, com o resultado persistido e servido como texto estático. Se o
   modelo falhar, expirar ou vier vazio, a família vê a camada 2. Nunca vê tela vazia.

Nenhum dado pessoal trafega: o insumo é código anônimo, pontuação, régua e nota de corte, como já
acontece em `pipeline/06_explicar.py`.

**Alternativas.** Gerar em tempo de requisição: latência e custo no caminho do balcão, e uma
indisponibilidade de API vira uma família sem resposta. Não usar modelo: sobra o texto burocrático,
que é justamente o que hoje não é compreendido no balcão.

**O que se perde.** Custo por rodada e uma etapa de revisão por amostragem antes de publicar. O
protótipo gastou cerca de US$ 0,32 para 60 casos; 63 mil casos com o mesmo prompt, em API de lote,
fica na ordem de baixas centenas de dólares por rodada. Barato para o que resolve, e mensurável.

**Gatilho de revisão.** Se a revisão por amostragem apontar erro factual em qualquer explicação.
Nesse caso o molde da camada 2 vira o padrão e a reescrita passa a ser opcional.

---

### AD-13 · Camada anticorrupção para toda integração, com modo degradado declarado

**Contexto.** RNF8: Receita, Data Lake, Registro Municipal Integrado e gestão acadêmica. São quatro
sistemas de terceiros no caminho de um processo com data marcada em Diário Oficial.

**Decisão.** Cada integração tem porta própria, contrato versionado, tradução explícita para o
vocabulário do domínio, e **modo degradado escrito no requisito**, não improvisado no incidente:

| Integração | Uso | Modo degradado |
| --- | --- | --- |
| Receita (CPF) | Validação na inscrição | Inscrição em estado `pendente_validacao`, prossegue e revalida em lote |
| Data Lake / RMI | Cruzamento automático de vulnerabilidade (RF2.2) | Cai para exigência de documento (RF2.4). Nunca para "não pontua" silencioso |
| Gestão acadêmica | Capacidade (RF3.4) | Última sincronização válida, com data exibida no painel do nível central e **bloqueio de execução de rodada** se estiver acima do limite de defasagem |
| SMS / e-mail / push | Convocação | Canais independentes; falha de um não impede os outros. SMS é o canal garantido (AD-15) |

**O que se perde.** Mais código do que chamar o serviço direto, e um conjunto de estados degradados
para testar. É o custo de não ter o processo da cidade parado por indisponibilidade de terceiro.

---

### AD-14 · Autorização por escopo territorial, aplicada na consulta

**Contexto.** Quatro públicos com recortes distintos: família (a própria criança), diretor (a
unidade), CRE (as unidades do território, 57 no caso da persona) e nível central (tudo).

**Decisão.** Todo caso de uso recebe um `Escopo` explícito derivado do usuário autenticado, e toda
consulta o recebe como parâmetro obrigatório — não como filtro opcional que alguém esquece.
Autenticação da família por gov.br; de servidores pelo diretório da prefeitura, com o perfil vindo
do diretório e o escopo vindo do cadastro de lotação.

**Alternativas.** *Row-level security* no Postgres: mais forte contra esquecimento, ao custo de
regra de negócio espalhada entre aplicação e banco e de depuração difícil. Vale reavaliar como
segunda camada depois que o modelo de escopo estabilizar.

**O que se perde.** Disciplina permanente de revisão: o dia em que alguém escrever uma consulta sem
escopo, vaza fila de outra unidade. Mitigação: teste de arquitetura que falha se qualquer repositório
expuser método sem parâmetro de escopo.

---

### AD-15 · PWA instalável, com SMS como canal garantido

**Contexto.** Decisão 12.1 do PRD, RNF1 e o risco "família sem smartphone".

**Decisão.** PWA instalável. Alcance em aparelho antigo, sem loja, sem ciclo de revisão, e
atualização imediata — que importa num processo com data marcada.

**O que se perde, e é concreto.** Notificação *push* na web em iOS só funciona com o PWA instalado
na tela de início, o que a maioria não fará. Por isso o RF5.1 dispara os três canais em paralelo e
**SMS é o canal com garantia contratual de entrega**; *push* é o bônus para quem instalou. O
planejamento de custo de convocação assume SMS para 100% da base, não para o resíduo.

**Gatilho de revisão.** Se a medição de entrega mostrar que o PWA instalado passa de metade da base,
reavaliar o mix de custo.

---

### AD-16 · Um processo, em memória, para a rodada inteira

**Contexto.** RNF2: menos de 10 minutos para 63 mil crianças, 872 unidades, 300 mil opções.

**Decisão.** A rodada roda em um processo único, com tudo em memória. A escala é pequena para
computação: o protótipo resolve um processo inteiro num laptop, e o custo por proposta é
logarítmico na capacidade da oferta. O tempo real da rodada é dominado por IO — montar o snapshot e persistir resultado, notas de corte e explicações.

**Otimização necessária, herdada do protótipo.** Hoje cada proposta faz `sort` na lista da unidade,
o que é O(n log n) por proposta. Em produção: *heap* com a pior prioridade no topo, o que dá O(log c)
por proposta. Não é problema de escala hoje, é higiene para não virar um.

**Alternativas.** Distribuir o emparelhamento: aceitação diferida é sequencial por natureza,
distribuir traria complexidade e não-determinismo para resolver um problema que não existe.

**O que se perde.** Um teto de escala em memória, na casa de alguns gigabytes. Fica a uma ordem de
grandeza da demanda da cidade.

---

### AD-17 · Proximidade por coordenada, com queda para bairro declarada no resultado

**Contexto.** RF3.7 depende de distância, e 348 das 872 unidades não têm coordenada no catálogo
público. O protótipo usa bairro como aproximação.

**Decisão.** PostGIS. Distância entre a unidade remanescente e a mais próxima das unidades escolhidas
pela família, com raio máximo parametrizável. Quando falta coordenada, cai para o bairro
normalizado, **e a oferta é marcada como `proximidade_aproximada`** — visível na oferta à família e
contabilizada no painel. Completar o cadastro de coordenadas é pré-requisito de Fase 3, como o PRD
já registra.

**O que se perde.** Duas qualidades de proximidade convivendo no mesmo processo. Preferimos declarar
a diferença a escondê-la sob uma média.

---

### AD-18 · Documento em *object storage*, com retenção e expurgo desde o primeiro dia

**Contexto.** RF2.1 e RNF5. Comprovante de vulnerabilidade é o dado mais sensível do sistema.

**Decisão.** Arquivo em *object storage* privado, nunca no banco. Acesso só por URL assinada de
curta duração, emitida pelo caso de uso que já validou o escopo. Varredura de malware na ingestão.
Prazo de retenção gravado na própria linha do documento no momento do upload, e job de expurgo
rodando desde o primeiro dia — não "depois que o processo estabilizar", porque expurgo que nasce
depois nunca nasce. Todo acesso a documento gera linha de auditoria.

**O que se perde.** Complexidade operacional (bucket, política, varredura, job) numa parte do
sistema que "só guarda foto". É o mínimo defensável para dado de criança em vulnerabilidade.

---

### AD-19 · Fase 1 em modo sombra, leitura apenas

**Contexto.** Roadmap Fase 1: rodar em paralelo ao processo vigente para comparação.

**Decisão.** Em modo sombra o sistema tem uma única fonte de escrita: ele mesmo, no seu banco. Lê
uma **réplica** do sistema atual, nunca a base viva, e não emite nenhuma comunicação para família ou
unidade. A saída é relatório comparativo. Um interruptor de configuração por processo separa sombra
de produção, e no modo sombra os adaptadores de SMS, e-mail e push são substituídos por
implementações que só registram.

**O que se perde.** O modo sombra não testa o caminho de convocação de verdade — só a Fase 2 testa.
Em compensação, ele valida o motor sobre a base viva sem nenhum risco para o processo real, que é a
condição para a SME topar a Fase 1.

---

### AD-20 · Vocabulário do domínio em português, em todas as camadas

**Contexto.** O código existente já é assim (`aluno`, `vaga_id`, `pontos`, `desempate`), a norma é em
português e os requisitos são discutidos com servidores que falam de "grupamento", "CRE",
"convocação" e "efetivação".

**Decisão.** Substantivos do domínio em português, sem acento em identificador, em todas as camadas
— banco, núcleo, API e interface. Infraestrutura técnica em inglês (`repository`, `handler`,
`retry`). Sem tradução no meio do caminho: `crianca` é `crianca` da tabela até a tela.

**O que se perde.** Mistura de idiomas no mesmo arquivo, que incomoda. Muito menos do que incomoda
um glossário implícito onde `enrollment` às vezes é inscrição e às vezes é matrícula — duas coisas
distintas neste domínio, separadas por uma convocação e por uma conferência de documento.

---

## 3. Padrões de código

Convenções que valem para todo o repositório. Cada uma existe por causa de um erro concreto, quase
sempre já cometido nas bases reais.

**P1 · Normalização de texto em um lugar só.** `nucleo/texto.py` expõe `normalizar()` (NFKD,
remoção de acento, caixa alta, colapso de espaço). Nenhum outro módulo normaliza por conta própria.
Motivo: `JACAREPAGUÁ` e `JACAREPAGUA` são o mesmo bairro, e `Cancelado na confirmacao` vem sem
cedilha e sem til na base real — filtrar com acento devolve zero linha e nada avisa.

**P2 · Código de unidade é *string* com zero à esquerda, sempre.** Tipo `CodigoUnidade` que valida
sete dígitos na construção. Motivo: ler como inteiro faz o *join* com o catálogo de unidades morrer
em silêncio.

**P3 · *Join* silencioso é proibido.** Toda junção com base externa verifica a contagem esperada e
falha alto quando o casamento cai fora da faixa. Um pipeline que devolve menos linhas do que deveria
sem reclamar é pior do que um que quebra.

**P4 · Contagem por criança, nunca por linha.** Uma criança gera até cinco linhas de opção. Toda
métrica de negócio conta `crianca_id` distinto. Métrica que conta linha infla tudo por cerca de 2,4×.
Vale como regra de revisão de código: todo `count(*)` em consulta de indicador precisa de
justificativa no *pull request*.

**P5 · Nada de aleatoriedade ou relógio dentro do núcleo.** Instante e semente entram como
parâmetro. É o que permite o teste de regressão sobre base histórica.

**P6 · Toda mutação passa por caso de uso, e caso de uso escreve auditoria.** Um decorador
`@auditado` grava entidade, ação, autor, valor anterior e novo, na mesma transação. Repositório não
é chamado direto pela camada HTTP.

**P7 · Estado é máquina de estados explícita, não booleano solto.** `situacao` como enum com
transições declaradas em tabela, e transição inválida levanta erro. Motivo: a base real tem
`Confirmado`, `Cancelado na confirmacao` e `Lista de espera` convivendo em uma coluna de texto livre,
e o significado de cada uma foi arqueologia.

**P8 · Migração de banco versionada, para frente, sem edição retroativa.** Alembic. Nenhuma migração
já aplicada em produção é editada.

**P9 · Toda saída pública nasce em formato aberto.** RF4.4 e RF6.5 não são um exportador que se
escreve no fim: o resultado de rodada é serializado em CSV/JSON/Parquet **antes** de virar tela, e a
tela lê o mesmo artefato. Assim publicidade e painel nunca divergem.

**P10 · Frontend: dado sensível não vai para o cliente.** O painel recebe agregado já filtrado por
escopo. Toda visualização tem tabela equivalente alternável (já implementado em
`app/src/components/ui.tsx`), paleta validada para daltonismo, tema claro e escuro por variável CSS,
e alvo WCAG 2.1 AA (RNF6).

**P11 · Teste de arquitetura como teste.** Falha o *build* se: `nucleo/` importar adaptador, banco,
`datetime.now` ou `random`; repositório expuser consulta sem parâmetro de escopo; caso de uso mutar
sem `@auditado`.

**P12 · Comentário explica a decisão, não a sintaxe.** O padrão do repositório atual é bom e se
mantém: comentários que registram por que o teto de turma é 25 (p90 observado) e por que capacidade
é "alocados no processo mais lugares fisicamente vazios" (não misturar fluxo com estoque) valem mais
que qualquer documentação separada.

---

## 4. Entidades e correlações

Notação: `1—N` um para muitos, `N—N` muitos para muitos, `1—1` um para um. Chaves naturais em
itálico onde importam.

### 4.1 Mapa geral

```
                    ┌───────────── processo (ano) ─────────────┐
                    │            │              │              │
              regua_versao   calendario_fase   rodada      historico_unidade
                    │                            │
              regua_criterio                     │
                                                 │
   crianca ──1—N── inscricao ──1—N── opcao ──N—1── oferta ──N—1── unidade ──N—1── cre
      │                │  │                          │
      │                │  └──1—N── resposta_criterio │
      │                │                │            │
      │                │           documento         │
      │                │                             │
      │                └──1—N── pontuacao ───────────┤
      │                                              │
      │                              capacidade_snapshot (por rodada)
      │                                              │
      └──N—N── responsavel                    alocacao ──1—1── convocacao ──1—N── mensagem
                    │                              │                  │
                 contato (versionado)              │           resposta_convocacao
                                                   │
                                              matricula ──1—N── conferencia_documento
                                                   │
                                              divergencia ──▶ reclassificacao

   evento_auditoria  ────────── referencia qualquer entidade acima (append-only)
   snapshot_rodada   ────────── entrada congelada + hash (append-only)
   explicacao        ────────── por (rodada, inscricao)
```

### 4.2 Entidades

| Entidade | O que é | Campos que carregam decisão | RF |
| --- | --- | --- | --- |
| `processo` | Um ciclo anual da Inscrição Creche | ano, situacao, `regua_versao_id`, semente_sorteio | — |
| `regua_versao` | Régua vigente, versionada e publicada | processo, vigencia, publicacao_dou, hash | RF3.3 |
| `regua_criterio` | Um critério da régua | pontos, `e_desempate`, ordem_desempate, fonte_validacao (`base`\|`documento`\|`ambas`) | RF3.1, RF2.4 |
| `calendario_fase` | Fases e prazos publicados no início | tipo, inicio, fim, publicado_em | RF6.1 |
| `crianca` | A pessoa. Uma inscrição ativa por CPF por processo | cpf, nascimento, situacao_validacao_receita | RF1.1 |
| `responsavel` | Quem responde pela criança | cpf, nome | RF1.4, RF1.7 |
| `vinculo_responsavel` | Liga responsável e criança | tipo (principal\|secundario) | RF1.7 |
| `contato` | Telefone principal, alternativo, e-mail | canal, valor, verificado_em, **versionado** | RF1.4, RF1.5 |
| `inscricao` | A candidatura da criança no processo | processo, crianca, situacao, data_inscricao, numero_sorteio | RF1.1 |
| `opcao` | Uma escolha, com posição vinculante | ordem 1..5, oferta | RF1.2 |
| `resposta_criterio` | O que a família declarou, e com que lastro | declarado, situacao (`confirmado_base`\|`documento_pendente`\|`nao_comprovado`), documento | RF2.1–2.4 |
| `documento` | Comprovante anexado | storage_key, retencao_ate, expurgado_em | RF2.1, RNF5 |
| `pontuacao` | Nota da criança, por rodada | pontos, desempates[], regua_versao, calculada_em | RF3.1 |
| `unidade` | EDI ou creche, própria ou parceira | *codigo (7 dígitos, string)*, cre, microarea, bairro, lat, lng, rede | — |
| `oferta` | Unidade × grupamento × turno | *(unidade, grupamento, turno)*, ativa | RF3.4, AD-9 |
| `capacidade_snapshot` | Vagas daquela oferta naquela rodada | rodada, oferta, vagas, sincronizado_em | RF3.4 |
| `rodada` | Uma execução da alocação | numero, tipo (`R1`\|`R2`\|`REMANESCENTE`), situacao, snapshot_hash, executada_em, `e_simulacao` | RF3.5–3.9 |
| `snapshot_rodada` | A entrada congelada e o hash | manifesto, storage_key, sha256 | RF3.8 |
| `alocacao` | O resultado: uma criança, uma oferta | rodada, inscricao, oferta, posicao_preferencia, origem (`emparelhamento`\|`remanescente`) | RF3.2, RF3.7 |
| `nota_de_corte` | A prova de estabilidade, por oferta | rodada, oferta, pontos, desempates, candidatos, lotada | RF3.8, RF4.1 |
| `convocacao` | O chamado da família | alocacao, primeiro_disparo_em, **expira_em**, situacao | RF5.1, RF5.5 |
| `mensagem` | Um envio, em um canal | canal, tentativa, provider_id, entregue_em, lido_em | RF5.3 |
| `resposta_convocacao` | Aceite ou recusa | valor, origem (`app`\|`unidade`\|`polo`), autor, em | RF5.2, RF5.6 |
| `matricula` | A efetivação na unidade | alocacao, efetivada_em, autor | RF2.5 |
| `conferencia_documento` | Conferência do comprovante no ato da matrícula | criterio, resultado, autor, em | RF2.5 |
| `divergencia` | Conferência reprovou critério decisivo | criterio, foi_decisivo, providencia | RF2.6 |
| `explicacao` | Texto por caso | rodada, inscricao, texto_molde, texto_modelo, modelo, input_hash | RF4.2, RF4.3 |
| `historico_unidade` | Série pública de vaga e fila por unidade | processo, oferta, vagas, fila, nota_de_corte | RF1.3, RF6.2 |
| `evento_auditoria` | Trilha append-only | entidade, entidade_id, acao, autor, antes, depois, em | RNF4 |
| `usuario_servidor` / `escopo` | Perfil e recorte territorial | perfil (`diretor`\|`cre`\|`central`), unidade, cre | RF7.1–7.3 |

### 4.3 Correlações que importam, e por quê

| Relação | Cardinalidade | Por que é assim |
| --- | --- | --- |
| `crianca` — `inscricao` | 1—N no histórico, **1—1 por processo** | RF1.1. Índice único `(processo, crianca)`. É a primeira metade da correção do G1 |
| `inscricao` — `opcao` | 1—N, **máx. 5** | RF1.2. Únicos em `(inscricao, ordem)` e `(inscricao, oferta)`: sem ordem repetida e sem escolher a mesma oferta duas vezes |
| `inscricao` — `alocacao` | **1—1 por rodada, e 1 ativa por processo** | RF3.2. Segunda metade da correção do G1: é o que impede uma criança de travar cinco vagas |
| `oferta` — `alocacao` | 1—N, limitado por `capacidade_snapshot` | Invariante INV4, verificada depois de toda rodada |
| `inscricao` — `resposta_criterio` | 1—N | RF2.3. Cada critério tem estado próprio: só assim a família vê item a item o que contou e o que não contou |
| `resposta_criterio` — `documento` | 1—0..1 | RF2.2: critério confirmado por base dispensa upload. Documento nulo com situação `confirmado_base` é estado válido, não pendência |
| `alocacao` — `convocacao` | 1—1 | Alocar e convocar são coisas distintas: a alocação existe mesmo se o disparo falhar, e é o que permite reenviar |
| `convocacao` — `mensagem` | 1—N | RF5.1 e RF5.3: três canais no primeiro disparo, mais os reenvios de 24h e 48h. Entrega e leitura são por mensagem, não por convocação |
| `matricula` — `conferencia_documento` | 1—N | RF2.5. A conferência é por critério, não por matrícula: só assim a divergência sabe qual critério caiu |
| `divergencia` — `inscricao` | N—1 | RF2.6. Reprovar critério decisivo devolve a vaga à fila da unidade **e** mantém a criança concorrendo com pontuação corrigida |
| `rodada` — `snapshot_rodada` | 1—1 | RF3.8. Simulação (RF3.9) é uma `rodada` com `e_simulacao = true` sobre o mesmo snapshot |
| `processo` — `regua_versao` | 1—1 vigente, N no histórico | RF3.3. A pontuação guarda a versão que usou: em 2024 a pergunta sobre deficiência caiu de 100 para 25 pontos, e série montada sem isso é falsa |

---

## 5. Invariantes do domínio

Verificáveis por teste e, as marcadas, por restrição de banco. Cada uma corresponde a um gargalo do
PRD; violar uma é reintroduzir o problema que o sistema existe para resolver.

| # | Invariante | Onde é garantida | Gargalo |
| --- | --- | --- | --- |
| **INV1** | Uma inscrição ativa por criança por processo | Índice único parcial | G1 |
| **INV2** | No máximo 5 opções, ordens únicas e contíguas de 1 a N | Restrição + validação no caso de uso | G1 |
| **INV3** | No máximo uma alocação ativa por criança por processo | Índice único parcial + verificação pós-rodada | **G1** |
| **INV4** | Alocações ativas por oferta ≤ capacidade no snapshot | Verificação pós-rodada, bloqueia publicação | G2 |
| **INV5** | **Estabilidade:** não existe par (criança, oferta) em que a criança prefira a oferta à sua alocação e a oferta tenha vaga ou retenha alguém de prioridade menor | Teste de propriedade sobre todo resultado de rodada | G1 |
| **INV6** | Só pontua critério com lastro: confirmado por base ou com documento anexado | `nucleo/regua.py`, com o estado vindo de `resposta_criterio` | G5 |
| **INV7** | Prioridade é ordem total estrita — nenhum par de inscrições empata em todas as chaves | Propriedade do número de sorteio, testada | RNF3 |
| **INV8** | Recusa libera a vaga na mesma transação e não remove a criança das demais filas | Máquina de estados da convocação | R6 |
| **INV9** | Toda mutação de contato, conferência e rodada tem linha em `evento_auditoria` | Decorador `@auditado` + teste de arquitetura | RNF4 |
| **INV10** | Rodada publicada é imutável: correção gera rodada nova, nunca reescreve a anterior | Ausência de `UPDATE` no repositório de rodada | RF3.8 |

INV5 e INV7 são as que sustentam a defesa técnica perante órgão de controle e devem rodar como
verificação obrigatória antes de qualquer publicação de resultado.

---

## 6. Fluxos críticos

### 6.1 Executar uma rodada

```
1. Nível central abre a rodada                       → rodada(situacao='preparando')
2. Sincroniza capacidade do sistema acadêmico        → capacidade_snapshot   [bloqueia se defasado]
3. Congela a entrada                                 → snapshot_rodada + sha256
4. Calcula pontuação de cada inscrição               → pontuacao (régua versionada, INV6)
5. Roda o emparelhamento sobre o snapshot            → nucleo/emparelhamento.py
6. Verifica INV3, INV4, INV5, INV7                   → falha aborta, nada é publicado
7. Simulação?  sim → relatório comparativo, fim (RF3.9)
              não → persiste alocacao + nota_de_corte
8. Gera explicações: molde determinístico, depois reescrita em lote pelo Claude
9. Publica em formato aberto (RF6.5) e abre as convocações (6.2)
```

Passos 3 a 6 são o coração do RNF3 e do RF3.8. O passo 6 é o que impede publicar um resultado
inválido, e é a diferença entre um sistema auditável e um sistema que só diz que é.

### 6.2 Convocar, responder, matricular

```
alocacao criada
   └─ convocacao(expira_em = +3 dias úteis)                       [AD-11]
        ├─ outbox: SMS + e-mail + push, simultâneos               [RF5.1, AD-10]
        ├─ +24h e +48h sem resposta: reenvio escalonado           [RF5.3]
        ├─ família aceita no app  → matricula pendente de conferência
        ├─ família recusa no app  → vaga liberada na hora, filas preservadas  [RF5.6, INV8]
        └─ prazo vence           → vaga liberada, entra na rodada seguinte    [RF5.5]

matrícula na unidade
   └─ conferencia_documento por critério                          [RF2.5]
        ├─ tudo confere        → matricula efetivada
        └─ critério decisivo reprovado                            [RF2.6]
             ├─ matrícula não se efetiva
             ├─ vaga volta à fila daquela unidade na rodada seguinte
             ├─ inscrição reclassificada com a pontuação corrigida (segue concorrendo)
             └─ reincidência no mesmo processo → sinaliza à SME
```

O ponto de desenho: **"critério decisivo"** precisa de definição operacional testável — um critério
é decisivo quando, removidos os seus pontos, a pontuação da criança cai abaixo da nota de corte da
oferta em que ela foi alocada naquela rodada. O dado para calcular isso é exatamente
`nota_de_corte`, que a rodada já persiste. Sem essa definição, o RF2.6 vira julgamento de balcão.

### 6.3 Editar contato (G4)

Fluxo curto e desproporcionalmente importante: são 5.994 crianças por ano perdidas entre a
convocação e a matrícula. Família edita no app a qualquer momento (RF1.5), sem reabrir inscrição,
sem ida à unidade. Grava versão nova, mantém a anterior, registra origem e autor. Antes de cada
rodada, o sistema pede confirmação ativa por notificação (RF1.6). O indicador "contatos atualizados
no ciclo" da seção 3 do PRD sai daqui.

---

## 7. Plano de execução por fase

As fases seguem o roadmap do PRD. Para cada uma: o que entra, o que fica pronto, e o critério de
pronto — que é sempre uma medida, nunca "implementado".

### Fase 0 · Confirmação na base viva (2 a 4 semanas)

Sem desenvolvimento novo. É a fase que decide se o resto acontece.

| Entrega | Detalhe |
| --- | --- |
| Portar o pipeline para o ambiente da SME | Parametrizar ano e caminho das bases; hoje há `2025` fixo em `03/04/05` |
| Rodar sobre o processo de 2026 | Motor, régua, cenários |
| **Confirmar ou derrubar a validação em 6,8%** | O achado é sobre base anonimizada e a própria SME adverte que valores absolutos não reproduzem a realidade |
| Relatório de reprodutibilidade | Números de 2021 a 2025 na base viva contra os do protótipo |

**Pronto quando** o relatório estiver assinado e a SME decidir seguir. **Se a validação de 6,8% não
se confirmar**, o cenário `regua_viva` deixa de ser alavanca: o ganho projetado recua de +4.595 para
+4.495 crianças, e o ganho entre crianças em vulnerabilidade recua de +6.207 para +3.199. O projeto
segue de pé, a comunicação muda. Este é o único achado do
PRD que pode virar em campo, e é por isso que ele é a Fase 0.

### Fase 1 · Motor e painéis de gestão (1 a 2 meses)

| Frente | Entregas |
| --- | --- |
| Núcleo | `nucleo/` extraído do pipeline, tipado, com ordem total estrita (AD-6) e *heap* (AD-16). Testes de propriedade de INV5 e INV7. Regressão contra 2021–2025 |
| Dados | Esquema Postgres das entidades da seção 4. Migrações. Carga inicial de unidade, oferta, CRE e microárea |
| Rodada | Snapshot imutável (AD-4), execução, verificação de invariantes, notas de corte, registro de rodada |
| Régua | Tabelas versionadas, tela de parametrização, simulação (RF3.9) com comparação contra a rodada anterior |
| Explicação | Molde determinístico + reescrita em lote (AD-12), com revisão por amostragem |
| Painéis | Diretor (RF7.1), CRE (RF7.2), central (RF7.3), com escopo territorial (AD-14) |
| Sombra | Execução paralela ao processo vigente, leitura apenas (AD-19) |

**Pronto quando** uma rodada sombra sobre o processo vigente executar em menos de 10 minutos, passar
nas verificações de invariante, e o relatório comparativo tiver sido lido pela CRE e pelo nível
central. **Fecha:** RF3.1–3.9, RF4.1–4.4, RF7.1–7.3, RNF2, RNF3, RNF4.

**Dependência normativa:** R1 e R2 precisam estar em tramitação. A Fase 1 roda em sombra sem elas;
a Fase 4 não.

### Fase 2 · Convocação multicanal (1 a 2 meses)

| Frente | Entregas |
| --- | --- |
| Contato | Múltiplos contatos e segundo responsável (RF1.4), edição pela família versionada (RF1.5), confirmação por rodada (RF1.6) |
| Disparo | Outbox, três canais, idempotência, *webhooks* de entrega e leitura (RF5.1, RF5.3, AD-10) |
| Resposta | Aceite e recusa no app (RF5.2), recusa liberando a vaga na hora (RF5.6) |
| Prazo | `expira_em` em dias úteis, contagem regressiva, liberação automática (RF5.5, AD-11) |
| Painel do diretor | Quem foi chamado, quem respondeu, quem vence, quem precisa de contato ativo (RF5.4) |
| Autenticação | gov.br para a família |

**Pronto quando** a taxa de resposta por canal estiver instrumentada e um piloto em uma CRE mostrar
"convocados que não matriculam" abaixo de 11%. **Fecha:** RF1.4–1.6, RF5.1–5.6. **Dependência
normativa:** R5.

### Fase 3 · App da família e comprovação (2 a 3 meses)

| Frente | Entregas |
| --- | --- |
| Inscrição | PWA, CPF na Receita, até 5 opções com ordem vinculante e interface explícita sobre o efeito da ordem (RF1.1, RF1.2) |
| Escolha informada | Busca de unidade com histórico de vaga e fila dos últimos três processos e distância (RF1.3, RF6.2) |
| Comprovação | Upload na inscrição (RF2.1), cruzamento automático com Data Lake (RF2.2), estado item a item (RF2.3), pontuação só com lastro (RF2.4) |
| Matrícula | Conferência na unidade (RF2.5) e tratamento de divergência (RF2.6) |
| Validação | Painel de taxa de confirmação por critério, unidade e CRE, com alerta de faixa (RF2.7) |
| Transparência | Calendário público (RF6.1), posição na fila (RF6.3), notificação de fase (RF6.4), publicação aberta (RF6.5) |
| Remanescentes | PostGIS, raio parametrizável, oferta opcional (RF3.7, AD-8, AD-17) |
| Presencial | Polos de atendimento com a mesma interface e origem registrada — canal equivalente, não exceção |

**Pronto quando** a taxa de validação de vulnerabilidade no piloto passar de 85% e a fase de
remanescentes cobrir as unidades com coordenada. **Fecha:** RF1.1–1.3, RF1.7, RF2.1–2.7, RF3.7,
RF6.1–6.5, RNF1, RNF6. **Dependência normativa:** R3, R4, R6, e o cadastro de coordenadas das 348
unidades sem geolocalização.

### Fase 4 · Substituição do módulo atual

Corte no processo seguinte, sistema antigo em leitura por um ciclo. Pré-requisitos: normas R1 a R6
publicadas; um processo inteiro rodado em sombra com divergência explicada; plano de retorno
documentado e testado; equipe de sustentação da SME treinada no `nucleo/`.

### 7.1 Matriz de rastreabilidade

| Módulo do PRD | Componentes | Fase |
| --- | --- | --- |
| M1 Inscrição | PWA, `inscricao`, `opcao`, `contato`, Receita | 2 (contato) e 3 (inscrição) |
| M2 Comprovação | `resposta_criterio`, `documento`, Data Lake, conferência | 3 |
| M3 Classificação e alocação | `nucleo/`, `rodada`, `snapshot_rodada`, `capacidade_snapshot` | 1 |
| M4 Explicação e auditoria | `nota_de_corte`, `explicacao`, `evento_auditoria`, exportação | 1 |
| M5 Convocação | `convocacao`, `mensagem`, outbox, painel do diretor | 2 |
| M6 Transparência | `calendario_fase`, `historico_unidade`, portal público | 3 |
| M7 Painéis | Consultas com escopo, três perfis | 1 |

---

## 8. Estratégia de testes e verificação

Quatro camadas, em ordem de importância para este sistema.

**8.1 Propriedade sobre o resultado da rodada.** As mais importantes. Depois de toda execução —
inclusive em produção, não só em teste — verificar INV3, INV4, INV5 e INV7. A verificação de
estabilidade é uma varredura sobre pares (criança, oferta preferida à alocada) e é barata perto do
custo da rodada. **Falha bloqueia a publicação.**

**8.2 Regressão contra base histórica.** Os resultados do protótipo sobre 2021–2025 viram arquivos
de referência versionados. Toda mudança no núcleo roda contra eles e qualquer divergência precisa
ser explicada e aprovada no *pull request*. É o que impede uma "melhoria" silenciosa de mudar quem
entra na creche.

**8.3 Testes de caso de uso com adaptadores falsos.** Convocação, prazo, recusa, divergência e
reclassificação, com relógio injetado. Aqui moram os erros de dias úteis, de fuso e de reentrada.

**8.4 Testes de contrato e de modo degradado.** Um por integração (AD-13): o que acontece quando a
Receita não responde, quando o Data Lake volta vazio, quando o SMS falha para metade da base.
Cenário não testado é cenário que vai acontecer no primeiro dia de inscrição.

**8.5 Verificação em modo sombra.** A mais valiosa e a que não se pode escrever em teste: rodar o
processo vigente em paralelo e explicar cada divergência contra o resultado real. Toda divergência
inexplicada é bug até prova em contrário.

---

## 9. Dívidas conhecidas do protótipo

Levantadas na leitura do código atual. Todas entram na Fase 1.

| # | O que é | Onde | Consequência |
| --- | --- | --- | --- |
| D1 | Prioridade não é ordem total: empate em pontos, desempate e data cai na estabilidade do `sort` | `02_matching.py`, `04_cenarios.py`, `05_casos.py` | Quebra o RNF3 em silêncio. **Corrigido por AD-6** |
| D2 | `sort` da lista retida a cada proposta, em vez de *heap* | idem | O(n log n) por proposta. Higiene de escala (AD-16) |
| D3 | Oferta derivada da demanda: unidade sem inscrição não existe | `vaga_id` construído a partir da Query A | Ociosidade invisível. **Corrigido por AD-9** |
| D4 | O *fallback* territorial de `02_matching.py` conta realocação mas não a escreve em `aloc`, e varre `sobra` sem ordenar por prioridade — `04_cenarios.py` já ordena | `02_matching.py` | Duas implementações da mesma regra divergindo. Consolidar em `nucleo/remanescentes.py` |
| D5 | Régua reconstruída por engenharia reversa da Query C, em três lugares | `01`, `02`, `04`, `05` | Uma cópia por script. Vira tabela (AD-5) e função única do núcleo |
| D6 | Ano fixo em `03`, `04`, `05` | topo dos scripts | Impede a Fase 0 rodar 2026 sem editar código |
| D7 | Proximidade por bairro, não por coordenada | `04_cenarios.py` | Aproximação declarada. **Tratada em AD-17** |
| D8 | Capacidade de parceiras é piso conservador (matriculados), não capacidade real | `02_matching.py` | Subestima o ganho. Some quando o catálogo de oferta chegar do acadêmico (AD-9) |

Vale registrar: D1, D3 e D4 não invalidam os números publicados. D1 afeta ordenação dentro de
empates, que é ruído sobre agregados; D3 e D4 **subestimam** o ganho, porque escondem ociosidade.
O protótipo erra para o lado conservador, que é o lado certo de errar numa peça que vai a órgão de
controle.

---

## 10. Riscos técnicos

Complementam os riscos de produto da seção 10 do PRD.

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Integração com a gestão acadêmica não entrega capacidade confiável | **Alto** — é a entrada do motor | Limite de defasagem que bloqueia a rodada (AD-13); painel exibindo a data da sincronização; conciliação manual como escape |
| Qualidade do cadastro de endereço inviabiliza a proximidade | Médio | Queda para bairro, declarada na oferta (AD-17); completar coordenadas é tarefa de Fase 3, com dono |
| Pico do primeiro dia de inscrição (RNF7) | Alto | Ordem de chegada não dá vantagem (AD-6), o que remove o incentivo à corrida; teste de carga com o perfil histórico do primeiro dia |
| Rodada publicada com resultado inválido | **Crítico** | Verificação de invariante bloqueando publicação (8.1); rodada é imutável e correção é rodada nova (INV10) |
| Explicação do modelo com erro factual | Médio | Números sempre do motor; molde determinístico como base e como recuo; revisão por amostragem antes de publicar (AD-12) |
| Vazamento de documento de vulnerabilidade | **Crítico** | URL assinada de curta duração, escopo no caso de uso, auditoria de acesso, expurgo desde o dia um (AD-18) |
| Divergência silenciosa entre sombra e produção | Alto | Toda divergência é bug até prova em contrário (8.5) |
| Equipe de sustentação da SME não absorve dois runtimes | Médio | `nucleo/` pequeno e coberto por teste de propriedade, que é o que torna uma eventual porta de linguagem verificável (AD-2) |

---

## 11. Decisões em aberto

Além das cinco do PRD, que seguem valendo, este plano abre e devolve à SME:

1. **Stack.** AD-2 assume Python e TypeScript pelo critério de não descartar o que está validado.
   Precisa bater com o parque tecnológico e a capacidade de sustentação da prefeitura.
2. **Semente do sorteio.** Quem gera, quando publica e como um terceiro verifica. Sugestão: publicar
   junto do calendário (RF6.1), antes do encerramento das inscrições.
3. **Definição operacional de "critério decisivo"** no RF2.6. A seção 6.2 propõe uma definição
   calculável a partir da nota de corte. Precisa de validação jurídica.
4. **Limite de defasagem da capacidade** que bloqueia a execução de rodada (AD-13). É uma decisão de
   operação, não de engenharia.
5. **Retenção do documento de comprovação.** RNF5 pede prazo definido; o prazo em si é decisão
   jurídica e precisa entrar antes da Fase 3, porque o expurgo nasce junto com o upload (AD-18).
6. **Unidades parceiras**, tanto na capacidade (D8) quanto na fase de remanescentes — já registrado
   como decisão 12.5 do PRD, e que aqui vira também dependência de integração.
