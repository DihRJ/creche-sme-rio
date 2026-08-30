/**
 * As inscricoes da familia (Dev B).
 *
 * Existe porque nao havia caminho de volta: depois do login o app ia direto para
 * "cadastrar nova crianca", e uma inscricao ja criada so era alcancavel digitando a
 * URL com o id na mao.
 *
 * Duas decisoes que vale registrar:
 *
 *  1. A diferenca entre `pontos_que_contam` e `pontos_declarados` aparece AQUI, no
 *     cartao, e nao escondida numa sub-tela. E o argumento central do projeto: hoje
 *     93% das inscricoes entram com zero ponto porque a comprovacao nao e validada, e
 *     a familia precisa dar de cara com isso enquanto ainda da tempo de resolver.
 *
 *  2. O botao de documentos aparece em QUALQUER situacao, nao so em rascunho. O
 *     backend permite anexar comprovante depois de enviada (E11, E12 e E13 nao
 *     exigem rascunho, ao contrario de E9 e E10), e e justamente isso que ataca a
 *     validacao em 6,8%: quem enviou sem comprovante ainda pode regularizar.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { chamar, mensagemDe } from "../api/client";
import { useSessao } from "../auth";
import type { Inscricao } from "../contracts.gen";
import { ROTAS, ROTULO_GRUPAMENTO } from "../contracts.gen";
import { EXPLICACAO_SITUACAO, ROTULO_SITUACAO, TOM_SITUACAO, etapaDoRascunho } from "../destino";
import { nf } from "../formato";
import { Aviso, Botao, Carregando, Titulo, Vazio } from "./provisorio-ui";

export default function Inscricoes() {
  const { me, recarregar } = useSessao();
  const navegar = useNavigate();
  const [detalhes, setDetalhes] = useState<Inscricao[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  const resumos = me?.inscricoes ?? [];

  // O `inscricoes` do /me e resumo: nao traz pontuacao nem pendencias. Buscamos o
  // detalhe de cada uma, que sao uma ou duas por familia, nao cem.
  useEffect(() => {
    if (resumos.length === 0) {
      setDetalhes([]);
      return;
    }
    let vivo = true;
    Promise.all(resumos.map((r) => chamar<Inscricao>(ROTAS.inscricao(r.id))))
      .then((d) => vivo && setDetalhes(d))
      .catch((e) => vivo && setFalha(mensagemDe(e)));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumos.map((r) => r.id).join(",")]);

  // A lista muda quando uma inscricao e criada ou enviada em outra tela.
  useEffect(() => {
    recarregar().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (falha) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Aviso tom="ruim">{falha}</Aviso>
      </div>
    );
  }
  if (!detalhes) return <Carregando texto="Buscando as suas inscrições..." />;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <Titulo apoio="Uma criança tem uma inscrição, e é ela que concorre em todas as opções ao mesmo tempo.">
        Suas inscrições
      </Titulo>

      {detalhes.length === 0 ? (
        <Vazio>
          <p>Você ainda não tem nenhuma inscrição.</p>
          <div className="mt-4">
            <Botao aoClicar={() => navegar("/inscricao/nova")}>Fazer a primeira inscrição</Botao>
          </div>
        </Vazio>
      ) : (
        <div className="space-y-4">
          {detalhes.map((i) => (
            <Cartao key={i.id} inscricao={i} />
          ))}
        </div>
      )}

      {detalhes.length > 0 && (
        <div className="mt-6">
          <Botao variante="secundario" largura="cheia" aoClicar={() => navegar("/inscricao/nova")}>
            Inscrever outra criança
          </Botao>
        </div>
      )}
    </div>
  );
}

function Cartao({ inscricao: i }: { inscricao: Inscricao }) {
  const { pontos_que_contam: contam, pontos_declarados: declarados } = i.pontuacao;
  const perdidos = declarados - contam;
  const rascunho = i.situacao === "rascunho";

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug">{i.crianca.nome}</h2>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>
            {ROTULO_GRUPAMENTO[i.grupamento]} · turno {i.turno} · processo {i.processo_ano}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold"
          style={{ background: "var(--surface-2)", color: TOM_SITUACAO[i.situacao] }}
        >
          {ROTULO_SITUACAO[i.situacao]}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        {EXPLICACAO_SITUACAO[i.situacao]}
        {i.numero_sorteio && (
          <>
            {" "}
            Número de inscrição{" "}
            <strong className="num" style={{ color: "var(--text-1)" }}>
              {i.numero_sorteio}
            </strong>
            .
          </>
        )}
      </p>

      {/* ── pontuação: o argumento do projeto, no cartão ─────────────── */}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-[11px]" style={{ color: "var(--text-3)" }}>Pontos que contam</dt>
          {/* Verde so quando ha ponto contando. Zero em verde le como "esta tudo
              certo", e a familia que nao declarou nada precisa do oposto disso. */}
          <dd className="num text-[22px] font-semibold leading-none"
              style={{ color: perdidos > 0 ? "var(--fila)" : contam > 0 ? "var(--ganho)" : "var(--text-1)" }}>
            {nf.format(contam)}
          </dd>
        </div>
        {perdidos > 0 && (
          <div>
            <dt className="text-[11px]" style={{ color: "var(--text-3)" }}>Você declarou</dt>
            <dd className="num text-[22px] font-semibold leading-none" style={{ color: "var(--text-2)" }}>
              {nf.format(declarados)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-[11px]" style={{ color: "var(--text-3)" }}>Creches escolhidas</dt>
          <dd className="num text-[22px] font-semibold leading-none">{i.opcoes.length}</dd>
        </div>
      </dl>

      {perdidos > 0 && (
        <div className="mt-3">
          <Aviso tom="atencao" titulo={`${nf.format(perdidos)} pontos não estão contando`}>
            Você declarou critérios que ainda não têm comprovante. Enviar o documento faz esses
            pontos valerem na classificação, e dá para fazer isso mesmo depois de enviar a inscrição.
          </Aviso>
        </div>
      )}

      {i.pendencias.length > 0 && rascunho && (
        <ul className="mt-3 space-y-1 text-[12px]" style={{ color: "var(--text-2)" }}>
          {i.pendencias.map((p) => (
            <li key={p}>· {p}</li>
          ))}
        </ul>
      )}

      {/* ── ações ─────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-2">
        {rascunho && (
          <Link to={etapaDoRascunho(i)}>
            <Botao>Continuar inscrição</Botao>
          </Link>
        )}
        {/* Em qualquer situação: o backend aceita comprovante depois de enviada. */}
        <Link to={`/inscricao/${i.id}/documentos`}>
          <Botao variante="secundario">
            {perdidos > 0 ? "Enviar comprovantes" : "Ver documentos"}
          </Botao>
        </Link>
        <Link to={`/inscricao/${i.id}`}>
          <Botao variante="fantasma">Ver detalhes</Botao>
        </Link>
      </div>
    </article>
  );
}
