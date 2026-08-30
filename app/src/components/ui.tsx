"use client";
import { ReactNode, useEffect, useState } from "react";

export function Section({ id, kicker, title, lede, children }: {
  id?: string; kicker: string; title: string; lede?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {lede && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed" style={{ color: "var(--text-2)" }}>{lede}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

export function Stat({ value, label, note, tone = "text" }: {
  value: string; label: string; note?: string; tone?: "text" | "ganho" | "perda" | "fila" | "ociosa";
}) {
  const color = tone === "text" ? "var(--text-1)" : `var(--${tone})`;
  return (
    <div className="card p-5">
      <div className="num text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color }}>{value}</div>
      <div className="mt-1.5 text-sm font-medium">{label}</div>
      {note && <div className="mt-1 text-xs leading-snug" style={{ color: "var(--text-3)" }}>{note}</div>}
    </div>
  );
}

/** Alterna entre o gráfico e a tabela equivalente — exigência de acessibilidade. */
export function ChartFrame({ title, subtitle, table, children, height = 340 }: {
  title: string; subtitle?: string; table: ReactNode; children: ReactNode; height?: number;
}) {
  const [mode, setMode] = useState<"grafico" | "tabela">("grafico");
  return (
    <figure className="card overflow-hidden">
      <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--border)" }}>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {subtitle && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{subtitle}</p>}
        </div>
        <div className="flex shrink-0 rounded-lg p-0.5 text-xs font-medium" style={{ background: "var(--surface-2)" }}>
          {(["grafico", "tabela"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className="rounded-md px-2.5 py-1 capitalize transition"
              style={mode === m
                ? { background: "var(--surface-1)", color: "var(--text-1)", boxShadow: "0 1px 2px rgba(0,0,0,.08)" }
                : { color: "var(--text-3)" }}>
              {m === "grafico" ? "gráfico" : "tabela"}
            </button>
          ))}
        </div>
      </figcaption>
      <div className="p-5">
        {mode === "grafico" ? <div style={{ height }}>{children}</div> : <div className="overflow-x-auto">{table}</div>}
      </div>
    </figure>
  );
}

export function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b" style={{ borderColor: "var(--border)" }}>
          {head.map((h, i) => (
            <th key={h} className={`py-2 pr-4 text-xs font-semibold uppercase tracking-wide ${i === 0 ? "text-left" : "text-right"}`}
                style={{ color: "var(--text-3)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
            {r.map((c, j) => (
              <td key={j} className={`py-2 pr-4 ${j === 0 ? "text-left font-medium" : "num text-right"}`}
                  style={j === 0 ? undefined : { color: "var(--text-2)" }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]" style={{ color: "var(--text-2)" }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const d = document.documentElement.dataset.theme === "dark"
      || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(d);
  }, []);
  if (dark === null) return null;
  return (
    <button
      onClick={() => { const n = !dark; setDark(n); document.documentElement.dataset.theme = n ? "dark" : "light"; }}
      className="rounded-lg border px-2.5 py-1.5 text-xs font-medium"
      style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}>
      {dark ? "☀︎ claro" : "☾ escuro"}
    </button>
  );
}

/** Tooltip único para todos os gráficos, com tokens de texto (nunca a cor da série no texto). */
export function Tip({ active, payload, label, unit = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-[13px] shadow-lg" style={{ background: "var(--surface-1)" }}>
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: p.color }} aria-hidden />
          <span style={{ color: "var(--text-2)" }}>{p.name}</span>
          <span className="num ml-auto pl-3 font-medium">{new Intl.NumberFormat("pt-BR").format(p.value)}{unit}</span>
        </div>
      ))}
    </div>
  );
}
