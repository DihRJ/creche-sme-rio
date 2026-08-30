/**
 * Kit PROVISORIO do Dev B.
 *
 * O kit definitivo e do Dev C, em `src/ui/`. Isto existe porque o fluxo de inscricao
 * nao pode ficar parado esperando: a regra do brief e "precisa de um botao? faca um
 * provisorio dentro do seu arquivo". Quando `src/ui/` chegar, este arquivo morre e os
 * imports das telas do Dev B trocam de caminho.
 *
 * Tudo aqui e mobile primeiro: desenhado em 360px (RNF1) e com alvo de toque de 44px.
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Botao({
  children, aoClicar, tipo = "button", variante = "primario", desabilitado, largura,
}: {
  children: ReactNode;
  aoClicar?: () => void;
  tipo?: "button" | "submit";
  variante?: "primario" | "secundario" | "fantasma";
  desabilitado?: boolean;
  largura?: "cheia";
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45";
  const estilo =
    variante === "primario"
      ? { background: "var(--ganho)", color: "#fff", border: "1px solid transparent" }
      : variante === "secundario"
        ? { background: "var(--surface-2)", color: "var(--text-1)", border: "1px solid var(--border)" }
        : { background: "transparent", color: "var(--text-2)", border: "1px solid transparent" };
  return (
    <button
      type={tipo}
      onClick={aoClicar}
      disabled={desabilitado}
      style={estilo}
      className={`${base} ${largura === "cheia" ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export function Campo({
  rotulo, ajuda, erro, ...resto
}: { rotulo: string; ajuda?: string; erro?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">{rotulo}</span>
      {ajuda && (
        <span className="mt-0.5 block text-[12px]" style={{ color: "var(--text-3)" }}>
          {ajuda}
        </span>
      )}
      <input
        {...resto}
        aria-invalid={erro ? true : undefined}
        className="mt-1.5 min-h-[44px] w-full rounded-xl px-3 text-[16px] outline-none"
        style={{
          background: "var(--surface-1)",
          border: `1px solid ${erro ? "var(--perda)" : "var(--border)"}`,
          color: "var(--text-1)",
        }}
      />
      {erro && (
        <span className="mt-1 block text-[12px]" style={{ color: "var(--perda)" }}>
          {erro}
        </span>
      )}
    </label>
  );
}

export function Selecao({
  rotulo, ajuda, children, ...resto
}: { rotulo: string; ajuda?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">{rotulo}</span>
      {ajuda && (
        <span className="mt-0.5 block text-[12px]" style={{ color: "var(--text-3)" }}>
          {ajuda}
        </span>
      )}
      <select
        {...resto}
        className="mt-1.5 min-h-[44px] w-full rounded-xl px-3 text-[16px] outline-none"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-1)" }}
      >
        {children}
      </select>
    </label>
  );
}

export function Aviso({
  tom = "neutro", titulo, children,
}: { tom?: "neutro" | "atencao" | "bom" | "ruim"; titulo?: string; children: ReactNode }) {
  const cor =
    tom === "atencao" ? "var(--fila)" : tom === "bom" ? "var(--ganho)" : tom === "ruim" ? "var(--perda)" : "var(--ociosa)";
  return (
    <div
      className="rounded-xl p-3 text-[13px] leading-relaxed"
      style={{ background: "var(--surface-2)", borderInlineStart: `3px solid ${cor}`, color: "var(--text-2)" }}
      role={tom === "ruim" ? "alert" : undefined}
    >
      {titulo && (
        <strong className="block text-[13px]" style={{ color: "var(--text-1)" }}>
          {titulo}
        </strong>
      )}
      {children}
    </div>
  );
}

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-3)" }} aria-live="polite">
      {texto}
    </p>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="card p-6 text-center text-[13px]" style={{ color: "var(--text-3)" }}>
      {children}
    </div>
  );
}

const ETAPAS = ["Criança", "Unidades", "Vulnerabilidade", "Documentos", "Revisão"] as const;

/** Passos do topo. A etapa e 1-indexada. */
export function Passos({ etapa }: { etapa: number }) {
  return (
    <ol className="mb-5 flex flex-wrap gap-x-2 gap-y-1 text-[12px]" aria-label="Etapas da inscrição">
      {ETAPAS.map((nome, i) => {
        const n = i + 1;
        const atual = n === etapa;
        const feita = n < etapa;
        return (
          <li key={nome} className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-1 font-semibold"
              style={{
                background: atual ? "var(--surface-2)" : "transparent",
                color: atual ? "var(--text-1)" : feita ? "var(--ganho)" : "var(--text-3)",
                border: `1px solid ${atual ? "var(--border)" : "transparent"}`,
              }}
              aria-current={atual ? "step" : undefined}
            >
              {feita ? "✓" : n}. {nome}
            </span>
            {n < ETAPAS.length && <span style={{ color: "var(--text-3)" }}>›</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function Titulo({ children, apoio }: { children: ReactNode; apoio?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{children}</h1>
      {apoio && (
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {apoio}
        </p>
      )}
    </header>
  );
}
