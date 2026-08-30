/**
 * A tela que carrega o pitch. Resolve o gargalo G3: hoje a familia escolhe as cegas,
 * e 42% das opcoes vao para fora do bairro, muitas para unidade lotada.
 *
 * Duas regras de honestidade, que valem mais que qualquer enfeite:
 *  1. Mostramos o NUMERO do processo de 2025, nao uma probabilidade de entrar. O
 *     sistema nao sabe a chance da familia, e fingir que sabe seria pior que o silencio.
 *  2. O historico e da unidade inteira, nao da combinacao grupamento x turno. E o que
 *     a base publica sustenta, e o rotulo diz isso.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { chamar, listarBairros, mensagemDe } from "../api/client";
import type { Inscricao, Oferta, PaginaOfertas } from "../contracts.gen";
import { MAX_OPCOES, ROTAS, ROTULO_GRUPAMENTO } from "../contracts.gen";
import { nf } from "../formato";
import { Aviso, Botao, Carregando, Passos, Titulo, Vazio } from "./provisorio-ui";

export default function EscolherUnidades() {
  const { id = "" } = useParams();
  const navegar = useNavigate();

  const [inscricao, setInscricao] = useState<Inscricao | null>(null);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [bairro, setBairro] = useState("");
  const [bairros, setBairros] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<Oferta[]>([]);
  const [total, setTotal] = useState(0);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    chamar<Inscricao>(ROTAS.inscricao(id)).then(setInscricao).catch((e) => setFalha(mensagemDe(e)));
    listarBairros().then(setBairros).catch(() => setBairros([]));
  }, [id]);

  // Debounce da busca: 836 unidades e rede movel nao combinam com uma chamada por tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAtiva(busca.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const abortar = useRef<AbortController | null>(null);
  // Só o grupamento e o turno entram na dependencia. Depender da `inscricao` inteira
  // refaria a busca a cada salvamento do E9 e duplicaria item na lista acumulada.
  const grupamento = inscricao?.grupamento;
  const turno = inscricao?.turno;

  useEffect(() => {
    if (!grupamento || !turno) return;
    abortar.current?.abort();
    const ctrl = new AbortController();
    abortar.current = ctrl;

    const qs = new URLSearchParams({ grupamento, turno, pagina: String(pagina) });
    if (buscaAtiva) qs.set("busca", buscaAtiva);
    if (bairro) qs.set("bairro", bairro);

    setCarregandoLista(true);
    chamar<PaginaOfertas>(`${ROTAS.ofertas}?${qs}`, { sinal: ctrl.signal })
      .then((p) => {
        // pagina 1 troca a lista; as seguintes acumulam ("carregar mais")
        setLista((atual) => (p.pagina === 1 ? p.itens : [...atual, ...p.itens]));
        setTotal(p.total);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setFalha(mensagemDe(e));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setCarregandoLista(false);
      });

    return () => ctrl.abort();
  }, [grupamento, turno, buscaAtiva, bairro, pagina]);

  // Trocar de bairro volta pra pagina 1: acumular pagina de outro filtro mistura listas.
  const trocarBairro = (b: string) => {
    setBairro(b);
    setPagina(1);
  };

  const escolhidas = useMemo(
    () => (inscricao ? [...inscricao.opcoes].sort((a, b) => a.ordem - b.ordem) : []),
    [inscricao],
  );
  const idsEscolhidos = useMemo(() => escolhidas.map((o) => o.oferta.id), [escolhidas]);
  const cheio = idsEscolhidos.length >= MAX_OPCOES;

  /** E9 substitui a lista inteira; a ordem do array e a ordem de preferencia. */
  const gravar = useCallback(
    async (ids: string[], marcador: string) => {
      setSalvando(marcador);
      setFalha(null);
      try {
        setInscricao(await chamar<Inscricao>(ROTAS.opcoes(id), { metodo: "PUT", corpo: { oferta_ids: ids } }));
      } catch (e) {
        setFalha(mensagemDe(e));
      } finally {
        setSalvando(null);
      }
    },
    [id],
  );

  const adicionar = (o: Oferta) => gravar([...idsEscolhidos, o.id], o.id);
  const remover = (ofertaId: string) => gravar(idsEscolhidos.filter((x) => x !== ofertaId), ofertaId);

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= idsEscolhidos.length) return;
    const novos = [...idsEscolhidos];
    [novos[de], novos[para]] = [novos[para], novos[de]];
    gravar(novos, novos[para]);
  };

  if (!inscricao) {
    return falha ? (
      <div className="mx-auto max-w-md px-4 py-8">
        <Aviso tom="ruim">{falha}</Aviso>
      </div>
    ) : (
      <Carregando texto="Abrindo sua inscrição..." />
    );
  }

  const temMais = lista.length < total;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <Passos etapa={2} />
      <Titulo
        apoio={`${ROTULO_GRUPAMENTO[inscricao.grupamento]} · turno ${inscricao.turno}. Escolha até ${MAX_OPCOES} creches, na ordem da sua preferência.`}
      >
        Escolher as creches
      </Titulo>

      {/* A regra R1 fica presa no topo, e curta: com cinco linhas ela ocupava 300px de
          um viewport de 780px e empurrava a própria lista de opções para fora da tela. */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 px-4 py-2" style={{ background: "var(--surface-0)" }}>
        <Aviso tom="atencao" titulo="A ordem importa">
          Coloque em 1º a creche que você realmente quer. Declarar a preferência verdadeira
          nunca prejudica a sua classificação.
        </Aviso>
      </div>

      {/* ── escolhidas ─────────────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className="mb-2 text-[15px] font-semibold">
          Suas opções{" "}
          <span className="num" style={{ color: "var(--text-3)" }}>
            {idsEscolhidos.length} de {MAX_OPCOES}
          </span>
        </h2>
        {cheio && (
          <p className="mb-2 text-[12px]" style={{ color: "var(--text-3)" }}>
            Você chegou ao limite de {MAX_OPCOES}. Para trocar, remova uma abaixo.
          </p>
        )}

        {escolhidas.length === 0 ? (
          <Vazio>Nenhuma creche escolhida ainda. Busque abaixo e toque em “Escolher”.</Vazio>
        ) : (
          // Nome em cima com a largura toda, controles numa segunda linha. Na mesma
          // linha, as tres setas de 44px comiam 132px dos 360 e sobravam ~200px: com
          // `truncate` o nome virava "EDI PROFESSO..." e duas unidades de prefixo igual
          // ficavam indistinguiveis; sem `truncate` ele quebrava em quatro linhas.
          // Empilhar preserva o alvo de toque de 44px e o nome legivel.
          <ol className="space-y-2">
            {escolhidas.map((o, i) => (
              <li key={o.oferta.id} className="card p-3">
                <div className="flex items-start gap-3">
                  <span
                    className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[15px] font-bold"
                    style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
                    aria-label={`Opção ${o.ordem}`}
                  >
                    {o.ordem}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold leading-snug">{o.oferta.unidade.nome}</p>
                    <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>
                      {o.oferta.unidade.bairro} · CRE {o.oferta.unidade.cre}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1">
                  <BotaoIcone rotulo={`Subir ${o.oferta.unidade.nome}`} desabilitado={i === 0 || !!salvando}
                    aoClicar={() => mover(i, i - 1)}>↑</BotaoIcone>
                  <BotaoIcone rotulo={`Descer ${o.oferta.unidade.nome}`}
                    desabilitado={i === escolhidas.length - 1 || !!salvando}
                    aoClicar={() => mover(i, i + 1)}>↓</BotaoIcone>
                  <BotaoIcone rotulo={`Remover ${o.oferta.unidade.nome}`} desabilitado={!!salvando}
                    aoClicar={() => remover(o.oferta.id)}>✕</BotaoIcone>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── busca ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-[15px] font-semibold">Buscar creche</h2>

        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome da creche ou bairro"
          aria-label="Buscar creche por nome ou bairro"
          className="min-h-[44px] w-full rounded-xl px-3 text-[16px] outline-none"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-1)" }}
        />

        {bairros.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <Chip ativo={bairro === ""} aoClicar={() => trocarBairro("")}>Todos</Chip>
            {bairros.map((b) => (
              <Chip key={b} ativo={bairro === b} aoClicar={() => trocarBairro(b === bairro ? "" : b)}>
                {b}
              </Chip>
            ))}
          </div>
        )}

        <p className="mt-3 text-[12px]" style={{ color: "var(--text-3)" }}>
          {carregandoLista && lista.length === 0
            ? "Buscando..."
            : `${nf.format(total)} ${total === 1 ? "creche" : "creches"} com ${ROTULO_GRUPAMENTO[inscricao.grupamento]} no turno ${inscricao.turno}.`}
        </p>

        {falha && (
          <div className="mt-3">
            <Aviso tom="ruim">{falha}</Aviso>
          </div>
        )}

        <div className="mt-3 space-y-3">
          {lista.map((o) => (
            <CartaoUnidade
              key={o.id}
              oferta={o}
              escolhida={idsEscolhidos.includes(o.id)}
              posicao={idsEscolhidos.indexOf(o.id) + 1}
              cheio={cheio}
              salvando={salvando === o.id}
              aoEscolher={() => adicionar(o)}
              aoRemover={() => remover(o.id)}
            />
          ))}
        </div>

        {lista.length === 0 && !carregandoLista && (
          <Vazio>Nenhuma creche encontrada com esse filtro. Tente outro bairro ou limpe a busca.</Vazio>
        )}

        {temMais && (
          <div className="mt-4 flex justify-center">
            <Botao variante="secundario" desabilitado={carregandoLista} aoClicar={() => setPagina((p) => p + 1)}>
              {carregandoLista ? "Carregando..." : `Carregar mais (${nf.format(total - lista.length)} restantes)`}
            </Botao>
          </div>
        )}

        <p className="mt-5 text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Os números são do <strong>processo de 2025</strong> e valem para a unidade inteira, somando
          os grupamentos e os turnos. É a série que a SME publica. Eles mostram o que aconteceu, não
          uma previsão do que vai acontecer.
        </p>
      </section>

      {/* ── barra fixa ─────────────────────────────────────────────── */}
      <div
        className="fixed inset-x-0 bottom-0 border-t px-4 py-3"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="num flex-1 text-[13px]" style={{ color: "var(--text-2)" }}>
            {idsEscolhidos.length} de {MAX_OPCOES} escolhidas
            {salvando && <span style={{ color: "var(--text-3)" }}> · salvando...</span>}
          </p>
          <Botao
            desabilitado={idsEscolhidos.length === 0 || !!salvando}
            aoClicar={() => navegar(`/inscricao/${id}/vulnerabilidades`)}
          >
            Continuar
          </Botao>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────  peças  ──────────────────────────── */

function BotaoIcone({
  children, rotulo, aoClicar, desabilitado,
}: { children: string; rotulo: string; aoClicar: () => void; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-[16px] disabled:opacity-30"
      style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
    >
      {children}
    </button>
  );
}

function Chip({
  children, ativo, aoClicar,
}: { children: string; ativo: boolean; aoClicar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className="min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] font-medium"
      style={{
        background: ativo ? "var(--surface-2)" : "transparent",
        color: ativo ? "var(--text-1)" : "var(--text-2)",
        border: `1px solid ${ativo ? "var(--text-3)" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  );
}

function CartaoUnidade({
  oferta, escolhida, posicao, cheio, salvando, aoEscolher, aoRemover,
}: {
  oferta: Oferta;
  escolhida: boolean;
  posicao: number;
  cheio: boolean;
  salvando: boolean;
  aoEscolher: () => void;
  aoRemover: () => void;
}) {
  const h = oferta.historico.find((x) => x.processo_ano === 2025) ?? oferta.historico[0];
  const u = oferta.unidade;

  // Sinal descritivo, nunca preditivo: diz o que aconteceu, nao a chance de entrar.
  const sinal =
    !h ? null
      : h.ociosas > 0
        ? { texto: `Sobraram ${nf.format(h.ociosas)} ${h.ociosas === 1 ? "lugar" : "lugares"} em 2025`, cor: "var(--ociosa)" }
        : h.fila >= 80
          ? { texto: "Concorrida: fila cheia e nenhum lugar sobrando", cor: "var(--fila)" }
          : null;

  return (
    <article
      className="card p-4"
      style={escolhida ? { borderColor: "var(--ganho)" } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug">{u.nome}</h3>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>
            {u.bairro} · CRE {u.cre}
            {u.tipo ? ` · ${u.tipo}` : ""}
          </p>
        </div>
        {escolhida ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="num text-[12px] font-bold" style={{ color: "var(--ganho)" }}>
              {posicao}ª opção
            </span>
            <Botao variante="fantasma" desabilitado={salvando} aoClicar={aoRemover}>
              Remover
            </Botao>
          </div>
        ) : (
          <div className="shrink-0">
            <Botao variante="secundario" desabilitado={cheio || salvando} aoClicar={aoEscolher}>
              {salvando ? "..." : "Escolher"}
            </Botao>
          </div>
        )}
      </div>

      {h && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
            <Numero rotulo="Na fila" valor={h.fila} cor="var(--fila)" />
            <Numero rotulo="Lugares vazios" valor={h.ociosas} cor="var(--ociosa)" />
            <Numero rotulo="Matriculados" valor={h.matriculou} />
            <Numero rotulo="Turmas" valor={Math.round(h.vagas / 25)} />
          </dl>
          <p className="mt-2 text-[11px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
            processo 2025 · unidade inteira
          </p>
        </>
      )}

      {sinal && (
        <p className="mt-2 text-[13px] font-medium" style={{ color: sinal.cor }}>
          {sinal.texto}
        </p>
      )}

    </article>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: "var(--text-3)" }}>{rotulo}</dt>
      <dd className="num text-[17px] font-semibold" style={{ color: cor ?? "var(--text-1)" }}>
        {nf.format(valor)}
      </dd>
    </div>
  );
}
