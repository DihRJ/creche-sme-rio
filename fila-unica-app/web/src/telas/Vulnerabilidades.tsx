/**
 * Vulnerabilidades (Dev C) — a tela do achado.
 *
 * Hoje 93% das inscrições entram na fila com zero ponto porque a comprovação quase
 * nunca é validada: o CadÚnico vale 51 dos 100 pontos da régua e validou em 6,8% em
 * 2025. Esta tela é a resposta a isso, e faz três coisas que o sistema atual não faz:
 *
 *   1. mostra quanto cada critério vale ANTES de a família marcar (E5);
 *   2. devolve o estado item a item (RF2.3), em especial o `confirmado_base`, que
 *      diz "você não precisa enviar documento" — a resposta direta ao 6,8%;
 *   3. mantém à vista quantos pontos estão sendo perdidos, e o que fazer (RF4.3).
 *
 * REGRA QUE ATRAVESSA O ARQUIVO: nenhuma conta de pontuação acontece aqui. O servidor
 * manda `pontos_que_contam` e `pontos_declarados` prontos, e a tela só mostra a
 * diferença. Somar critério no cliente cria uma segunda verdade que diverge da
 * classificação no primeiro caso de borda.
 *
 * Layout de página em Tailwind, como as telas do Dev B; o miolo dos cartões usa as
 * classes `fu-` do kit em `../ui`, que é CSS puro e autocontido.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chamar, mensagemDe } from "../api/client";
import { AJUDA_CRITERIO, VALIDACAO_2025 } from "../api/glossario";
import type { CorpoCriterios, Criterio, Inscricao, RespostaCriterio } from "../contracts.gen";
import { ROTAS } from "../contracts.gen";
import { nf } from "../formato";
import { Aviso, Botao, Carregando, ChipSituacao, fraseDaSituacao } from "../ui";

const declaradosDe = (i: Inscricao) =>
  new Set(i.respostas.filter((r) => r.declarado).map((r) => r.criterio_id));

export default function Vulnerabilidades() {
  const { id = "" } = useParams();
  const navegar = useNavigate();

  const [criterios, setCriterios] = useState<Criterio[] | null>(null);
  const [inscricao, setInscricao] = useState<Inscricao | null>(null);
  /** Espelho otimista do que está marcado: o toque responde na hora, sem esperar a rede. */
  const [declarados, setDeclarados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  /**
   * Marcar e desmarcar rápido dispara vários PUT, e eles voltam fora de ordem —
   * em rede móvel isso é a regra, não a exceção. Só a resposta do pedido mais
   * recente pode escrever no estado; as atrasadas são descartadas.
   */
  const ultimoPedido = useRef(0);

  useEffect(() => {
    let vivo = true;

    Promise.all([
      chamar<Criterio[]>(ROTAS.criterios),
      chamar<Inscricao>(ROTAS.inscricao(id)),
    ])
      .then(([cs, i]) => {
        if (!vivo) return;
        setCriterios(cs);
        setInscricao(i);
        setDeclarados(declaradosDe(i));
        setFalha(null);
      })
      .catch((e) => vivo && setFalha(mensagemDe(e)));

    return () => {
      vivo = false;
    };
  }, [id]);

  async function alternar(criterioId: string) {
    if (!inscricao) return;

    const proximos = new Set(declarados);
    if (proximos.has(criterioId)) proximos.delete(criterioId);
    else proximos.add(criterioId);
    setDeclarados(proximos);

    const meu = ++ultimoPedido.current;
    setSalvando(true);
    setFalha(null);

    const corpo: CorpoCriterios = { declarados: [...proximos] };
    try {
      const nova = await chamar<Inscricao>(ROTAS.criteriosDaInscricao(id), { metodo: "PUT", corpo });
      if (meu !== ultimoPedido.current) return; // já veio resposta mais nova
      setInscricao(nova);
      setDeclarados(declaradosDe(nova));
    } catch (e) {
      if (meu !== ultimoPedido.current) return;
      setFalha(mensagemDe(e));
      setDeclarados(declaradosDe(inscricao)); // volta para o que o servidor tem
    } finally {
      if (meu === ultimoPedido.current) setSalvando(false);
    }
  }

  if (!criterios || !inscricao) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        {falha ? <Aviso tom="faltando" titulo="Não foi possível abrir a tela">{falha}</Aviso> : <Carregando linhas={5} rotulo="Carregando os critérios..." />}
      </div>
    );
  }

  const porCriterio = new Map<string, RespostaCriterio>(
    inscricao.respostas.map((r) => [r.criterio_id, r]),
  );

  const { pontos_que_contam: contam, pontos_declarados: declaradosPts } = inscricao.pontuacao;
  const perdidos = declaradosPts - contam;
  const semLastro = inscricao.respostas.filter((r) => r.situacao === "nao_comprovado");
  const editavel = inscricao.situacao === "rascunho";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6 pt-6">
      <h1 className="text-[22px] font-semibold tracking-tight">Situação da família</h1>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        Marque o que vale para a sua família. Cada item vale uma quantidade de pontos, e a
        pontuação é o que define a ordem da fila. Marcar não é o bastante: o item só pontua se
        a prefeitura conseguir confirmar — e boa parte ela confirma sozinha, sem você enviar nada.
      </p>

      {!editavel && (
        <div className="mt-4">
          <Aviso tom="pendente" titulo="Inscrição já enviada">
            Esta inscrição não aceita mais mudança nos critérios. Você ainda pode enviar
            comprovantes do que declarou.
          </Aviso>
        </div>
      )}

      {falha && (
        <div className="mt-4">
          <Aviso tom="faltando" titulo="A última alteração não foi salva">{falha}</Aviso>
        </div>
      )}

      <ul className="fu-criterios mt-5">
        {criterios.map((c) => (
          <LinhaCriterio
            key={c.id}
            criterio={c}
            resposta={porCriterio.get(c.id)}
            marcado={declarados.has(c.id)}
            editavel={editavel}
            inscricaoId={id}
            aoAlternar={() => alternar(c.id)}
          />
        ))}
      </ul>

      {/* ── o contador, permanente. É o coração do projeto (RF4.3 antecipado) ── */}
      <div className="fu-rodape-pontos">
        {/* `polite`: anuncia o novo total depois que a família marca, sem cortar a leitura. */}
        <div aria-live="polite">
          <div className="fu-rodape-pontos__numeros">
            <span className="fu-rodape-pontos__valor fu-num">{nf.format(contam)}</span>
            <span className="fu-rodape-pontos__de">
              {contam === 1 ? "ponto" : "pontos"} contando. Você declarou{" "}
              <strong className="fu-num">{nf.format(declaradosPts)}</strong>.
            </span>
            {salvando && <span className="fu-rodape-pontos__de">Salvando...</span>}
          </div>

          {perdidos > 0 ? (
            <p className="fu-rodape-pontos__perda">
              Faltam comprovantes em{" "}
              {semLastro.length === 1 ? "1 item" : `${semLastro.length} itens`}, e por isso{" "}
              <strong className="fu-num">{nf.format(perdidos)}</strong>{" "}
              {perdidos === 1 ? "ponto não vai contar" : "pontos não vão contar"} na
              classificação.{" "}
              <Link to={`/inscricao/${id}/documentos`} style={{ color: "inherit" }}>
                Enviar os comprovantes
              </Link>
              .
            </p>
          ) : (
            declaradosPts > 0 && (
              <p className="fu-rodape-pontos__ok">
                Tudo que você marcou está comprovado e contando.
              </p>
            )
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Botao
            variante="secundario"
            onClick={() => navegar(`/inscricao/${id}/unidades`)}
          >
            Voltar
          </Botao>
          {/* Documento faltando NÃO bloqueia (RF2.4): quem decide é o servidor, e ele deixa passar. */}
          <Botao
            larguraTotal
            onClick={() => navegar(`/inscricao/${id}/documentos`)}
          >
            {perdidos > 0 ? "Enviar comprovantes" : "Continuar"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function LinhaCriterio({
  criterio,
  resposta,
  marcado,
  editavel,
  inscricaoId,
  aoAlternar,
}: {
  criterio: Criterio;
  resposta: RespostaCriterio | undefined;
  marcado: boolean;
  editavel: boolean;
  inscricaoId: string;
  aoAlternar: () => void;
}) {
  const situacao = resposta?.situacao ?? "nao_declarado";
  const ajuda = AJUDA_CRITERIO[criterio.codigo];
  const validacao = VALIDACAO_2025[criterio.codigo];
  const frase = fraseDaSituacao(situacao);

  /* Enquanto o PUT está no ar, `marcado` já mudou e `situacao` ainda é a antiga.
   * Mostrar o chip velho ao lado da caixa nova é pior que não mostrar nada. */
  const emVoo = resposta !== undefined && marcado !== resposta.declarado;

  /* Critério de desempate não soma; dizer "0 pontos" e parar aí soaria como
   * "não serve para nada", e ele serve. */
  const desempate = criterio.e_desempate || criterio.pontos === 0;

  return (
    <li className="fu-cartao fu-criterio" data-declarado={marcado} data-tom={marcado ? "confirmado" : "neutro"}>
      <label className="fu-criterio__rotulo">
        <input
          type="checkbox"
          className="fu-criterio__caixa"
          checked={marcado}
          disabled={!editavel}
          onChange={aoAlternar}
        />

        <span className="fu-criterio__corpo">
          <span className="fu-criterio__linha">
            <span className="fu-criterio__texto">{criterio.texto}</span>
            <span className="fu-criterio__pontos fu-num" data-desempate={desempate}>
              {desempate ? "desempate" : `${nf.format(criterio.pontos)} pts`}
            </span>
          </span>

          {ajuda && <span className="fu-criterio__ajuda">{ajuda}</span>}
        </span>
      </label>

      {/* Estado item a item (RF2.3). Só aparece depois de marcar: antes disso não há
          estado nenhum, e um chip "não declarado" em 13 linhas é só ruído. */}
      {marcado && (
        <div className="fu-criterio__estado px-4 pb-4">
          {emVoo ? (
            <span className="fu-criterio__ajuda">Salvando...</span>
          ) : (
            <>
              <ChipSituacao situacao={situacao} />
              {frase && (
                <span
                  className="fu-criterio__frase"
                  data-tom={
                    situacao === "confirmado_base"
                      ? "confirmado"
                      : situacao === "documento_pendente"
                        ? "pendente"
                        : "faltando"
                  }
                >
                  {frase}
                </span>
              )}
              {situacao === "nao_comprovado" && (
                <Link
                  to={`/inscricao/${inscricaoId}/documentos`}
                  className="text-[13px]"
                  style={{ color: "var(--ociosa)" }}
                >
                  Enviar comprovante ({nf.format(criterio.pontos)}{" "}
                  {criterio.pontos === 1 ? "ponto" : "pontos"})
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* O número de 2025 é o argumento do projeto, e ele só faz sentido junto do
          item: "6,8% validaram" ao lado de "vale 51 pontos" explica a fila inteira. */}
      {validacao !== undefined && (
        <p className="fu-criterio__validacao px-4 pb-4">
          Em 2025, {nf.format(validacao)}% de quem declarou este item conseguiu comprovar.
        </p>
      )}
    </li>
  );
}
