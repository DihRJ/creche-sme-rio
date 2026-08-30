"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C, ORDEM, fmt } from "@/lib/data";
import { Legend, Table, Tip } from "./ui";

const axis = { fontSize: 12, fill: "var(--text-3)" };

export function Simulador() {
  const [sel, setSel] = useState<(typeof ORDEM)[number]>("regua_viva");
  const base = C.cenarios.atual;
  const cur = C.cenarios[sel];
  const delta = (a: number, b: number) => `${b - a >= 0 ? "+" : ""}${fmt(b - a)}`;

  const linhas = [
    { rot: "Crianças na creche", base: base.alocadas, cur: cur.alocadas, bom: "cima" },
    { rot: "Na creche que a família escolheu primeiro", base: Number(base.por_opcao["1"] ?? 0), cur: Number(cur.por_opcao["1"] ?? 0), bom: "cima" },
    { rot: "Crianças vulneráveis atendidas", base: base.vulneraveis_atendidas, cur: cur.vulneraveis_atendidas, bom: "cima" },
    { rot: "Vagas que sobram vazias", base: base.ociosas, cur: cur.ociosas, bom: "baixo" },
  ];

  const d = [1, 2, 3, 4, 5].map((o) => ({
    opcao: `${o}ª`,
    atual: Number(base.por_opcao[String(o)] ?? 0),
    cenario: Number(cur.por_opcao[String(o)] ?? 0),
  }));

  return (
    <div className="card overflow-hidden">
      <div className="border-b p-5" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-base font-semibold">Simulador do processo de 2025</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Cada cenário roda o processo inteiro do zero sobre as 62.899 crianças inscritas e as
          {" "}{fmt(C.vagas)} vagas reais. Nenhuma vaga é inventada: o total é o mesmo nos quatro.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ORDEM.map((k) => (
            <button key={k} onClick={() => setSel(k)} aria-pressed={sel === k}
              className="rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition"
              style={sel === k
                ? { borderColor: "var(--ganho)", background: "var(--surface-2)", color: "var(--text-1)" }
                : { borderColor: "var(--border)", color: "var(--text-2)" }}>
              {C.cenarios[k].nome}
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          {cur.descricao}
        </p>
      </div>

      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--border)" }}>
        {linhas.map((l) => {
          const diff = l.cur - l.base;
          const melhorou = l.bom === "cima" ? diff > 0 : diff < 0;
          const neutro = diff === 0;
          return (
            <div key={l.rot} className="p-5" style={{ background: "var(--surface-1)" }}>
              <div className="text-[13px] leading-snug" style={{ color: "var(--text-2)" }}>{l.rot}</div>
              <div className="num mt-2 text-3xl font-semibold tracking-tight">{fmt(l.cur)}</div>
              <div className="num mt-1 text-[13px] font-medium"
                   style={{ color: neutro ? "var(--text-3)" : melhorou ? "var(--ganho)" : "var(--perda)" }}>
                {neutro ? "sem mudança" : `${delta(l.base, l.cur)} vs. processo atual`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-5">
        <Legend items={[
          { label: "Processo atual", color: "var(--text-3)" },
          { label: cur.nome, color: "var(--ganho)" },
        ]} />
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d} margin={{ top: 22, right: 8, left: 4, bottom: 4 }} barGap={2}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="opcao" tick={axis} tickLine={false} axisLine={{ stroke: "var(--grid)" }}
                     label={{ value: "opção escolhida pela família", position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "var(--text-3)" } }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={48}
                     tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
              <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="atual" isAnimationActive={false} name="Processo atual" fill="var(--text-3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cenario" isAnimationActive={false} name={cur.nome} fill="var(--ganho)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="cenario" position="top"
                           formatter={(v) => (Number(v) > 3000 ? fmt(Number(v)) : "")}
                           style={{ fontSize: 11, fill: "var(--text-2)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--text-2)" }}>
            Ver os quatro cenários em tabela
          </summary>
          <div className="mt-3 overflow-x-auto">
            <Table head={["Cenário", "Na creche", "1ª escolha", "Vulneráveis", "Vagas ociosas"]}
              rows={ORDEM.map((k) => {
                const c = C.cenarios[k];
                return [c.nome, fmt(c.alocadas), fmt(Number(c.por_opcao["1"] ?? 0)),
                        fmt(c.vulneraveis_atendidas), fmt(c.ociosas)];
              })} />
          </div>
        </details>
      </div>
    </div>
  );
}
