# PRD — Fila Única

**Sistema de inscrição, classificação e convocação da Educação Infantil (creche) da SME-Rio.**
Grupo 22 · Claude Impact Lab Rio, 2ª edição · 30 de agosto de 2026 · versão 0.1

> Documento de produto que acompanha o protótipo publicado em https://fila-unica.pages.dev
> e o motor de alocação em `pipeline/`. Todo número citado aqui foi apurado sobre a base real
> anonimizada de 2021 a 2025 publicada pela SME (`CIT-SME-RJ/dadoscreche`).

---

## 1. Sumário executivo

A fila da creche no Rio não é, principalmente, um problema de falta de vaga. É um problema de
alocação.

Em 2025 a rede pública fechou o ano com **8.243 lugares fisicamente vazios** em turmas já abertas,
com professor contratado, enquanto **16.345 opções seguiam em lista de espera**. A CRE 7 tinha
6.249 crianças esperando; a CRE 9 tinha 1.415 lugares vazios e 179 crianças esperando.

A causa é o desenho do processo. O sistema atual classifica **opção**, não **criança**: cada CPF
gera até cinco filas independentes, disputa cinco vagas ao mesmo tempo e trava cada uma delas por
três dias durante a convocação. Existe uma rodada só. A régua de prioridade social quase não é
aplicada, porque a comprovação de vulnerabilidade é validada em **6,8%** dos casos. E o contato da
família, uma vez cadastrado, não pode ser corrigido.

A **Fila Única** substitui o módulo de Inscrição Creche por um sistema em que **uma criança tem uma
fila e recebe uma vaga**. A classificação passa a ser por criança, com ordem de preferência
vinculante, resolvida por emparelhamento estável. Há duas rodadas com dez dias de intervalo e uma
terceira fase de vagas remanescentes por proximidade. A convocação sai do caderno do diretor e vai
para SMS, e-mail e notificação no aplicativo. A comprovação de vulnerabilidade passa a ser enviada
no ato da inscrição e conferida no ato da matrícula.

**Impacto simulado sobre o processo real de 2025, com as mesmas vagas e a mesma régua:**

| Indicador | Hoje | Fila Única | Delta |
| --- | ---: | ---: | ---: |
| Crianças matriculadas | 48.680 | 53.275 | **+4.595** |
| Na creche que a família escolheu primeiro | 35.139 | 41.284 | **+6.145** |
| Crianças em vulnerabilidade atendidas | 28.426 | 34.633 | **+6.207** |
| Vagas que sobram vazias | 8.243 | 3.648 | **−56%** |

Nenhuma sala nova. Nenhum professor a mais. Nenhum critério de prioridade inventado.

> **Estes números assumem que toda família convidada para uma vaga remanescente aceita.**
> 3.020 das 4.595 crianças entram por uma oferta em creche que a família não escolheu, e a
> seção 5 mede o quanto o resultado se move quando parte delas recusa. O piso, sem nenhuma
> aceitação, é **+1.575 crianças**, e vem só do emparelhamento.

---

## 2. Os gargalos e onde cada um é resolvido

Rastreabilidade direta entre o diagnóstico e o produto. Nenhum requisito existe sem um gargalo que
o justifique.

| # | Gargalo | Evidência na base | Resolvido em |
| --- | --- | --- | --- |
| **G1** | Cada CPF bloqueia até 5 vagas, sem ranqueamento de prioridade entre as escolhas | 45 mil inscrições viram 837 mil linhas de fila; uma criança pode ser convocada em 5 unidades ao mesmo tempo | M3 — Classificação e alocação |
| **G2** | Existe uma rodada única de seleção | 8.243 vagas ociosas ao fim de 2025 sem nova chamada estruturada | M3 — Rodadas 1 e 2 |
| **G3** | Falta visibilidade do histórico de disponibilidade de vagas por unidade | A família escolhe às cegas: 42% das opções são fora do bairro e muitas vão para unidades lotadas | M6 — Transparência |
| **G4** | Cadastro de contato dos pais não pode ser corrigido | 5.994 crianças convocadas e não matriculadas em 2025; ~44 mil de 2021 a 2025 | M1 e M5 |
| **G5** | Comprovação de vulnerabilidade é ineficiente | CadÚnico declarado por 35.141 famílias, validado em 2.390 (6,8%). Era 88,9% em 2021 | M2 — Comprovação |
| **G6** | Falta visibilidade antecipada das datas e fases do processo | Prazo de 3 dias que a família descobre ao ser chamada | M6 — Transparência |
| **G7** | Não há rodadas posteriores otimizando as vagas que sobraram | Unidades terminam o ano com fila zero enquanto vizinhas têm fila de centenas | M3 — Fase 3, remanescentes |

