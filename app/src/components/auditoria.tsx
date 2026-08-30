"use client";
import { useMemo, useState } from "react";
import { CASOS, Caso, EXPLICACOES, fmt, pontosDeDireito } from "@/lib/data";

type Filtro = "perdeu_direito" | "sem_vaga" | "conseguiu" | "todos";

const FILTROS: { k: Filtro; rot: string; teste: (c: Caso) => boolean }[] = [
  { k: "perdeu_direito", rot: "Tinha direito a pontos que não valeram",
    teste: (c) => c.criterios_so_declarados.length > 0 },
  { k: "sem_vaga", rot: "Não conseguiu vaga", teste: (c) => !c.resultado_fila_unica.conseguiu },
  { k: "conseguiu", rot: "Conseguiu a primeira opção",
    teste: (c) => c.resultado_fila_unica.opcao === 1 },
  { k: "todos", rot: "Todos", teste: () => true },
];

export function Auditoria() {
  const [filtro, setFiltro] = useState<Filtro>("perdeu_direito");
  const lista = useMemo(() => {
    const t = FILTROS.find((f) => f.k === filtro)!.teste;
    return CASOS.filter((c) => t(c) && EXPLICACOES[c.id]);
  }, [filtro]);
  const [i, setI] = useState(0);
  const c = lista[Math.min(i, lista.length - 1)];
  if (!c) return null;

  const direito = pontosDeDireito(c);
  const perdeu = direito - c.pontos;

  return (
    <div className="card overflow-hidden">
      <div className="border-b p-5" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const n = CASOS.filter((x) => f.teste(x) && EXPLICACOES[x.id]).length;
            return (
              <button key={f.k} onClick={() => { setFiltro(f.k); setI(0); }} aria-pressed={filtro === f.k}
                className="rounded-lg border px-3 py-2 text-[13px] font-medium transition"
                style={filtro === f.k
                  ? { borderColor: "var(--ganho)", background: "var(--surface-2)", color: "var(--text-1)" }
                  : { borderColor: "var(--border)", color: "var(--text-2)" }}>
                {f.rot} <span className="num" style={{ color: "var(--text-3)" }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.15fr]">
        {/* ── ficha determinística: sai do motor, não do modelo ── */}
        <div className="border-b p-5 lg:border-b-0 lg:border-r" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                Inscrição {i + 1} de {lista.length}
              </div>
              <div className="num mt-1 text-[15px] font-semibold">{c.id}</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setI((v) => (v - 1 + lista.length) % lista.length)}
                aria-label="Inscrição anterior"
                className="rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>←</button>
              <button onClick={() => setI((v) => (v + 1) % lista.length)}
                aria-label="Próxima inscrição"
                className="rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>→</button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <div>
              <div className="text-xs" style={{ color: "var(--text-3)" }}>Pontuação que valeu</div>
              <div className="num text-2xl font-semibold">{c.pontos}</div>
            </div>
            {perdeu > 0 && (
              <div>
                <div className="text-xs" style={{ color: "var(--text-3)" }}>Pontuação a que teria direito</div>
                <div className="num text-2xl font-semibold" style={{ color: "var(--perda)" }}>{direito}</div>
              </div>
            )}
          </div>

          {c.criterios_so_declarados.length > 0 && (
            <div className="mt-4 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
              <div className="text-[13px] font-semibold" style={{ color: "var(--perda)" }}>
                Declarado e não validado, então não contou
              </div>
              <ul className="mt-2 space-y-1 text-[13px]" style={{ color: "var(--text-2)" }}>
                {c.criterios_so_declarados.map((x) => (
                  <li key={x.criterio} className="flex gap-2">
                    <span className="num shrink-0 font-medium">{x.pontos} pt</span>
                    <span>{x.criterio}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
              As opções da família
            </div>
            <ul className="mt-2 space-y-2">
              {c.opcoes.map((o) => (
                <li key={o.posicao} className="flex gap-3 text-[13px]">
                  <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
                    style={o.conseguiu
                      ? { background: "var(--ganho)", color: "#fff" }
                      : { background: "var(--surface-2)", color: "var(--text-3)" }}>
                    {o.posicao}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{o.unidade}</span>
                    <span className="block" style={{ color: "var(--text-3)" }}>
                      {o.grupamento.replace("Bercario", "Berçário")} · {o.turno} · {fmt(o.candidatos)} candidatos para {fmt(o.capacidade)} vagas
                      {o.nota_de_corte != null && <> · nota de corte <span className="num">{o.nota_de_corte}</span></>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── a explicação em português ── */}
        <div className="p-5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--ganho)" }} aria-hidden />
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
              Explicação gerada pelo Claude
            </div>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed">{EXPLICACOES[c.id]}</p>

          <div className="mt-5 rounded-lg p-3 text-[12px] leading-relaxed"
               style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
            <strong>Como isso é gerado.</strong> Todos os números da ficha ao lado saem do motor de
            alocação, que é determinístico e auditável. O Claude recebe exatamente esses números já
            estruturados e só faz a tradução para o português que um servidor usaria ao atender a
            família. O modelo não decide, não pontua e não reordena a fila. As explicações são
            geradas no build e servidas como texto estático, então nenhum dado de criança trafega
            para o modelo em produção.
          </div>
        </div>
      </div>
    </div>
  );
}
