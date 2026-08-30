"use client";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, LabelList,
} from "recharts";
import { CRE, CRE_NOME, FUNIL, M, REGUA, UNIDADES, fmt } from "@/lib/data";
import { ChartFrame, Legend, Table, Tip } from "./ui";

const axis = { fontSize: 12, fill: "var(--text-3)" };
const grid = <CartesianGrid stroke="var(--grid)" vertical={false} />;

/* ── 1. Descompasso territorial: fila x vaga ociosa, por CRE ─────────────── */
export function CreChart() {
  const d = CRE.map((c) => ({
    cre: `CRE ${c.cre}`, nome: CRE_NOME[c.cre], fila: c.fila, ociosas: c.ociosas,
  }));
  return (
    <ChartFrame
      height={380}
      title="A fila e a vaga vazia estão em regiões diferentes"
      subtitle="Cada Coordenadoria Regional de Educação em 2025: crianças esperando contra lugares fisicamente vazios em turmas já abertas. A CRE 7 concentra a fila; a CRE 9 concentra a sobra."
      table={<Table head={["Coordenadoria", "Crianças na fila", "Vagas ociosas"]}
        rows={CRE.map((c) => [`CRE ${c.cre} · ${CRE_NOME[c.cre]}`, fmt(c.fila), fmt(c.ociosas)])} />}>
      <>
        <Legend items={[{ label: "Crianças na fila", color: "var(--fila)" }, { label: "Vagas ociosas", color: "var(--ociosa)" }]} />
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={d} margin={{ top: 8, right: 8, left: 4, bottom: 4 }} barGap={2}>
            {grid}
            <XAxis dataKey="cre" tick={axis} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={48}
                   tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="fila" isAnimationActive={false} name="Crianças na fila" fill="var(--fila)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ociosas" isAnimationActive={false} name="Vagas ociosas" fill="var(--ociosa)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </>
    </ChartFrame>
  );
}

