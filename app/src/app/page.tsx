"use client";
import { CreChart, FunilChart, Mapa, ReguaChart } from "@/components/charts";
import { Section, Stat, ThemeToggle } from "@/components/ui";
import { Auditoria } from "@/components/auditoria";
import { Simulador } from "@/components/simulador";
import { C, fmt } from "@/lib/data";

export default function Home() {
  const base = C.cenarios.atual;
  const alvo = C.cenarios.regua_viva;
  const ganho = alvo.alocadas - base.alocadas;
  const ganhoVuln = alvo.vulneraveis_atendidas - base.vulneraveis_atendidas;
  const ganho1a = Number(alvo.por_opcao["1"]) - Number(base.por_opcao["1"]);

  return (
    <main>
      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">Fila Única</span>
            <span className="hidden text-[13px] sm:inline" style={{ color: "var(--text-3)" }}>
              uma criança, uma fila, uma vaga
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] sm:inline" style={{ color: "var(--text-3)" }}>
              SME-Rio · Inscrição Creche
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Herói ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-5 pb-2 pt-14 sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
          Simulação sobre o processo de 2025
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
          <span className="num" style={{ color: "var(--ganho)" }}>+{fmt(ganho)}</span> crianças
          <br className="hidden sm:block" /> na creche, sem abrir uma vaga nova.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Sem construir sala, sem contratar professor, sem mexer na régua de prioridade.
          Só trocando o algoritmo que ordena a fila da creche: hoje a SME classifica <strong>opção</strong>,
          e a Fila Única classifica <strong>criança</strong>.
        </p>

        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat tone="ganho" value={`+${fmt(ganho)}`} label="Crianças atendidas a mais"
                note={`De ${fmt(base.alocadas)} para ${fmt(alvo.alocadas)} em 2025`} />
          <Stat tone="ganho" value={`+${fmt(ganhoVuln)}`} label="Crianças vulneráveis a mais"
                note={`Famílias no CadÚnico ou Bolsa Família: de ${fmt(base.vulneraveis_atendidas)} para ${fmt(alvo.vulneraveis_atendidas)}`} />
          <Stat tone="ganho" value={`+${fmt(ganho1a)}`} label="A mais na primeira escolha"
                note="A creche que a família colocou como opção 1" />
          <Stat tone="ociosa" value={`−${Math.round(100 * (1 - alvo.ociosas / base.ociosas))}%`} label="Vagas ociosas"
                note={`De ${fmt(base.ociosas)} lugares vazios para ${fmt(alvo.ociosas)}`} />
        </div>

        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Simulação feita sobre a base anonimizada de 2021 a 2025 publicada pela SME. Como a própria
          secretaria adverte, os valores absolutos não reproduzem a realidade — o que a base preserva,
          e é isso que medimos aqui, é a <strong>lógica do processo</strong>: a régua de pontuação,
          a estrutura das opções e a dinâmica de transição de estado.
        </p>
      </div>

      {/* ── O diagnóstico ─────────────────────────────────────────────── */}
      <Section
        kicker="O diagnóstico"
        title="Três coisas quebradas, e nenhuma delas é falta de vaga"
        lede="A leitura mais fácil da fila da creche é escassez. Os dados dizem outra coisa: em 2025 sobraram lugares vazios em turmas já abertas enquanto milhares de crianças esperavam.">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { n: "01", t: "A fila é de opção, não de criança",
              d: "Cada família escolhe até 5 creches, e o sistema trata cada escolha como uma fila separada. Uma criança pode ser convocada em cinco lugares ao mesmo tempo, e cada convocação trava a vaga por três dias. 45 mil inscrições viram 837 mil linhas de fila." },
            { n: "02", t: "A régua de prioridade está desligada",
              d: "93% das inscrições de 2025 entram com zero ponto porque a comprovação de vulnerabilidade quase nunca é validada. O CadÚnico, que vale metade da régua, valida em 6,8% dos casos." },
            { n: "03", t: "A sobra e a falta estão em regiões diferentes",
              d: "A CRE 7 tinha 6.249 crianças na fila. A CRE 9, 1.415 lugares vazios e 179 crianças esperando. O problema não é o total de vagas, é onde elas estão." },
          ].map((c) => (
            <div key={c.n} className="card p-5">
              <div className="num text-xs font-semibold" style={{ color: "var(--text-3)" }}>{c.n}</div>
              <h3 className="mt-2 text-[17px] font-semibold leading-snug">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        kicker="O simulador"
        title="Rode o processo de 2025 de novo, do jeito que ele poderia ser"
        lede="Quatro cenários sobre exatamente os mesmos dados. O primeiro é o que aconteceu de verdade; os outros três acrescentam uma mudança de cada vez, para ficar claro quanto vem de cada uma.">
        <Simulador />
      </Section>

      <Section kicker="Evidência 1" title="O descompasso é territorial">
        <CreChart />
      </Section>

      <Section kicker="Evidência 2" title="Onde a criança espera e onde o lugar está vazio">
        <Mapa />
      </Section>

      <Section kicker="Evidência 3" title="A prioridade social que não chega a ser aplicada">
        <ReguaChart />
      </Section>

      <Section kicker="Evidência 4" title="Convocar não é o mesmo que matricular">
        <FunilChart />
      </Section>

      {/* ── A proposta ────────────────────────────────────────────────── */}
      <Section
        kicker="A proposta"
        title="Fila Única: classificar a criança, alocar tudo numa rodada"
        lede={<>A Inscrição Creche hoje é um leilão sequencial de opções. A Fila Única troca isso por um <strong>emparelhamento estável</strong> — a mesma família de algoritmos que Nova York e Boston usam para matrícula escolar, e que rendeu o Nobel de Economia de 2012 a Alvin Roth e Lloyd Shapley. A criança propõe na ordem de preferência que ela já declarou; a unidade retém as melhores pontuações até lotar e devolve o resto para a rodada seguinte. Ao final, ninguém fica com inveja justificada: se a criança não entrou onde queria, é porque todo mundo naquela vaga tinha prioridade maior pela régua da própria SME.</>}>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { t: "Acaba a cascata de três dias", d: "Uma criança recebe uma oferta só, a melhor a que ela tem direito. A vaga não fica reservada esperando enquanto a mesma criança decide entre cinco convocações." },
            { t: "A régua continua sendo a da SME", d: "Nada de pontuação nova ou critério inventado. O motor lê a régua oficial da Query C, ano a ano, incluindo os critérios de desempate. Trocar a régua é trocar uma tabela." },
            { t: "Sobra vira oferta no bairro", d: `Quem não entrou em nenhuma das cinco opções recebe automaticamente a vaga ociosa mais próxima no próprio bairro. Foram ${fmt(alvo.realocadas_no_bairro)} crianças em 2025.` },
          ].map((c) => (
            <div key={c.t} className="card p-5">
              <h3 className="text-[17px] font-semibold leading-snug">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        kicker="Auditoria"
        title="Toda decisão da fila tem que caber numa frase que a família entenda"
        lede={<>A fila da creche é acompanhada por órgãos de controle e cobrada no balcão da unidade. Um algoritmo que ninguém consegue explicar não serve, por mais correto que seja. Aqui o motor entrega os números e o Claude escreve a explicação. Comece pelo primeiro filtro: são as famílias que declararam um direito, não tiveram a comprovação validada e concorreram com pontuação menor do que a que lhes cabia.</>}>
        <Auditoria />
      </Section>

      {/* ── Honestidade ───────────────────────────────────────────────── */}
      <Section
        kicker="O que está pronto e o que não está"
        title="Onde a gente parou hoje"
        lede="Critério de julgamento é impacto real, então vale ser exato sobre o que já roda e o que ainda é promessa.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="text-[17px] font-semibold" style={{ color: "var(--ganho)" }}>Pronto e reprodutível</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              <li>Motor de aceitação diferida rodando sobre as 4 bases reais, do CSV ao resultado, com um comando.</li>
              <li>Reconstrução da régua oficial de pontuação ano a ano, incluindo a mudança de 2023 para 2024.</li>
              <li>Capacidade derivada de turmas × teto normativo de 25, checada contra o p90 observado.</li>
              <li>Este painel, estático, sem backend, acessível e com tabela equivalente em cada gráfico.</li>
              <li>Explicação auditável de cada alocação em português, gerada pelo Claude sobre os números do motor.</li>
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="text-[17px] font-semibold" style={{ color: "var(--fila)" }}>Ainda não está aqui</h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
              <li>Rodar sobre a base viva de 2026: precisa de acesso ao ambiente da SME, não de mais código.</li>
              <li>Distância porta a porta. Hoje a proximidade é por bairro, porque o dado anonimizado só traz bairro e CEP.</li>
              <li>348 das 872 unidades não têm coordenada no catálogo público, então o mapa cobre a rede pública.</li>
              <li>O alerta sobre a validação do CadÚnico precisa ser confirmado na base real antes de virar decisão.</li>
            </ul>
          </div>
        </div>
      </Section>

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-5 py-8 text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Fila Única · Grupo 22 · Claude Impact Lab Rio, 2ª edição · 30 de agosto de 2026.
          Dados: <span style={{ color: "var(--text-2)" }}>CIT-SME-RJ/dadoscreche</span>, base anonimizada da
          Secretaria Municipal de Educação do Rio de Janeiro.
        </div>
      </footer>
    </main>
  );
}
