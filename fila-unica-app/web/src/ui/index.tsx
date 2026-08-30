/**
 * Kit de UI do app da família.
 *
 * Sem dependência de rota, de estado global, de API ou de framework de CSS — dá
 * para montar qualquer uma destas em isolamento. O estilo vem de `tema.css`,
 * importado logo abaixo: o kit é autocontido em `src/ui/`, e nenhuma tela do Dev B
 * precisa mudar para ele funcionar.
 *
 * Regra que atravessa o arquivo: nenhuma informação é dada só pela cor. Todo
 * estado tem ícone e texto. Um em cada doze homens não distingue verde de
 * vermelho, e esta tela decide vaga de creche.
 */
import { createContext, useContext, useEffect, useId, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { SituacaoCriterio } from "../contracts.gen";
import { ROTULO_SITUACAO_CRITERIO } from "../contracts.gen";
import "./tema.css";

export type Tom = "neutro" | "confirmado" | "pendente" | "faltando";

/* ────────────────────────────  Botao  ──────────────────────────── */

type VarianteBotao = "primario" | "secundario" | "texto" | "perigo";

export function Botao({
  variante = "primario",
  carregando = false,
  larguraTotal = false,
  className = "",
  children,
  ...props
}: {
  variante?: VarianteBotao;
  carregando?: boolean;
  larguraTotal?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = [
    "fu-botao",
    `fu-botao--${variante}`,
    larguraTotal ? "fu-botao--largura-total" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      {...props}
      // `carregando` desabilita: sem isto a família clica de novo no upload lento
      // de rede móvel e manda o mesmo documento duas vezes.
      disabled={props.disabled || carregando}
      aria-busy={carregando || undefined}
      className={classes}
    >
      {carregando && <Girador />}
      {children}
    </button>
  );
}

function Girador() {
  return (
    <svg className="fu-girador" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ────────────────────────────  Campo  ──────────────────────────── */

/**
 * Rótulo sempre visível, nunca placeholder no lugar dele: placeholder some ao
 * digitar e quem preenche um formulário longo no celular perde o fio.
 * O erro é ligado ao input por `aria-describedby` e anunciado por leitor de tela.
 */
export function Campo({
  rotulo,
  erro,
  ajuda,
  obrigatorio = false,
  className = "",
  ...props
}: {
  rotulo: string;
  erro?: string | null;
  ajuda?: string | null;
  obrigatorio?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const idAjuda = `${id}-ajuda`;
  const idErro = `${id}-erro`;
  const descrito = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(" ");

  return (
    <div className="fu-campo">
      <label htmlFor={id} className="fu-campo__rotulo">
        {rotulo}
        {obrigatorio && (
          <>
            <span className="fu-campo__obrigatorio" aria-hidden="true">
              {" *"}
            </span>
            <span className="fu-sr"> (obrigatório)</span>
          </>
        )}
      </label>

      {ajuda && (
        <p id={idAjuda} className="fu-campo__ajuda">
          {ajuda}
        </p>
      )}

      <input
        {...props}
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito || undefined}
        className={`fu-campo__input ${className}`.trim()}
      />

      {erro && (
        <p id={idErro} role="alert" className="fu-campo__erro">
          {erro}
        </p>
      )}
    </div>
  );
}

/* ────────────────────────────  Chip  ──────────────────────────── */

export function Chip({
  tom = "neutro",
  icone,
  children,
}: {
  tom?: Tom;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="fu-chip" data-tom={tom}>
      {icone}
      {children}
    </span>
  );
}

/* ── o chip que carrega o RF2.3 ──
 * A frase importa mais que a cor. "Você não precisa enviar documento" é o momento
 * mais forte da demonstração: é a resposta direta aos 6,8% de validação do CadÚnico.
 */
const SITUACAO: Record<SituacaoCriterio, { tom: Tom; icone: string; frase: string }> = {
  nao_declarado: {
    tom: "neutro",
    icone: "○",
    frase: "",
  },
  confirmado_base: {
    tom: "confirmado",
    icone: "✓",
    frase: "Confirmado pela base. Você não precisa enviar documento.",
  },
  documento_pendente: {
    tom: "pendente",
    icone: "◷",
    frase: "Documento recebido. Será conferido no dia da matrícula.",
  },
  nao_comprovado: {
    tom: "faltando",
    icone: "!",
    frase: "Falta o comprovante. Este critério não vai pontuar.",
  },
};

export function ChipSituacao({ situacao }: { situacao: SituacaoCriterio }) {
  const s = SITUACAO[situacao];
  return (
    <Chip tom={s.tom} icone={<span aria-hidden="true">{s.icone}</span>}>
      {ROTULO_SITUACAO_CRITERIO[situacao]}
    </Chip>
  );
}

export function fraseDaSituacao(situacao: SituacaoCriterio): string {
  return SITUACAO[situacao].frase;
}

/* ────────────────────────────  Aviso  ──────────────────────────── */

export function Aviso({
  tom = "neutro",
  titulo,
  children,
}: {
  tom?: Tom;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div
      // `status`, não `alert`: o aviso da ordem vinculante e o banner de demonstração
      // são permanentes. `alert` interromperia o leitor de tela a cada render.
      role="status"
      className="fu-aviso"
      data-tom={tom}
    >
      {titulo && <p className="fu-aviso__titulo">{titulo}</p>}
      <div className="fu-aviso__corpo">{children}</div>
    </div>
  );
}

/* ────────────────────────  Carregando / Vazio  ──────────────────────── */

/** Esqueleto, não spinner: o spinner não diz quanto falta nem reserva o espaço,
 *  e a tela pula quando o dado chega. */
export function Carregando({
  linhas = 3,
  rotulo = "Carregando",
}: {
  linhas?: number;
  rotulo?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="fu-carregando">
      <span className="fu-sr">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          className="fu-carregando__linha"
          style={{ opacity: 1 - i * 0.15 }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

/** Vazio sem ação é beco sem saída. `acao` é opcional no tipo e obrigatório na
 *  prática: toda tela vazia deste app tem um próximo passo. */
export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="fu-cartao fu-vazio">
      <p className="fu-vazio__titulo">{titulo}</p>
      {descricao && <p className="fu-vazio__descricao">{descricao}</p>}
      {acao}
    </div>
  );
}

/* ────────────────────────────  Passos  ──────────────────────────── */

export interface Passo {
  chave: string;
  titulo: string;
  estado: "concluido" | "atual" | "futuro";
}

/**
 * Serve tanto para o progresso da inscrição quanto para a linha do tempo do
 * calendário (E4) — é o mesmo desenho, e o G6 do PRD é exatamente a família não
 * saber em que ponto do processo ela está.
 *
 * `aria-current="step"` é o que faz o leitor de tela anunciar onde a pessoa está.
 */
export function Passos({
  passos,
  orientacao = "horizontal",
}: {
  passos: Passo[];
  orientacao?: "horizontal" | "vertical";
}) {
  const vertical = orientacao === "vertical";
  const TOM_DO_ESTADO: Record<Passo["estado"], Tom> = {
    concluido: "confirmado",
    atual: "neutro", // o CSS preenche o atual com --text-1; o tom só dá a borda
    futuro: "neutro",
  };

  return (
    <ol className={`fu-passos fu-passos--${vertical ? "vertical" : "horizontal"}`}>
      {passos.map((p, i) => (
        <li
          key={p.chave}
          className="fu-passo"
          data-estado={p.estado}
          data-tom={TOM_DO_ESTADO[p.estado]}
          aria-current={p.estado === "atual" ? "step" : undefined}
        >
          {vertical ? (
            <div className="fu-passo__coluna">
              <span className="fu-passo__marca" aria-hidden="true">
                {p.estado === "concluido" ? "✓" : i + 1}
              </span>
              {i < passos.length - 1 && <span className="fu-passo__trilho" aria-hidden="true" />}
            </div>
          ) : (
            <span className="fu-passo__marca" aria-hidden="true">
              {p.estado === "concluido" ? "✓" : i + 1}
            </span>
          )}

          <span className="fu-passo__titulo">
            {p.titulo}
            {p.estado === "atual" && <span className="fu-sr"> (etapa atual)</span>}
          </span>

          {!vertical && i < passos.length - 1 && (
            <span className="fu-passo__conector" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

/* ────────────────────────────  tema claro/escuro  ──────────────────────────── */

type Tema = "claro" | "escuro" | "sistema";

const CtxTema = createContext<{ tema: Tema; setTema: (t: Tema) => void }>({
  tema: "sistema",
  setTema: () => {},
});

export function ProvedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(
    () => (localStorage.getItem("tema") as Tema | null) ?? "sistema",
  );

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === "sistema") raiz.removeAttribute("data-theme");
    else raiz.setAttribute("data-theme", tema === "escuro" ? "dark" : "light");
    localStorage.setItem("tema", tema);
  }, [tema]);

  return <CtxTema.Provider value={{ tema, setTema }}>{children}</CtxTema.Provider>;
}

export function BotaoTema() {
  const { tema, setTema } = useContext(CtxTema);
  const proximo: Record<Tema, Tema> = { sistema: "claro", claro: "escuro", escuro: "sistema" };
  const rotulo: Record<Tema, string> = {
    sistema: "Tema do sistema",
    claro: "Tema claro",
    escuro: "Tema escuro",
  };
  return (
    <Botao
      variante="secundario"
      onClick={() => setTema(proximo[tema])}
      aria-label={`${rotulo[tema]}. Trocar.`}
    >
      <span aria-hidden="true">{tema === "escuro" ? "☾" : tema === "claro" ? "☀" : "◐"}</span>
    </Botao>
  );
}