---

## 3. Objetivos e métricas

### Objetivos de produto

**O1. Colocar mais criança na creche com a mesma oferta.** A vaga que existe e está vazia é a mais
barata da rede.

**O2. Fazer a régua de prioridade social voltar a valer.** Hoje 93% das inscrições entram com zero
ponto. A política existe no papel e não chega ao resultado.

**O3. Reduzir a perda entre convocação e matrícula.** A criança foi chamada e mesmo assim ficou
sem creche.

**O4. Tornar a decisão explicável e auditável.** A fila é acompanhada por órgãos de controle e
cobrada no balcão da unidade.

### Métricas

| Métrica | Linha de base 2025 | Meta ano 1 | Como medir |
| --- | ---: | ---: | --- |
| Crianças matriculadas pelo processo | 48.680 | +4.000 | Contagem por `aluno`, não por opção |
| Taxa de 1ª opção atendida | 72,2% | ≥ 80% | Matriculados na opção 1 sobre matriculados |
| Vagas ociosas ao fim do ano letivo | 8.243 | ≤ 4.500 | Turmas × teto menos matriculados |
| Taxa de validação de vulnerabilidade | 6,8% | ≥ 85% | Declarados que viraram validados |
| Convocados que não matriculam | 11,0% | ≤ 5% | Cancelado na confirmação sobre convocados |
| Dias entre alocação e matrícula efetivada | ~7 a 10 | ≤ 4 | Carimbo de tempo do sistema |
| Contatos atualizados no ciclo | não medido | ≥ 60% | Responsáveis que editaram contato |

**Contramétricas**, para não otimizar a coisa errada:

- Proporção de matriculados em vulnerabilidade não pode cair. Encher vaga com quem tem menos
  necessidade não é ganho.
- Distância média casa/creche não pode subir de forma relevante. Preencher ociosidade jogando
  criança para longe é transferir o problema para a família.
- Taxa de evasão nos 60 dias após a matrícula não pode subir. Ela indicaria alocação forçada.

---

## 4. Personas

**Vanessa, responsável.** Acessa pelo celular, quase sempre por dados móveis. Trocou de número
duas vezes no ano. Não sabe qual creche tem vaga nem quando será chamada. Hoje precisa faltar ao
trabalho para levar documento à unidade no dia seguinte à inscrição.

**Sr. Antônio, diretor de EDI.** Toca a unidade inteira. A convocação é mais uma tarefa: olha
planilha, liga, tenta WhatsApp, anota contato novo no caderno porque o sistema não deixa editar.
Perde vaga por não conseguir falar com a família.

**Renata, gerente de matrícula na CRE.** Responde por 57 unidades. Precisa saber onde há fila e
onde há vaga sobrando no seu território, e cobrar convocação pendente sem ligar unidade por unidade.

**Gabriele, nível central da SME.** Define a régua e o calendário, roda a classificação, planeja a
oferta do ano seguinte e presta contas a órgãos de controle. Precisa que cada decisão da fila seja
reconstituível.

---

## 5. Escopo

### Entra

Substituição integral do módulo de Inscrição Creche: inscrição, comprovação, classificação,
alocação, convocação, matrícula, painéis de gestão e transparência pública, para a Educação
Infantil na modalidade creche (0 a 3 anos e 11 meses), rede pública e parceiras.

### Não entra na versão 1

- Pré-escola (4 e 5 anos), que tem vaga imediata garantida e não passa por classificação.
- Ensino fundamental e transferência entre unidades.
- Planejamento de oferta do ano seguinte. O sistema **alimenta** o planejamento com dado limpo de
  demanda reprimida por microárea, mas a decisão de abrir turma segue no processo atual.
