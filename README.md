# Fila Única — uma criança, uma fila, uma vaga

**Painel e motor de alocação para a Inscrição Creche da SME-Rio.**
Claude Impact Lab Rio, 2ª edição · 30 de agosto de 2026.

🔗 **Aplicação publicada: https://fila-unica.pages.dev**
📄 **[PRD do sistema completo](PRD.md)** · 🎤 **[Roteiro do pitch](PITCH.md)** · ✉️ **[Texto da submissão](EMAIL.md)**

---

## Equipe

**Grupo 22** — Diego, Lucas, Carol, JP e Jarom.

---

## Resumo

A leitura mais fácil da fila da creche é escassez de vaga. Os dados dizem outra coisa.

Em 2025, a rede pública terminou o ano com **8.243 lugares fisicamente vazios** em turmas já
abertas e custeadas, enquanto milhares de crianças esperavam. A CRE 7 tinha 6.249 crianças na
fila; a CRE 9 tinha 1.415 lugares vazios e 179 crianças esperando. Não falta vaga no total —
ela está no lugar errado, e o processo que a distribui tem três defeitos estruturais:

1. **A fila é de opção, não de criança.** Cada família escolhe até 5 creches e o sistema trata
   cada escolha como uma fila independente. A mesma criança pode ser convocada em cinco lugares
   ao mesmo tempo, e cada convocação congela a vaga por três dias esperando uma resposta que já
   foi dada em outro lugar. 45 mil inscrições viram 837 mil linhas de fila.
2. **A régua de prioridade social está desligada.** 93% das inscrições de 2025 entram na fila
   com zero ponto, porque a comprovação de vulnerabilidade quase nunca é validada. O CadÚnico,
   critério que sozinho vale 51 dos 100 pontos, foi declarado por 35.141 famílias e validado em
   2.390 — **6,8%**. Em 2021 essa taxa era de 88,9%.
3. **Convocar não é matricular.** Em 2025, 5.994 crianças foram chamadas e mesmo assim ficaram
   sem creche. Somando 2021 a 2025, cerca de 44 mil.

A **Fila Única** troca o leilão sequencial de opções por um **emparelhamento estável**
(aceitação diferida de Gale–Shapley) — a mesma família de algoritmos que Nova York e Boston usam
para matrícula escolar, e que rendeu o Nobel de Economia de 2012 a Alvin Roth e Lloyd Shapley.
A criança é classificada **uma vez**, pela régua oficial da própria SME, e todas as suas opções
resolvem na mesma rodada.

### Resultado da simulação sobre o processo real de 2025

Mesmas 62.899 crianças inscritas. Mesmas 56.923 vagas. Mesma régua de pontuação da SME.
Nenhuma vaga inventada, nenhum critério novo.

| Cenário | Crianças na creche | Na 1ª escolha | Vulneráveis atendidas | Vagas ociosas |
| --- | ---: | ---: | ---: | ---: |
| Processo atual (o que aconteceu) | 48.680 | 35.139 | 28.426 | 8.243 |
| Fila Única | 50.047 | 40.838 | 29.900 | 6.876 |
| + oferta automática no bairro | 53.175 | 40.838 | 31.625 | 3.748 |
| **+ régua efetivamente validada** | **53.275** | **41.284** | **34.633** | **3.648** |

**+4.595 crianças na creche. +6.207 crianças vulneráveis atendidas. Ociosidade 56% menor.
Sem construir uma sala, sem contratar um professor, sem mudar um critério de prioridade.**

