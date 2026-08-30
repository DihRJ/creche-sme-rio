# Pitch — 6 minutos, corte seco aos 6:00

**Demo ao vivo em https://fila-unica.pages.dev · deixe a aba já aberta e o simulador em "Processo atual".**

## 0:00–0:45 — A pergunta errada
"A fila da creche parece um problema de falta de vaga. Em 2025 a rede pública terminou o ano
com 8.243 lugares vazios em turmas já abertas e pagas, com professor contratado, enquanto
milhares de crianças esperavam."

→ Mostre o gráfico das CREs. "CRE 7: 6.249 crianças na fila. CRE 9: 1.415 lugares vazios e
179 crianças esperando. Não falta vaga. Ela está no lugar errado."

## 0:45–2:00 — Os três defeitos
1. **A fila é de opção, não de criança.** A mesma criança gera cinco filas e pode ser convocada
   em cinco lugares ao mesmo tempo. Cada convocação congela uma vaga por três dias esperando uma
   resposta que a família já deu em outro lugar. 45 mil inscrições viram 837 mil linhas.
2. **A régua de prioridade está desligada.** → Mostre o gráfico da régua. "35.141 famílias
   declararam CadÚnico. O critério vale 51 dos 100 pontos. Foram validados 2.390. Seis vírgula
   oito por cento. Em 2021 essa taxa era 88,9%." Pausa. "93% das inscrições entram na fila com
   zero ponto. A régua que deveria proteger a criança mais vulnerável não chega a ser aplicada."
3. **Convocar não é matricular.** 5.994 crianças chamadas e mesmo assim sem creche em 2025.

## 2:00–3:00 — A solução em uma frase
"Trocar o leilão sequencial de opções por emparelhamento estável. A criança é classificada uma
vez, pela régua da própria SME, e todas as opções resolvem na mesma rodada. É o algoritmo que
Nova York e Boston usam para matrícula escolar e que deu o Nobel de Economia de 2012 ao Alvin
Roth. Não é ideia nova: é ideia testada que ainda não chegou aqui."

## 3:00–4:30 — Demo do simulador
Clique nos quatro cenários, um a um, narrando o que cada um acrescenta.
Termine em "Fila Única + régua valendo" e leia os quatro números na tela:

> **53.275 crianças na creche. 41.284 na primeira escolha. 34.633 vulneráveis atendidas.
> 3.648 vagas ociosas.**
> **+4.595 crianças. +6.207 vulneráveis. Ociosidade 56% menor.**

"Mesmas vagas. Mesma régua. Mesmo orçamento. Nenhuma sala nova, nenhum professor novo."

## 4:30–5:20 — Por que dá para usar amanhã
- Roda do CSV cru ao resultado com um comando, sobre as quatro bases reais.
- A régua é uma tabela. A SME muda o peso do CadÚnico e roda de novo.
- O resultado é auditável: se a criança não entrou onde queria, dá para mostrar exatamente
  quem tinha prioridade maior e por quê. Isso importa porque a fila é acompanhada por órgãos
  de controle.
- Não substitui o sistema. Entra como o módulo de classificação, no lugar do que já existe.

## 5:20–6:00 — O que não está pronto (diga você antes que perguntem)
"Três coisas. Não rodamos na base viva de 2026, isso depende de acesso, não de código.
A proximidade é por bairro, porque o dado anonimizado não traz endereço. E o achado do CadÚnico
precisa ser confirmado na base real antes de virar decisão — se ele se confirmar, é a correção
mais barata e mais urgente da lista, e não depende de nada que a gente construiu hoje."

---

## Perguntas prováveis do Q&A

**"Os dados são anonimizados, esse número vale?"**
Os valores absolutos não. A SME avisa isso e nós repetimos no painel. O que a base preserva, e
é o que medimos, é a lógica do processo: a régua, a estrutura das opções e a transição de
estado. A comparação é entre dois algoritmos sobre a mesma base, então o viés é o mesmo dos
dois lados. O ganho relativo é o resultado, não o valor absoluto.

**"De onde saiu a capacidade das vagas?"**
Turmas × 25 alunos, do arquivo de monitoramento da própria SME. O 25 não foi arbitrado: é o p90
observado de alunos por turma nos seis grupamentos de 2025. E contamos só a sobra física, não a
capacidade total, justamente para não contar como vaga nova o lugar de uma criança que
permanece na rede.

**"E a família que quer uma creche perto do trabalho, não do endereço?"**
A preferência continua sendo a que ela declarou. Nós não reordenamos a escolha dela. A oferta
por bairro só entra para quem não conseguiu nenhuma das cinco e hoje ficaria de fora.

**"Por que a validação caiu de 88,9% para 8%?"**
Não sabemos, e não vamos inventar. O que dá para dizer é quando: entre o processo de 2021 e o
de 2022. É a primeira coisa que a gente olharia na base viva.

**"Quanto tempo para colocar em produção?"**
O motor está pronto e é determinístico. O trabalho real é integração e homologação com a régua
oficial do ano, não algoritmo.