- Gestão pedagógica, frequência e alimentação escolar.

### Premissas

- A SME mantém o Data Lake e o Registro Municipal Integrado como fonte de vulnerabilidade social.
- O CPF da criança segue validado na Receita Federal, como já é hoje.
- As mudanças de regra descritas na seção 7 exigem norma e publicação em Diário Oficial. O
  cronograma da seção 11 já considera isso.

### A premissa que mais move o resultado: a taxa de aceite da Fase 3

O ganho de +4.595 crianças não é uma peça só. Ele se decompõe em duas de natureza diferente:

| Origem | Crianças | Depende de aceite? |
| --- | ---: | --- |
| Emparelhamento estável | +1.575 | **Não.** A criança entra numa creche que ela mesma escolheu |
| Fase 3, vaga remanescente no bairro | +3.020 | **Sim.** A creche não está na lista dela |
| **Total** | **+4.595** | 66% do ganho vem da Fase 3 |

A simulação do `pipeline/04_cenarios.py` trata a vaga remanescente como alocação. O RF3.7 e o
AD-8 do plano de implementação tratam a mesma coisa, corretamente, como **convite recusável**:
recusar não custa posição em fila nenhuma. Os dois não podem estar certos ao mesmo tempo, e é o
convite que vale. Então o número publicado é o teto, não a estimativa central.

**Cenário pessimista** — cada vaga é oferecida uma vez e a recusa a deixa vazia:

| Aceite | Na creche | Ganho | Vagas ociosas | Redução |
| ---: | ---: | ---: | ---: | ---: |
| 100% | 53.275 | +4.595 | 3.648 | −56% |
| 80% | 52.671 | +3.991 | 4.252 | −48% |
| 60% | 52.067 | +3.387 | 4.856 | −41% |
| 40% | 51.463 | +2.783 | 5.460 | −34% |
| 20% | 50.859 | +2.179 | 6.064 | −26% |
| 0% | 50.255 | **+1.575** | 6.668 | −19% |

Duas leituras que importam para a decisão:

1. **O piso é positivo e não é pequeno.** Mesmo se ninguém aceitar vaga fora da própria lista,
   trocar o algoritmo coloca 1.575 crianças a mais na creche e derruba a ociosidade em 19%. O
   projeto não depende da Fase 3 para valer a pena; ele depende dela para valer +4.595.
2. **A meta de ano 1 da seção 3 é +4.000 crianças, e ela exige aceite de 80%** — que é
   exatamente o limiar do gatilho de revisão do AD-8. A meta e o gatilho são o mesmo número,
   por coincidência, e vale ter isso consciente ao negociar a meta.

**Cenário realista** — o AD-8 devolve a vaga recusada ao conjunto de remanescentes na hora,
então ela só fica vazia se **todos** os candidatos elegíveis daquele bairro e grupamento
recusarem. Com `k` candidatos por vaga, a chance de preencher é `1 − (1 − aceite)^k`:

| Aceite | k=1 | k=2 | k=3 | k=5 |
| ---: | ---: | ---: | ---: | ---: |
| 80% | +3.991 | +4.474 | +4.571 | +4.594 |
| 60% | +3.387 | +4.112 | +4.402 | +4.564 |
| 40% | +2.783 | +3.508 | +3.943 | +4.360 |
| 20% | +2.179 | +2.662 | +3.049 | +3.605 |

Com aceite de 60% e apenas três candidatos por vaga, o ganho volta para +4.402. **A reoferta é
o que sustenta o número**, e é por isso que ela é requisito e não detalhe de implementação.
Medir `k` sobre as bases é o que falta para fechar a estimativa central; hoje temos o piso e o
teto.

**O número de crianças vulneráveis é o mais exposto, não o menos.** O `cenarios.json` não separa
quantas das 3.020 realocações foram de criança em vulnerabilidade, então o +6.207 cai, sem
nenhuma aceitação, para algo entre +3.187 e +6.207. O valor real fica perto do piso dessa faixa,
porque o fallback percorre os não alocados já ordenados por prioridade, e nesse cenário a
prioridade é a pontuação declarada, onde CadÚnico e Bolsa Família pesam 51 e 21 pontos. Ou seja:
a Fase 3 atende preferencialmente quem tem mais direito, e é justamente por isso que o indicador
social depende dela mais que o indicador de volume. Fechar a faixa é uma linha em
`04_cenarios.py` e depende de ter as bases em máquina.