> **A premissa que sustenta esse número, dita em voz alta.** 3.020 das 4.595 crianças entram
> pela oferta automática no bairro, ou seja, numa creche que a família não escolheu, e a
> simulação assume que todas aceitam. O sistema real trata essa oferta como convite recusável.
> Sem nenhuma aceitação, o ganho é **+1.575 crianças** e a ociosidade cai 19% — vindo só do
> emparelhamento. Com recusa devolvendo a vaga para o próximo da fila, como o sistema prevê,
> 60% de aceite e três candidatos por vaga já devolvem +4.402.
> Tabela completa: [PRD, seção 5](PRD.md#a-premissa-que-mais-move-o-resultado-a-taxa-de-aceite-da-fase-3)
> · reproduzir: `python3 pipeline/07_sensibilidade.py`

---

## Arquitetura e abordagem

```
dados/ (bases reais da SME)
   │
   ├─ pipeline/01_pontuacao.py   reconstrói a régua oficial de pontuação, ano a ano
   ├─ pipeline/02_matching.py    motor de aceitação diferida + fallback territorial
   ├─ pipeline/03_export.py      agregados por CRE, unidade, régua e funil → JSON
   └─ pipeline/04_cenarios.py    roda os 4 cenários que o painel compara
   │
   └──▶ app/public/data/*.json
              │
              ├─ pipeline/07_sensibilidade.py   lê os cenários e mede quanto do ganho
              │                                 depende do aceite da Fase 3
              │
              └─ app/  Next.js 16 (static export) → Cloudflare Pages
                       sem backend, sem banco: o painel é HTML e JSON estático
```

### O motor

`pipeline/04_cenarios.py` implementa **aceitação diferida com a criança propondo**:

- **Preferências** vêm das opções que a família já declarou, na ordem que ela já escolheu.
  Nada de preferência inventada.
- **Prioridade da unidade** é a régua oficial reconstruída da Query C: soma dos pontos das
  perguntas respondidas e validadas, depois os critérios de desempate (`perg_criterio = 'Sim'`),
  depois a data de inscrição. Trocar a régua é trocar uma tabela, não reescrever o motor.
- **Capacidade** por (unidade × grupamento × turno) = crianças que o processo efetivamente
  alocou **+** lugares fisicamente vazios, derivados de `turmas × 25`. O teto de 25 não foi
  arbitrado: é o p90 observado de alunos por turma em todos os seis grupamentos de 2025.
- **Estabilidade**: ao final ninguém tem inveja justificada. Se a criança não entrou onde
  queria, é porque todos os que entraram tinham prioridade maior pela régua da própria SME.
  Isso é auditável linha a linha — requisito real, porque a fila da creche é acompanhada por
  órgãos de controle.

### Como o Claude foi usado

**Para construir.** O projeto inteiro foi desenvolvido em par com o Claude via Claude Code:
exploração das quatro bases com DuckDB, reconstrução da régua, implementação do motor,
o painel e o deploy. Três decisões que saíram dessa conversa e mudaram o resultado:

- O primeiro contrafactual deu **negativo**. Definir capacidade como "o que a rede matriculou"
  torna o resultado observado ótimo por construção — nenhum algoritmo pode superá-lo. Foi um
  erro metodológico pego e corrigido durante a análise, não depois.
- A segunda versão inflou o ganho, porque comparava **fluxo com estoque**: a capacidade de turma
  inclui crianças que permanecem de um ano para o outro e nunca passam pelo processo. A
  definição final — alocados no processo + lugares fisicamente vazios — é a conservadora.
- O achado da validação em 6,8% do CadÚnico apareceu ao cruzar `resposta` com `confirmado` na
  Query B, uma coluna que o dicionário descreve em uma linha e que ninguém pediu para olhar.

**Dentro da aplicação.** A seção **Auditoria** do painel usa o Claude para explicar, em português
de servidor público, por que cada criança ficou onde ficou: qual foi a pontuação que valeu, qual
era a nota de corte da unidade que ela queria, e — o caso mais importante — quais critérios a
família declarou, quanto eles valeriam e por que não contaram por falta de validação.

A divisão de trabalho é deliberada e é o ponto de engenharia da coisa: **o motor decide, o Claude
explica.** Todo número exibido sai do algoritmo determinístico; o modelo recebe esses números já
estruturados e só traduz. Ele não pontua, não ordena e não reclassifica ninguém. As explicações
são geradas no build (`pipeline/06_explicar.py`, Claude Sonnet 5, ~US$ 0,32 para 60 casos) e
servidas como texto estático, então a demo não depende de rede e nenhum dado de criança trafega
para um modelo em produção.

Isso não é enfeite. A fila da creche é acompanhada por órgãos de controle e cobrada no balcão da
unidade: um algoritmo que ninguém consegue explicar não é adotável, por mais correto que seja.

---

## Reproduzir

```bash
git clone https://github.com/CIT-SME-RJ/dadoscreche.git dados   # bases da SME (~69 MB)
pip install duckdb pandas openpyxl

python3 pipeline/01_pontuacao.py     # régua oficial por ano
python3 pipeline/02_matching.py 2025 # motor, um ano
python3 pipeline/03_export.py        # agregados do painel
python3 pipeline/04_cenarios.py      # os 4 cenários
python3 pipeline/07_sensibilidade.py # sensibilidade do ganho ao aceite da Fase 3

cd app && npm install && npm run dev
```

As bases não estão versionadas aqui: são do repositório oficial da SME e pesam 69 MB.
O pipeline lê os `.csv.gz` direto, sem descompactar.

### Armadilhas dos dados que o pipeline já trata

- `situacao = 'Cancelado na confirmacao'` — **sem cedilha e sem til**. Filtrar com acento devolve zero linhas.
- `04_UnidadesEscolares` **não tem cabeçalho** e o código da unidade precisa ser lido como string
  com zero à esquerda (`zfill(7)`), senão o join com a Query A morre silenciosamente.
- Bairro vem sujo: `JACAREPAGUÁ` e `JACAREPAGUA` são o mesmo bairro. Normalizamos acento e espaço.
- **A régua mudou entre 2023 e 2024.** A pergunta sobre deficiência valia 100 pontos e passou a
  valer 25. Série temporal montada sem normalizar isso é falsa.
- Uma criança gera até 5 linhas por ano. Contar linhas em vez de `aluno_anon` infla tudo por ~2,4×.
- A Query B tem 4,3 milhões de linhas e não abre no Excel. Usamos DuckDB.

---

## O que está pronto e o que não está

**Pronto e reprodutível hoje**

- Motor de aceitação diferida rodando do CSV cru ao resultado, com um comando, sobre as 4 bases reais.
- Reconstrução da régua oficial ano a ano, incluindo a mudança de escala de 2023 para 2024.
- Painel publicado, estático, sem backend, com tabela equivalente a cada gráfico, tema claro e
  escuro e paleta validada para daltonismo.

**Ainda não está aqui**

- Rodar sobre a base viva de 2026. Isso depende de acesso ao ambiente da SME, não de mais código.
- Distância porta a porta. Hoje a proximidade é por bairro, porque o dado anonimizado só expõe
  bairro e CEP.
- 348 das 872 unidades não têm coordenada no catálogo público, então o mapa cobre a rede pública.
- A camada de convocação assistida (redigir e disparar o contato com a família nos canais que ela usa).
- **O alerta sobre a validação do CadÚnico precisa ser confirmado na base real antes de virar
  decisão.** Os dados são anonimizados e a própria SME adverte que valores absolutos não
  reproduzem a realidade. O que a base preserva, e é o que medimos, é a lógica do processo.

---

## Dados

[`CIT-SME-RJ/dadoscreche`](https://github.com/CIT-SME-RJ/dadoscreche) — base anonimizada da
Inscrição Creche, processos de 2021 a 2025, publicada pela Coordenadoria de Inovação e
Tecnologia da Secretaria Municipal de Educação do Rio de Janeiro.