/* ── 2. Em que opção a criança foi atendida: hoje x Fila Única ───────────── */
export function OpcaoChart() {
  const d = [1, 2, 3, 4, 5].map((o) => ({
    opcao: `${o}ª opção`,
    atual: M.atual.por_opcao[String(o)] ?? 0,
    unica: M.fila_unica.por_opcao[String(o)] ?? 0,
  }));
  return (
    <ChartFrame
      height={360}
      title="Com a Fila Única, mais criança entra na creche que a família escolheu primeiro"
      subtitle="Mesmas vagas, mesma régua de pontuação da SME. Só muda o algoritmo: em vez de classificar cada opção separadamente, classifica a criança uma vez e resolve todas as opções na mesma rodada."
      table={<Table head={["Opção atendida", "Processo atual", "Fila Única", "Diferença"]}
        rows={d.map((r) => [r.opcao, fmt(r.atual), fmt(r.unica), `${r.unica - r.atual > 0 ? "+" : ""}${fmt(r.unica - r.atual)}`])} />}>
      <>
        <Legend items={[{ label: "Processo atual", color: "var(--text-3)" }, { label: "Fila Única", color: "var(--ganho)" }]} />
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={d} margin={{ top: 20, right: 8, left: 4, bottom: 4 }} barGap={2}>
            {grid}
            <XAxis dataKey="opcao" tick={axis} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={48}
                   tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="atual" isAnimationActive={false} name="Processo atual" fill="var(--text-3)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="unica" isAnimationActive={false} name="Fila Única" fill="var(--ganho)" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="unica" position="top" formatter={(v) => (Number(v) > 3000 ? fmt(Number(v)) : "")}
                         style={{ fontSize: 11, fill: "var(--text-2)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </>
    </ChartFrame>
  );
}

/* ── 3. Crianças que foram chamadas e mesmo assim ficaram sem creche ─────── */
export function FunilChart() {
  const d = FUNIL.map((f) => ({ ano: String(f.ano), perdidas: f.convocadas_e_perdidas }));
  return (
    <ChartFrame
      height={320}
      title="Crianças convocadas que perderam a vaga"
      subtitle="A vaga existia, a criança foi chamada e a matrícula não aconteceu — contato desatualizado, prazo de três dias, aviso que não chegou. Melhorou muito desde 2021, mas ainda são milhares por ano."
      table={<Table head={["Ano", "Convocadas e perdidas", "Matricularam", "Só fila de espera"]}
        rows={FUNIL.map((f) => [f.ano, fmt(f.convocadas_e_perdidas), fmt(f.matricularam), fmt(f.so_fila)])} />}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={d} margin={{ top: 24, right: 8, left: 4, bottom: 4 }}>
          {grid}
          <XAxis dataKey="ano" tick={axis} tickLine={false} axisLine={{ stroke: "var(--grid)" }} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={48}
                 tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="perdidas" isAnimationActive={false} name="Crianças" fill="var(--perda)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="perdidas" position="top" formatter={(v) => fmt(Number(v))}
                       style={{ fontSize: 11, fill: "var(--text-2)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ── 4. A régua de vulnerabilidade que quase nunca é validada ────────────── */
export function ReguaChart() {
  // rotulos curtos: o texto oficial da pergunta nao cabe no eixo e truncar no meio fica ilegivel
  const CURTO: Record<number, string> = {
    28: "Inscrita no CadÚnico", 6: "Bolsa Família ou Cartão Carioca",
    29: "Irmão já matriculado na rede", 27: "Esperou na fila no ano anterior",
    20: "Família monoparental", 12: "Familiar preso ou ex-preso",
    18: "Doença crônica grave na família", 16: "Uso abusivo de álcool ou droga",
    30: "Responsável com menos de 18 anos", 31: "Público-alvo da educação especial",
    17: "Vítima de violência doméstica", 25: "Responsável com deficiência",
    23: "Criança refugiada",
  };
  const d = REGUA.filter((r) => r.ano === 2025 && r.declarou > 900)
    .sort((a, b) => b.declarou - a.declarou)
    .map((r) => ({
      nome: CURTO[r.perg_id] ?? r.pergunta_texto.slice(0, 34),
      declarou: r.declarou, validou: r.validou, pct: r.pct, pontos: r.pontos,
    }));
  return (
    <ChartFrame
      height={420}
      title="A régua de prioridade social não chega a valer"
      subtitle="Em 2025, 35.141 famílias declararam estar no CadÚnico — o critério que sozinho vale 51 dos 100 pontos. Apenas 2.390 tiveram a informação validada. Resultado: 93% das inscrições entram na fila com zero ponto, e a ordem deixa de refletir a vulnerabilidade que ela deveria proteger."
      table={<Table head={["Critério", "Pontos", "Declararam", "Validados", "% validado"]}
        rows={d.map((r) => [r.nome, r.pontos, fmt(r.declarou), fmt(r.validou), `${r.pct}%`])} />}>
      <>
        <Legend items={[{ label: "Famílias que declararam", color: "var(--text-3)" }, { label: "Validados pela rede", color: "var(--fila)" }]} />
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={d} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }} barGap={2}>
            <CartesianGrid stroke="var(--grid)" horizontal={false} />
            <XAxis type="number" tick={axis} tickLine={false} axisLine={false}
                   tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
            <YAxis type="category" dataKey="nome" tick={{ ...axis, fontSize: 11 }} tickLine={false}
                   axisLine={false} width={230} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="declarou" isAnimationActive={false} name="Declararam" fill="var(--text-3)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="validou" isAnimationActive={false} name="Validados" fill="var(--fila)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`}
                         style={{ fontSize: 11, fill: "var(--text-2)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </>
    </ChartFrame>
  );
}

/* ── 5. Mapa: onde está a fila e onde está a vaga vazia ──────────────────── */
export function Mapa() {
  const pts = UNIDADES.filter((u) => u.lat != null && u.lng != null) as Required<typeof UNIDADES[number]>[];
  const lats = pts.map((p) => p.lat!), lngs = pts.map((p) => p.lng!);
  const [x0, x1] = [Math.min(...lngs), Math.max(...lngs)];
  const [y0, y1] = [Math.min(...lats), Math.max(...lats)];
  const W = 1000, H = 420, pad = 18;
  const px = (lng: number) => pad + ((lng - x0) / (x1 - x0)) * (W - 2 * pad);
  const py = (lat: number) => H - pad - ((lat - y0) / (y1 - y0)) * (H - 2 * pad);
  const r = (n: number) => Math.max(3.5, Math.min(16, Math.sqrt(n) * 0.9));
  const top = [...pts].sort((a, b) => b.fila - a.fila).slice(0, 12);

  return (
    <ChartFrame
      height={440}
      title="Onde está a fila e onde está a vaga vazia"
      subtitle={`${pts.length} unidades da rede pública com localização. Cada círculo é uma unidade: laranja quando há mais criança esperando do que lugar vago, azul quando sobra lugar. O tamanho é o tamanho do desequilíbrio.`}
      table={<Table head={["Unidade", "Bairro", "CRE", "Fila", "Ociosas"]}
        rows={top.map((u) => [u.nome, u.bairro ?? "—", u.cre ?? "—", fmt(u.fila), fmt(u.ociosas)])} />}>
      <div className="flex h-full w-full flex-col">
        <Legend items={[{ label: "Fila maior que a sobra", color: "var(--fila)" }, { label: "Sobra maior que a fila", color: "var(--ociosa)" }]} />
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img"
             aria-label="Mapa das unidades de creche do Rio de Janeiro por desequilíbrio entre fila e vagas ociosas"
             style={{ flex: 1, minHeight: 0 }}>
          {pts.map((u) => {
            const excesso = u.fila - u.ociosas;
            const cor = excesso > 0 ? "var(--fila)" : "var(--ociosa)";
            return (
              <circle key={u.unidade} cx={px(u.lng!)} cy={py(u.lat!)} r={r(Math.abs(excesso) || 1)}
                      fill={cor} fillOpacity={0.55} stroke="var(--surface-1)" strokeWidth={2}>
                <title>{`${u.nome} — ${u.bairro ?? ""}\nFila: ${fmt(u.fila)} · Vagas ociosas: ${fmt(u.ociosas)}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </ChartFrame>
  );
}