Reproduzir: `python3 pipeline/07_sensibilidade.py`.

---

## 6. Módulos e requisitos funcionais

### M1. Inscrição — aplicativo da família *(G1, G4)*

- **RF1.1** Inscrição por CPF da criança, validado na Receita, uma inscrição ativa por CPF.
- **RF1.2** A família indica **até 5 unidades em ordem de preferência vinculante**. A ordem passa a
  ter efeito jurídico: o sistema aloca na melhor opção possível e libera as demais na mesma rodada.
- **RF1.3** A busca de unidades mostra, para cada uma, **histórico de vagas e de fila dos últimos
  três processos** e a distância a partir do endereço informado. A família escolhe com informação.
- **RF1.4** Cadastro de **múltiplos contatos** (telefone principal, telefone alternativo, e-mail) e
  de um segundo responsável.
- **RF1.5** O contato é **editável a qualquer momento** pela própria família, sem ida à unidade e
  sem reabrir a inscrição. Toda alteração fica versionada com data e origem.
- **RF1.6** Confirmação de dados obrigatória a cada rodada: antes de cada alocação o sistema pede
  que a família confirme ou corrija o contato, por notificação.
- **RF1.7** A inscrição pode ser feita e acompanhada por qualquer um dos responsáveis cadastrados.

### M2. Comprovação de vulnerabilidade *(G5)*

Muda o rito: a documentação sobe **no ato da inscrição**, pelo aplicativo, e é **conferida no ato
da matrícula**, na unidade.

- **RF2.1** Upload de documento por foto ou PDF na própria inscrição, por critério declarado.
- **RF2.2** **Cruzamento automático** com CadÚnico, Bolsa Família e demais bases do Data Lake no
  momento da inscrição. Critério confirmado por base **dispensa upload**.
- **RF2.3** A família vê, item a item, o estado de cada critério: confirmado por base, documento
  recebido e pendente de conferência, ou não comprovado. Com o valor em pontos de cada um.
- **RF2.4** A pontuação usada na classificação é a **declarada com documentação anexada ou
  confirmada por base**. Critério sem documento e sem confirmação não pontua.
- **RF2.5** Na matrícula, o diretor confere o documento anexado contra o original apresentado e
  registra a conferência no sistema. Divergência aciona o fluxo do RF2.6.
- **RF2.6** **Tratamento de divergência.** Se a conferência reprovar um critério que foi decisivo
  para a classificação, a matrícula não se efetiva, a vaga volta para a fila daquela unidade na
  rodada seguinte e a criança é reclassificada com a pontuação corrigida, sem perder o direito de
  concorrer. Reincidência no mesmo processo é sinalizada à SME.
- **RF2.7** Painel de validação para a SME com taxa de confirmação por critério, por unidade e por
  CRE, com alerta quando a taxa cai fora da faixa esperada. É a métrica que hoje ninguém olha.

### M3. Classificação e alocação *(G1, G2, G7)*

O núcleo. Substitui a classificação por opção pela classificação por criança.

- **RF3.1** Pontuação calculada **uma vez por criança**, a partir da régua oficial vigente do
  processo, incluindo critérios de desempate.
- **RF3.2** Alocação por **emparelhamento estável com aceitação diferida**: a criança propõe na
  ordem declarada, a unidade retém as maiores pontuações até lotar e devolve as demais à rodada.
  Resultado: **uma oferta por criança**, a melhor a que ela tem direito.
- **RF3.3** A régua é **parametrizável em tabela**, versionada por processo. Mudar o peso de um
  critério não exige tocar no motor.
- **RF3.4** Capacidade por **unidade × grupamento × turno**, atualizada a partir do sistema de
  gestão acadêmica.
