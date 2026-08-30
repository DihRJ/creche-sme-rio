/**
 * Documentos (Dev C) — o comprovante de cada critério que a base não confirmou.
 *
 * A Vulnerabilidades mostra quantos pontos estão na mesa; esta tela é onde a
 * família os recupera. Duas decisões carregam o resto do arquivo:
 *
 * 1. QUEM GANHA CARTÃO É A `situacao`, NÃO O `exige_documento`. O cruzamento
 *    confirma 88% dos CadÚnico, não 100%; nos outros 12% o critério cai para
 *    `nao_comprovado` mesmo tendo `exige_documento: false`. Filtrar pela flag
 *    deixaria essa família sem lugar para enviar o comprovante dos 51 pontos.
 *
 * 2. O QUE A BASE JÁ CONFIRMOU APARECE, e aparece como conquista. A família chega
 *    aqui esperando trabalho; dizer "estes três já estão resolvidos, você não
 *    precisa enviar nada" é o RF2.2 no momento em que ele alivia.
 *
 * O E11 devolve só a `RespostaCriterio`, sem a `pontuacao` da inscrição. Como
 * somar ponto no cliente está proibido, todo envio e toda remoção releem a
 * inscrição (E8) para o contador do rodapé sair do servidor.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { baixarArquivo, chamar, mensagemDe } from "../api/client";
import { AJUDA_CRITERIO } from "../api/glossario";
import type {
  Criterio,
  DocumentoResumo,
  Inscricao,
  RespostaCriterio,
} from "../contracts.gen";
import { MAX_ARQUIVO_BYTES, MIMES_ACEITOS, ROTAS } from "../contracts.gen";
import { nf } from "../formato";
import { Aviso, Botao, Carregando, ChipSituacao, Vazio, fraseDaSituacao } from "../ui";

/** "2,4 MB" — a família precisa entender por que 5 MB estourou. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${nf.format(Math.round(bytes / 1024))} KB`;
  return `${nf.format(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`;
}

/**
 * O mock só valida tamanho, e o servidor real valida os dois — mas esperar a
 * rede para dizer "formato errado" é cruel em 3G. Validamos antes de subir, com
 * as MESMAS constantes do contrato, nunca com número escrito à mão aqui.
 */
function erroDoArquivo(f: File): string | null {
  if (!MIMES_ACEITOS.includes(f.type)) {
    return "Formato não aceito. Envie uma foto (JPG, PNG ou WEBP) ou um arquivo PDF.";
  }
  if (f.size > MAX_ARQUIVO_BYTES) {
    return `Este arquivo tem ${tamanhoLegivel(f.size)} e o limite é ${tamanhoLegivel(
      MAX_ARQUIVO_BYTES,
    )}. Tire a foto de novo com qualidade menor.`;
  }
  return null;
}

