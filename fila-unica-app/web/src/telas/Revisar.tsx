import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chamar, mensagemDe } from "../api/client";
import type { Criterio, Inscricao } from "../contracts.gen";
import { ROTAS, ROTULO_GRUPAMENTO } from "../contracts.gen";
import { nf } from "../formato";
import { Aviso, Botao, Carregando, Passos, Titulo } from "./provisorio-ui";

export default function Revisar() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const [inscricao, setInscricao] = useState<Inscricao | null>(null);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    chamar<Inscricao>(ROTAS.inscricao(id)).then(setInscricao).catch((e) => setFalha(mensagemDe(e)));
    chamar<Criterio[]>(ROTAS.criterios).then(setCriterios).catch(() => setCriterios([]));
  }, [id]);

  async function finalizar() {
    setEnviando(true);
    setFalha(null);
    try {
      setInscricao(await chamar<Inscricao>(ROTAS.finalizar(id), { metodo: "POST" }));
    } catch (e) {
      setFalha(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }

  if (!inscricao) {
    return falha ? (
      <div className="mx-auto max-w-md px-4 py-8">
        <Aviso tom="ruim">{falha}</Aviso>
      </div>
    ) : (
      <Carregando texto="Abrindo sua inscrição..." />
    );
  }

  if (inscricao.situacao !== "rascunho" && inscricao.numero_sorteio) {
    return <Enviada inscricao={inscricao} />;
  }

  const { pontos_que_contam: contam, pontos_declarados: declarados } = inscricao.pontuacao;
  const perdidos = declarados - contam;
  const semLastro = inscricao.respostas.filter((r) => r.situacao === "nao_comprovado");
  const nomeDo = (cid: string) => criterios.find((c) => c.id === cid)?.texto ?? "critério";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <Passos etapa={5} />
      <Titulo apoio="Confira antes de enviar. Depois de finalizar, a ordem das opções não muda mais.">
        Revisar a inscrição
      </Titulo>

      {/* ── criança ─────────────────────────────────────────────── */}
      <section className="card mb-4 p-5">
        <h2 className="text-[15px] font-semibold">Criança</h2>
        <p className="mt-2 text-[15px]">{inscricao.crianca.nome}</p>
        <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
          {ROTULO_GRUPAMENTO[inscricao.grupamento]} · turno {inscricao.turno}
        </p>
      </section>

      {/* ── pontuação: o argumento do projeto ─────────────────────── */}
      <section className="card mb-4 p-5">
        <h2 className="text-[15px] font-semibold">Sua pontuação</h2>
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <div>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Pontos que contam</p>
            <p className="num text-[30px] font-semibold leading-none"
               style={{ color: perdidos > 0 ? "var(--fila)" : "var(--ganho)" }}>
              {nf.format(contam)}
            </p>
          </div>
          <div>
            <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Pontos que você declarou</p>
            <p className="num text-[30px] font-semibold leading-none" style={{ color: "var(--text-2)" }}>
              {nf.format(declarados)}
            </p>
          </div>
        </div>

        {perdidos > 0 ? (
          <div className="mt-4">
            <Aviso tom="atencao" titulo={`Você está deixando ${nf.format(perdidos)} pontos na mesa`}>
              <p>
                {semLastro.length === 1 ? "Um critério que você declarou está" : `${semLastro.length} critérios que você declarou estão`}{" "}
                sem comprovante, então não vão contar na classificação. Isso não impede o envio, e
                você pode anexar o comprovante depois.
              </p>
              <ul className="mt-2 space-y-1">
                {semLastro.map((r) => (
                  <li key={r.criterio_id}>
                    · {nomeDo(r.criterio_id)} —{" "}
                    <strong className="num" style={{ color: "var(--fila)" }}>
                      {nf.format(r.pontos_se_valer)} pontos
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                <Link to={`/inscricao/${id}/documentos`}
                      style={{ color: "var(--ociosa)", textDecoration: "underline" }}>
                  Enviar os comprovantes agora
                </Link>
              </p>
            </Aviso>
          </div>
        ) : (
          <p className="mt-3 text-[13px]" style={{ color: "var(--text-2)" }}>
            Tudo que você declarou tem lastro e está contando.
          </p>
        )}
      </section>

      {/* ── opções ─────────────────────────────────────────────── */}
      <section className="card mb-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold">Suas creches, na ordem</h2>
          <Link to={`/inscricao/${id}/unidades`} className="text-[13px]"
                style={{ color: "var(--ociosa)", textDecoration: "underline" }}>
            Mudar
          </Link>
        </div>

        {inscricao.opcoes.length === 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--perda)" }}>
            Você ainda não escolheu nenhuma creche.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {[...inscricao.opcoes].sort((a, b) => a.ordem - b.ordem).map((o) => (
              <li key={o.oferta.id} className="flex items-center gap-3">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-bold"
                      style={{ background: "var(--surface-2)" }}>
                  {o.ordem}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{o.oferta.unidade.nome}</span>
                  <span className="block text-[12px]" style={{ color: "var(--text-3)" }}>
                    {o.oferta.unidade.bairro}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── pendências: avisam, não bloqueiam ───────────────────── */}
      {inscricao.pendencias.length > 0 && (
        <div className="mb-4 space-y-2">
          {inscricao.pendencias.map((p) => (
            <Aviso key={p} tom="atencao">{p}</Aviso>
          ))}
        </div>
      )}

      {falha && (
        <div className="mb-4">
          <Aviso tom="ruim">{falha}</Aviso>
        </div>
      )}

      <Botao largura="cheia" desabilitado={enviando || inscricao.opcoes.length === 0} aoClicar={finalizar}>
        {enviando ? "Enviando..." : "Finalizar inscrição"}
      </Botao>

      <Botao largura="cheia" variante="fantasma" aoClicar={() => navegar(`/inscricao/${id}/documentos`)}>
        Voltar para os documentos
      </Botao>
    </div>
  );
}

function Enviada({ inscricao }: { inscricao: Inscricao }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-[40px] leading-none" aria-hidden="true">✓</p>
      <h1 className="mt-3 text-[24px] font-semibold tracking-tight">Inscrição enviada</h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        {inscricao.crianca.nome} está inscrita no processo de {inscricao.processo_ano}.
      </p>

      <div className="card mt-6 p-5">
        <p className="text-[12px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
          Número de sorteio
        </p>
        <p className="num mt-1 text-[28px] font-bold tracking-wider">{inscricao.numero_sorteio}</p>
        <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Este número desempata a sua inscrição quando duas crianças têm a mesma pontuação. Ele é
          calculado a partir de uma semente publicada antes do fim das inscrições, então qualquer
          pessoa pode conferir que ele não foi escolhido depois de saber o resultado.
        </p>
      </div>

      <div className="card mt-3 p-5 text-left">
        <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
          Sua pontuação:{" "}
          <strong className="num" style={{ color: "var(--text-1)" }}>
            {nf.format(inscricao.pontuacao.pontos_que_contam)}
          </strong>{" "}
          de {nf.format(inscricao.pontuacao.pontos_declarados)} declarados.
        </p>
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-2)" }}>
          {inscricao.opcoes.length} {inscricao.opcoes.length === 1 ? "creche escolhida" : "creches escolhidas"}, na
          ordem que você definiu.
        </p>
      </div>

      <div className="mt-6">
        <Link to={`/inscricao/${inscricao.id}`}
              className="text-[14px]" style={{ color: "var(--ociosa)", textDecoration: "underline" }}>
          Acompanhar a inscrição
        </Link>
      </div>
    </div>
  );
}