- **RF3.5** **Rodada 1** na data publicada no calendário.
- **RF3.6** **Rodada 2** dez dias depois da rodada 1, reprocessando todas as vagas não efetivadas,
  as recusadas e as que vagaram. Quem não foi alocado na rodada 1 continua na fila sem reinscrição.
- **RF3.7** **Fase 3, vagas remanescentes.** Terminadas as duas rodadas, as vagas que sobraram em
  unidades **não selecionadas** pela família são ofertadas às crianças ainda sem vaga, ordenadas
  pela **proximidade em relação às unidades que a família originalmente escolheu**. A oferta é
  **opcional**: recusar não faz a criança perder posição na fila de espera das unidades escolhidas.
- **RF3.8** Toda rodada gera **registro imutável**: entrada, régua vigente, capacidade, resultado e
  nota de corte por vaga. É o que permite reconstituir qualquer decisão meses depois.
- **RF3.9** **Simulação antes de rodar.** O nível central roda o cenário e vê o resultado agregado
  antes de efetivar, com comparação contra a rodada anterior.

### M4. Explicação e auditoria *(O4)*

- **RF4.1** Para cada criança, o sistema exibe a **nota de corte da unidade pretendida**, a
  pontuação dela e quantas crianças tinham prioridade maior.
- **RF4.2** Explicação em **linguagem natural**, gerada pelo Claude a partir dos números do motor,
  no tom que um servidor usaria ao atender a família. O modelo traduz; ele não pontua, não ordena
  e não reclassifica.
- **RF4.3** Quando um critério foi declarado e não comprovado, a explicação diz isso com todas as
  letras, informa quantos pontos ele valeria e orienta a regularização.
- **RF4.4** Exportação do resultado completo em formato aberto para os órgãos de controle.

### M5. Convocação *(G4)*

- **RF5.1** Disparo automático em **SMS, e-mail e notificação no aplicativo**, simultâneos, no
  momento da alocação.
- **RF5.2** A família **aceita ou recusa a vaga pelo próprio aplicativo**, sem depender de o
  diretor conseguir contato.
- **RF5.3** Registro de entrega, leitura e resposta por canal, com **reenvio automático escalonado**
  em 24h e 48h para quem não respondeu.
- **RF5.4** **Painel do diretor** com quem foi chamado, quem respondeu, quem está para vencer o
  prazo e quem precisa de contato ativo. O diretor entra como último recurso, não como primeiro.
- **RF5.5** Prazo de resposta de **3 dias úteis**, contados do primeiro disparo, exibido em
  contagem regressiva para a família e para o diretor. A vaga não fica travada além disso.
- **RF5.6** Recusa explícita **libera a vaga imediatamente** para a rodada seguinte, sem esperar o
  prazo correr. Recusar não elimina a criança da fila das demais unidades.

### M6. Transparência e calendário *(G3, G6)*

- **RF6.1** **Calendário do processo publicado no início**, com inscrição, rodada 1, rodada 2, fase
  de remanescentes e prazos de matrícula. Visível antes da inscrição.
- **RF6.2** **Histórico público de vagas e fila por unidade**, por grupamento e turno, dos últimos
  três processos. Resolve a escolha às cegas.
- **RF6.3** Acompanhamento da posição na fila em tempo real, por unidade escolhida.
- **RF6.4** Notificação de mudança de fase para todas as famílias inscritas.
- **RF6.5** Publicação do resultado de cada rodada em formato aberto, atendendo à exigência de
  publicidade.

### M7. Painéis de gestão *(operação)*

- **RF7.1** **Diretor:** fila da unidade, convocações em andamento, prazos, conferência de
  documentação e efetivação de matrícula.
- **RF7.2** **CRE:** fila contra ociosidade por microárea e por unidade, convocações vencendo,
  unidades com taxa de validação anômala, ranking de vaga ociosa no território.
- **RF7.3** **Nível central:** execução das rodadas, simulação, parametrização da régua e do
  calendário, indicadores da seção 3 e demanda reprimida por microárea para alimentar o
  planejamento de oferta.

---

## 7. Mudanças de regra que o sistema exige

O produto não roda dentro da norma atual. Estas são as alterações necessárias, e todas dependem de
ato normativo e publicação em Diário Oficial.