export default function Documentos() {
  const { id = "" } = useParams();
  const navegar = useNavigate();

  const [criterios, setCriterios] = useState<Criterio[] | null>(null);
  const [inscricao, setInscricao] = useState<Inscricao | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  /** Por critério: mensagem de erro do arquivo, e se há operação em curso. */
  const [erros, setErros] = useState<Record<string, string | null>>({});
  const [ocupado, setOcupado] = useState<Record<string, "enviando" | "removendo" | undefined>>({});

  /**
   * Object URLs criados nesta tela. Cada `createObjectURL` segura o blob na
   * memória até alguém revogar; sem esta lista, trocar a foto cinco vezes deixa
   * cinco imagens presas — e no celular isso é memória que falta para o resto.
   */
  const urls = useRef<string[]>([]);
  const novoUrl = useCallback((b: Blob) => {
    const u = URL.createObjectURL(b);
    urls.current.push(u);
    return u;
  }, []);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  /** Miniatura por critério. Vem do File escolhido agora, ou do E13 num reload. */
  const [minis, setMinis] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    Promise.all([chamar<Criterio[]>(ROTAS.criterios), chamar<Inscricao>(ROTAS.inscricao(id))])
      .then(([cs, i]) => {
        if (!vivo) return;
        setCriterios(cs);
        setInscricao(i);
        setFalha(null);
      })
      .catch((e) => vivo && setFalha(mensagemDe(e)));
    return () => {
      vivo = false;
    };
  }, [id]);

  /**
   * Miniatura do que já estava no servidor quando a tela abriu. O E13 exige
   * token, então `<img src={rota}>` devolveria 401 — o jeito é buscar por fetch
   * e montar um object URL com o blob.
   */
  useEffect(() => {
    if (!inscricao) return;
    let vivo = true;
    for (const r of inscricao.respostas) {
      const doc = r.documento;
      if (!doc || !doc.mime.startsWith("image/") || minis[r.criterio_id]) continue;
      baixarArquivo(ROTAS.arquivo(doc.id))
        .then((b) => {
          // No mock o E13 devolve text/plain; só vira miniatura se for imagem mesmo.
          if (!vivo || !b.type.startsWith("image/")) return;
          setMinis((m) => ({ ...m, [r.criterio_id]: novoUrl(b) }));
        })
        .catch(() => {});
    }
    return () => {
      vivo = false;
    };
  }, [inscricao, minis, novoUrl]);

  async function enviar(criterioId: string, arquivo: File) {
    const problema = erroDoArquivo(arquivo);
    setErros((e) => ({ ...e, [criterioId]: problema }));
    if (problema) return;

    // Miniatura na hora, a partir do File local: em rede móvel o upload demora, e
    // ver a própria foto é o que prova que ela escolheu o arquivo certo.
    if (arquivo.type.startsWith("image/")) {
      setMinis((m) => ({ ...m, [criterioId]: novoUrl(arquivo) }));
    }

    setOcupado((o) => ({ ...o, [criterioId]: "enviando" }));
    setFalha(null);
    try {
      await chamar<RespostaCriterio>(ROTAS.documento(id, criterioId), { arquivo });
      // Releitura: o E11 não devolve a pontuação, e o rodapé não pode inventá-la.
      setInscricao(await chamar<Inscricao>(ROTAS.inscricao(id)));
    } catch (e) {
      setErros((er) => ({ ...er, [criterioId]: mensagemDe(e) }));
    } finally {
      setOcupado((o) => ({ ...o, [criterioId]: undefined }));
    }
  }

  async function remover(criterioId: string, documentoId: string) {
    setOcupado((o) => ({ ...o, [criterioId]: "removendo" }));
    setErros((e) => ({ ...e, [criterioId]: null }));
    try {
      await chamar<RespostaCriterio>(ROTAS.arquivo(documentoId), { metodo: "DELETE" });
      setMinis((m) => {
        const { [criterioId]: _fora, ...resto } = m;
        return resto;
      });
      setInscricao(await chamar<Inscricao>(ROTAS.inscricao(id)));
    } catch (e) {
      setErros((er) => ({ ...er, [criterioId]: mensagemDe(e) }));
    } finally {
      setOcupado((o) => ({ ...o, [criterioId]: undefined }));
    }
  }

  async function baixar(doc: DocumentoResumo) {
    try {
      const blob = await baixarArquivo(ROTAS.arquivo(doc.id));
      const a = document.createElement("a");
      a.href = novoUrl(blob);
      a.download = doc.nome_arquivo;
      a.click();
    } catch (e) {
      setFalha(mensagemDe(e));
    }
  }

  if (!criterios || !inscricao) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        {falha ? (
          <Aviso tom="faltando" titulo="Não foi possível abrir a tela">{falha}</Aviso>
        ) : (
          <Carregando linhas={4} rotulo="Carregando seus comprovantes..." />
        )}
      </div>
    );
  }

  const porId = new Map(criterios.map((c) => [c.id, c]));
  const declaradas = inscricao.respostas.filter((r) => r.declarado);
  // A `situacao` manda: `nao_comprovado` precisa de envio, `documento_pendente` já tem.
  const pendentes = declaradas.filter(
    (r) => r.situacao === "nao_comprovado" || r.situacao === "documento_pendente",
  );
  const pelaBase = declaradas.filter((r) => r.situacao === "confirmado_base");

  const { pontos_que_contam: contam, pontos_declarados: declaradosPts } = inscricao.pontuacao;
  const perdidos = declaradosPts - contam;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6 pt-6">
      <h1 className="text-[22px] font-semibold tracking-tight">Comprovantes</h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        Fotografe o documento com o celular ou envie um PDF. O documento não é conferido agora:
        ele fica guardado e a unidade confere no dia da matrícula. Você pode enviar depois — a
        inscrição não fica travada esperando.
      </p>

      {falha && (
        <div className="mt-4">
          <Aviso tom="faltando" titulo="Algo falhou">{falha}</Aviso>
        </div>
      )}

      {/* ── o que a base já resolveu: o RF2.2 dito onde ele alivia ── */}
      {pelaBase.length > 0 && (
        <div className="fu-cartao fu-base mt-5" data-tom="confirmado">
          <p className="fu-base__titulo">
            {pelaBase.length === 1
              ? "1 item já foi confirmado pela prefeitura"
              : `${pelaBase.length} itens já foram confirmados pela prefeitura`}
            . Você não precisa enviar documento deles.
          </p>
          <ul className="fu-base__lista">
            {pelaBase.map((r) => (
              <li key={r.criterio_id} className="fu-base__item">
                <span aria-hidden="true">✓</span>
                <span>
                  {porId.get(r.criterio_id)?.texto ?? "critério"}{" "}
                  <strong className="fu-num">
                    ({nf.format(r.pontos_que_contam)} pts contando)
                  </strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── os que dependem de comprovante ── */}
      {pendentes.length === 0 ? (
        <div className="mt-5">
          <Vazio
            titulo={
              declaradas.length === 0
                ? "Você ainda não marcou nenhuma situação"
                : "Não falta nenhum comprovante"
            }
            descricao={
              declaradas.length === 0
                ? "Volte e marque o que vale para a sua família. Alguns itens a prefeitura confirma sozinha."
                : "Tudo que você marcou já está confirmado ou com documento enviado."
            }
            acao={
              <Botao
                variante="secundario"
                onClick={() => navegar(`/inscricao/${id}/vulnerabilidades`)}
              >
                Voltar para a lista de situações
              </Botao>
            }
          />
        </div>
      ) : (
        <ul className="fu-criterios mt-5">
          {pendentes.map((r) => (
            <CartaoDocumento
              key={r.criterio_id}
              criterio={porId.get(r.criterio_id)}
              resposta={r}
              mini={minis[r.criterio_id]}
              erro={erros[r.criterio_id] ?? null}
              ocupado={ocupado[r.criterio_id]}
              aoEnviar={(f) => enviar(r.criterio_id, f)}
              aoRemover={(docId) => remover(r.criterio_id, docId)}
              aoBaixar={baixar}
            />
          ))}
        </ul>
      )}

      {/* ── o mesmo contador da tela anterior: os dois números vêm prontos ── */}
      <div className="fu-rodape-pontos">
        <div aria-live="polite">
          <div className="fu-rodape-pontos__numeros">
            <span className="fu-rodape-pontos__valor fu-num">{nf.format(contam)}</span>
            <span className="fu-rodape-pontos__de">
              {contam === 1 ? "ponto" : "pontos"} contando. Você declarou{" "}
              <strong className="fu-num">{nf.format(declaradosPts)}</strong>.
            </span>
          </div>
          {perdidos > 0 ? (
            <p className="fu-rodape-pontos__perda">
              Ainda faltam <strong className="fu-num">{nf.format(perdidos)}</strong>{" "}
              {perdidos === 1 ? "ponto" : "pontos"} em comprovante. Você pode enviar agora ou
              seguir e enviar depois.
            </p>
          ) : (
            declaradosPts > 0 && (
              <p className="fu-rodape-pontos__ok">
                Tudo que você marcou está contando.
              </p>
            )
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Botao
            variante="secundario"
            onClick={() => navegar(`/inscricao/${id}/vulnerabilidades`)}
          >
            Voltar
          </Botao>
          {/* Comprovante faltando NÃO bloqueia a revisão nem o envio (RF2.4). */}
          <Botao larguraTotal onClick={() => navegar(`/inscricao/${id}/revisar`)}>
            Revisar a inscrição
          </Botao>
        </div>
      </div>
    </div>
  );
}

function CartaoDocumento({
  criterio,
  resposta,
  mini,
  erro,
  ocupado,
  aoEnviar,
  aoRemover,
  aoBaixar,
}: {
  criterio: Criterio | undefined;
  resposta: RespostaCriterio;
  mini: string | undefined;
  erro: string | null;
  ocupado: "enviando" | "removendo" | undefined;
  aoEnviar: (f: File) => void;
  aoRemover: (documentoId: string) => void;
  aoBaixar: (d: DocumentoResumo) => void;
}) {
  const doc = resposta.documento;
  const enviando = ocupado === "enviando";
  const removendo = ocupado === "removendo";
  const ajuda = criterio ? AJUDA_CRITERIO[criterio.codigo] : undefined;
  const extensao = doc ? (doc.mime === "application/pdf" ? "PDF" : "DOC") : "";

  return (
    <li className="fu-cartao fu-doc" data-tom={doc ? "pendente" : "faltando"}>
      <div className="fu-doc__cabeca">
        <span className="fu-doc__texto">{criterio?.texto ?? "Critério"}</span>
        <span className="fu-doc__pontos fu-num">
          {nf.format(resposta.pontos_se_valer)} pts
        </span>
      </div>

      {ajuda && <p className="fu-criterio__ajuda">{ajuda}</p>}

      <div className="fu-criterio__estado">
        <ChipSituacao situacao={resposta.situacao} />
        <span
          className="fu-criterio__frase"
          data-tom={resposta.situacao === "documento_pendente" ? "pendente" : "faltando"}
        >
          {fraseDaSituacao(resposta.situacao)}
        </span>
      </div>

      {doc && (
        <div className="fu-doc__anexo">
          {mini ? (
            <img className="fu-doc__mini" src={mini} alt={`Miniatura de ${doc.nome_arquivo}`} />
          ) : (
            <span className="fu-doc__mini" aria-hidden="true">{extensao}</span>
          )}
          <span className="fu-doc__meta">
            <span className="fu-doc__nome" title={doc.nome_arquivo}>{doc.nome_arquivo}</span>
            <span className="fu-doc__tamanho fu-num">{tamanhoLegivel(doc.tamanho)}</span>
          </span>
        </div>
      )}

      {enviando && (
        <div className="fu-doc__barra" role="progressbar" aria-label="Enviando o arquivo" />
      )}

      <div className="fu-doc__acoes">
        {/* `capture="environment"` abre a câmera traseira no celular e cai no
            seletor de arquivo no desktop. Os dois comportamentos são corretos. */}
        <input
          type="file"
          id={`arquivo-${resposta.criterio_id}`}
          className="fu-sr fu-doc__entrada"
          accept={`${MIMES_ACEITOS.join(",")}`}
          capture="environment"
          disabled={enviando || removendo}
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Zera o input: sem isto, escolher o MESMO arquivo de novo depois de um
            // erro não dispara `change`, e a tela parece travada.
            e.target.value = "";
            if (f) aoEnviar(f);
          }}
        />
        <label className="fu-doc__escolher" htmlFor={`arquivo-${resposta.criterio_id}`}>
          {enviando ? "Enviando..." : doc ? "Trocar o arquivo" : "Enviar comprovante"}
        </label>

        {doc && (
          <>
            <Botao variante="secundario" onClick={() => aoBaixar(doc)} disabled={enviando || removendo}>
              Baixar
            </Botao>
            <Botao
              variante="perigo"
              carregando={removendo}
              disabled={enviando}
              onClick={() => aoRemover(doc.id)}
            >
              Remover
            </Botao>
          </>
        )}
      </div>

      {erro && <p className="fu-doc__erro" role="alert">{erro}</p>}
    </li>
  );
}