| # | Regra hoje | Regra proposta | Por quê |
| --- | --- | --- | --- |
| **R1** | Até 5 opções, cada uma classificada separadamente | Até 5 opções em **ordem de preferência vinculante**, com uma alocação por criança | Acaba o bloqueio de 5 vagas por CPF (G1) |
| **R2** | Uma rodada de classificação | **Duas rodadas** com 10 dias de intervalo, mais fase de remanescentes | Aproveita a vaga que sobra e a que vaga cedo (G2, G7) |
| **R3** | Comprovação presencial na unidade no dia seguinte à inscrição, antes da classificação | **Documentação anexada na inscrição**, conferida **no ato da matrícula** | Tira a barreira que hoje derruba a validação para 6,8% (G5) |
| **R4** | Oferta restrita às 5 unidades escolhidas | Oferta **adicional e opcional** de vaga remanescente em unidade próxima às escolhidas | Preenche ociosidade sem impor deslocamento (G7) |
| **R5** | Contato imutável após a inscrição | Contato **editável pela família** a qualquer momento | Sem contato válido não há convocação (G4) |
| **R6** | Recebeu oferta e recusou, sai de todas as filas | Recusa **libera a vaga** e **preserva** a posição nas demais filas | A regra atual pune a família e não devolve a vaga mais rápido |

**Risco associado a R3, e como tratamos.** Deslocar a validação para a matrícula abre espaço para
declaração indevida subir na fila e só ser flagrada depois, quando já deslocou outra criança. As
mitigações são três, e estão nos requisitos: o cruzamento automático do RF2.2 confirma sem depender
de documento a maior parte dos critérios de peso, incluindo o CadÚnico, que sozinho vale 51 dos 100
pontos; o RF2.4 exige documento anexado para o que a base não confirma, então não existe pontuação
sem lastro; e o RF2.6 devolve a vaga à fila e reclassifica a criança com a pontuação corrigida
quando a conferência reprova. O efeito líquido esperado é fortemente positivo, porque a barreira
que hoje derruba a validação a 6,8% atinge sobretudo quem tem direito real e não consegue faltar ao
trabalho para comprovar.

---

## 8. Requisitos não funcionais

- **RNF1. Mobile primeiro.** A maior parte do acesso é por celular, em rede móvel. Aplicativo
  instalável, funcional em aparelho antigo e com uso de dados contido.
- **RNF2. Escala.** 63 mil crianças, 872 unidades e mais de 300 mil opções por processo. A rodada
  completa de alocação executa em **menos de 10 minutos**.
- **RNF3. Determinismo.** A mesma entrada produz sempre a mesma saída. Sem isso não há auditoria.
- **RNF4. Auditabilidade.** Toda rodada, toda alteração de contato e toda conferência de documento
  ficam registradas com autor, data e valor anterior.
- **RNF5. LGPD.** Dado pessoal de criança e responsável tratado sob a base legal de execução de
  política pública. Documento de comprovação com retenção definida e expurgo ao fim do processo.
  Nenhum dado pessoal trafega para modelo de linguagem: a explicação do M4 é gerada sobre números
  agregados do motor.
- **RNF6. Acessibilidade.** WCAG 2.1 AA, com linguagem simples e leitura por leitor de tela.
- **RNF7. Disponibilidade.** Janela de inscrição é pico previsível. Capacidade dimensionada para o
  primeiro dia, que concentra a maior parte das inscrições.
- **RNF8. Interoperabilidade.** Integração com Receita, Data Lake, Registro Municipal Integrado e
  sistema de gestão acadêmica.

---

## 9. Arquitetura proposta

```
App da família (PWA instalável)        Painéis (diretor · CRE · central)
            │                                        │
            └──────────────┬─────────────────────────┘
                           │
                    API do processo
                           │
     ┌─────────────┬───────┴────────┬──────────────┬─────────────┐
     │             │                │              │             │
  Cadastro    Comprovação    Motor de alocação  Convocação   Transparência
  e contatos   + Data Lake   (determinístico)   SMS·e-mail    calendário
                                    │             ·push       + histórico
                                    │
                          Registro imutável de rodada
                          (entrada, régua, resultado)
                                    │
                          Explicação (Claude, sobre agregados)
```

**Decisão de engenharia central: o motor decide, o modelo explica.** A alocação é um algoritmo
determinístico e auditável. O Claude atua só na camada de explicação, sobre números que o motor já
produziu. Ele não pontua, não ordena e não reclassifica. Essa separação é o que torna o sistema
defensável perante órgão de controle.

**Já construído e validado neste protótipo:** o motor de emparelhamento estável (`pipeline/`), a
reconstrução da régua oficial ano a ano, a simulação comparativa de cenários e a camada de
explicação auditável. O restante é integração e interface.

---

## 10. Riscos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Mudança de norma não sai a tempo do processo seguinte | Alto | Sequenciar: R1, R2 e R5 destravam a maior parte do ganho e são as menos controversas. R3 pode entrar num segundo ato |
| Declaração indevida com validação só na matrícula | Médio | RF2.2, RF2.4 e RF2.6. Ver análise na seção 7 |
| Família sem smartphone ou sem letramento digital | Alto | Polos de atendimento presencial mantidos como canal equivalente, não como exceção. SMS cobre aparelho simples |
| Ordem vinculante mal compreendida leva a arrependimento | Médio | Interface explícita sobre o efeito da ordem, histórico de vaga por unidade (RF6.2) e janela de edição durante a inscrição |
| Coordenada geográfica incompleta prejudica a fase de remanescentes | Médio | 488 das 872 unidades têm coordenada no catálogo público. Completar o cadastro é pré-requisito da fase 3 |
| Resistência da rede a perder a etapa presencial de comprovação | Médio | A conferência continua na unidade, no ato da matrícula. O que muda é quando, não quem |
| Alocação empurra criança para longe de casa | Alto | Fase 3 é opcional e ordenada por proximidade às unidades escolhidas. Distância média entra como contramétrica |

---

## 11. Roadmap

**Fase 0 — Confirmação na base viva (2 a 4 semanas).** Rodar o motor sobre o processo de 2026 em
ambiente da SME e confirmar os achados, em especial a queda da validação de vulnerabilidade. Sem
isso, nada avança. Não depende de desenvolvimento novo.

**Fase 1 — Motor e painéis de gestão (1 a 2 meses).** Classificação por criança, duas rodadas,
fase de remanescentes, registro imutável, painéis de diretor, CRE e central, camada de explicação.
Roda em paralelo ao processo vigente, em modo sombra, para comparação.

**Fase 2 — Convocação multicanal (1 a 2 meses).** SMS, e-mail, notificação, aceite e recusa pela
família, contato editável, painel de acompanhamento de prazo. É onde estão as 5.994 crianças
perdidas por ano.

**Fase 3 — Aplicativo da família e comprovação (2 a 3 meses).** Inscrição com ordem vinculante,
upload de documentação, cruzamento automático, histórico de vagas por unidade, calendário público.

**Fase 4 — Substituição do módulo atual.** Corte no processo seguinte, com o sistema antigo em
leitura por um ciclo.

As mudanças normativas da seção 7 correm em paralelo desde a fase 0.

---

## 12. Decisões em aberto

Registradas aqui em vez de arbitradas no texto.

1. **Aplicativo instalável ou nativo.** Assumimos PWA instalável pelo alcance em aparelho antigo e
   pelo custo de distribuição. Decisão a confirmar com a SME.
2. **Definição operacional de proximidade na fase 3.** Assumimos menor distância entre a unidade
   remanescente e qualquer uma das unidades escolhidas pela família, com raio máximo parametrizável.
   Falta definir o raio.
3. **Prazo de resposta.** Mantivemos os 3 dias úteis atuais para caber na janela de 10 dias entre
   rodadas. Vale testar se 2 dias com aceite pelo aplicativo é suficiente.
4. **Número de rodadas.** Duas rodadas foi a definição do escopo. Os dados sugerem avaliar uma
   terceira no início do ano letivo, quando a rotatividade é maior.
5. **Tratamento das unidades parceiras** na fase de remanescentes, já que a capacidade delas segue
   regra de convênio distinta da rede própria.
