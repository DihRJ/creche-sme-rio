/**
 * MinhaInscricao (Dev C) — o acompanhamento.
 *
 * Primeira tarefa do bloco 2:50 → 3:30: situação, número de sorteio, criança e as
 * cinco opções na ordem. A linha do tempo do calendário (E4) e o resultado (E15)
 * são as tarefas seguintes e entram nos pontos marcados abaixo.
 *
 * O contrato não tem rótulo para `SituacaoInscricao` e está congelado, então o
 * vocabulário de tela vive aqui. É copy, não regra: nenhuma decisão sobre a
 * inscrição é tomada no cliente — a situação vem pronta do servidor e esta tela
 * só a traduz para português que a família entenda.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { USANDO_MOCK, chamar, mensagemDe } from "../api/client";
import { RESULTADO_DEMO } from "../api/resultado-demo";
import type { Fase, Inscricao, Processo, Resultado, SituacaoInscricao } from "../contracts.gen";
import { ROTAS, ROTULO_GRUPAMENTO } from "../contracts.gen";
import { mascaraCpf, nf } from "../formato";
import { Aviso, Botao, Carregando, Chip, Passos, Vazio } from "../ui";
import { diasAte, periodo } from "../ui/datas";
import type { Passo, Tom } from "../ui";

/**
 * "Classificada" e "não alocada" não querem dizer nada para quem está na fila.
 * Cada situação ganha rótulo curto para o chip e uma frase que diz o que
 * aconteceu e o que a família faz agora.
 */
const SITUACAO: Record<SituacaoInscricao, { rotulo: string; tom: Tom; frase: string }> = {
  rascunho: {
    rotulo: "Não enviada",
    tom: "faltando",
    frase:
      "Esta inscrição ainda não foi enviada. Enquanto ela estiver assim, a criança não está na fila.",
  },
  enviada: {
    rotulo: "Na fila",
    tom: "pendente",
    frase:
      "A inscrição foi recebida. A classificação acontece na data da rodada, e você não precisa fazer mais nada até lá.",
  },
  classificada: {
    rotulo: "Classificada",
    tom: "pendente",
    frase: "A classificação já rodou. O resultado aparece abaixo.",
  },
  convocada: {
    rotulo: "Convocada",
    tom: "confirmado",
    frase:
      "A criança foi chamada para uma vaga. Procure a unidade dentro do prazo de matrícula — passado o prazo, a vaga vai para a próxima criança da fila.",
  },
  matriculada: {
    rotulo: "Matriculada",
    tom: "confirmado",
    frase: "A matrícula está confirmada na unidade.",
  },
  nao_alocada: {
    rotulo: "Sem vaga nesta rodada",
    tom: "faltando",
    frase:
      "Não houve vaga nas creches que você escolheu nesta rodada. A inscrição continua valendo para as rodadas seguintes.",
  },
};

/** Data por extenso curta: "10/03/2025". A `dataCurta` do Dev B omite o ano. */
function dataCompleta(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

/**
 * Situações em que a classificação já rodou para esta criança. Quem decide isso é
 * o servidor: a tela não compara data de rodada com hoje para adivinhar se saiu
 * resultado. Fora desta lista, não há E15 para buscar.
 */
const JA_CLASSIFICADA: SituacaoInscricao[] = [
  "classificada",
  "convocada",
  "matriculada",
  "nao_alocada",
];

const ESTADO_DA_FASE: Record<Fase["situacao"], Passo["estado"]> = {
  encerrada: "concluido",
  atual: "atual",
  futura: "futuro",
};

export default function MinhaInscricao() {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const [inscricao, setInscricao] = useState<Inscricao | null>(null);
  /** O calendário é público (E4) e independe da inscrição. Se ele falhar, a tela
   *  continua: perder a linha do tempo é ruim, esconder a inscrição seria pior. */
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    chamar<Inscricao>(ROTAS.inscricao(id))
      .then((i) => {
        if (!vivo) return;
        setInscricao(i);
        setFalha(null);
      })
      .catch((e) => vivo && setFalha(mensagemDe(e)));

    chamar<Processo>(ROTAS.processo)
      .then((p) => vivo && setProcesso(p))
      .catch(() => vivo && setProcesso(null));

    return () => {
      vivo = false;
    };
  }, [id]);

  /* O E15 só existe depois da classificação, e é o servidor quem diz que ela
   * rodou, pela `situacao` da inscrição. Buscar antes devolveria o molde vazio. */
  useEffect(() => {
    if (!inscricao || !JA_CLASSIFICADA.includes(inscricao.situacao)) return;
    let vivo = true;
    chamar<Resultado>(ROTAS.resultado(inscricao.id))
      .then((r) => vivo && setResultado(r))
      .catch(() => vivo && setResultado(null));
    return () => {
      vivo = false;
    };
  }, [inscricao]);

  if (!inscricao) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        {falha ? (
          <Aviso tom="faltando" titulo="Não foi possível abrir a inscrição">{falha}</Aviso>
        ) : (
          <Carregando linhas={4} rotulo="Abrindo a inscrição..." />
        )}
      </div>
    );
  }

  const s = SITUACAO[inscricao.situacao];
  const opcoes = [...inscricao.opcoes].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
      <h1 className="text-[22px] font-semibold tracking-tight">
        Inscrição de {inscricao.crianca.nome}
      </h1>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-3)" }}>
        Processo de {inscricao.processo_ano}
      </p>

      {/* ── situação ── */}
      <div className="fu-cartao fu-painel mt-5" data-tom={s.tom}>
        <Chip tom={s.tom}>{s.rotulo}</Chip>
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {s.frase}
        </p>

        {inscricao.situacao === "rascunho" && (
          <div className="mt-4">
            <Botao larguraTotal onClick={() => navegar(`/inscricao/${id}/revisar`)}>
              Revisar e enviar a inscrição
            </Botao>
          </div>
        )}
      </div>

      {/* ── número de inscrição ── */}
      {inscricao.numero_sorteio && (
        <div className="fu-cartao fu-painel mt-4">
          <p className="fu-painel__rotulo">Número de inscrição</p>
          <p className="fu-sorteio">{inscricao.numero_sorteio}</p>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            Este número desempata quando duas crianças terminam com a mesma pontuação. Ele é
            calculado a partir de uma semente publicada antes do fim das inscrições, então
            qualquer pessoa pode conferir depois que ele não foi escolhido para favorecer
            ninguém. Guarde-o: é por ele que a unidade encontra a inscrição.
          </p>
        </div>
      )}

      {/* ── criança ── */}
      <section className="fu-cartao fu-secao">
        <h2 className="fu-secao__titulo">Criança</h2>
        <dl className="fu-dados">
          <dt>Nome</dt>
          <dd>{inscricao.crianca.nome}</dd>
          <dt>CPF</dt>
          <dd className="fu-num">{mascaraCpf(inscricao.crianca.cpf)}</dd>
          <dt>Nascimento</dt>
          <dd className="fu-num">{dataCompleta(inscricao.crianca.nascimento)}</dd>
          <dt>Grupamento</dt>
          <dd>
            {ROTULO_GRUPAMENTO[inscricao.grupamento]} · turno {inscricao.turno}
          </dd>
        </dl>
      </section>

      {/* ── as cinco opções, na ordem ── */}
      <section className="fu-cartao fu-secao">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="fu-secao__titulo mb-0">
            Creches escolhidas
            {opcoes.length > 0 && (
              <span className="fu-num" style={{ color: "var(--text-3)", fontWeight: 400 }}>
                {" "}
                ({opcoes.length})
              </span>
            )}
          </h2>
          {inscricao.situacao === "rascunho" && (
            <Link
              to={`/inscricao/${id}/unidades`}
              className="text-[13px]"
              style={{ color: "var(--ociosa)" }}
            >
              Mudar
            </Link>
          )}
        </div>

        {opcoes.length === 0 ? (
          <Vazio
            titulo="Nenhuma creche escolhida"
            descricao="Sem ao menos uma creche na lista, a inscrição não pode ser enviada."
            acao={
              <Botao variante="secundario" onClick={() => navegar(`/inscricao/${id}/unidades`)}>
                Escolher creches
              </Botao>
            }
          />
        ) : (
          <>
            {/* A ordem é vinculante (R1): a alocação tenta a 1ª antes da 2ª, e assim
                por diante. Dizer isso aqui evita a leitura de "lista de preferências
                mais ou menos". */}
            <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              A ordem vale: a vaga é procurada na 1ª antes da 2ª, e assim por diante.
              {inscricao.situacao !== "rascunho" && " Depois do envio, ela não muda mais."}
            </p>
            <ol className="fu-opcoes">
              {opcoes.map((o) => (
                <li key={o.oferta.id} className="fu-opcao">
                  <span className="fu-opcao__ordem" aria-hidden="true">{o.ordem}</span>
                  <span className="fu-opcao__corpo">
                    <span className="fu-opcao__nome">
                      <span className="fu-sr">Opção {o.ordem}: </span>
                      {o.oferta.unidade.nome}
                    </span>
                    <span className="fu-opcao__local">
                      {[o.oferta.unidade.bairro, `${ROTULO_GRUPAMENTO[o.oferta.grupamento]} · ${o.oferta.turno}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* ── linha do tempo do calendário (E4) ──
          O G6 do PRD é a família descobrir o prazo quando já foi chamada, e às
          vezes tarde demais. Aqui o calendário inteiro fica visível desde o
          primeiro dia, com a fase atual destacada e os dias que faltam. */}
      {processo && processo.fases.length > 0 && (
        <LinhaDoTempo processo={processo} />
      )}

      {/* ── resultado (E15) ──
          O painel só aparece quando o servidor diz que a classificação rodou.
          Contra o mock isso nunca acontece — ele responde o E15 com um molde
          vazio — e aí entra o caso real de 2025, rotulado como exemplo. */}
      {resultado ? (
        <PainelResultado resultado={resultado} />
      ) : (
        USANDO_MOCK &&
        inscricao.situacao === "enviada" && (
          <PainelResultado resultado={RESULTADO_DEMO} exemplo />
        )
      )}

      {falha && (
        <div className="mt-4">
          <Aviso tom="faltando" titulo="Algo falhou">{falha}</Aviso>
        </div>
      )}
    </div>
  );
}

/**
 * O calendário do processo, com a fase atual destacada (E4).
 *
 * Quem decide qual fase está aberta é o servidor, pelo campo `situacao` de cada
 * `Fase` — a tela não compara datas para descobrir isso. A única aritmética aqui
 * é quantos dias faltam para o fim da fase que o servidor já marcou como atual,
 * e isso é exibição, não regra.
 */
function LinhaDoTempo({ processo }: { processo: Processo }) {
  const atual = processo.fases.find((f) => f.situacao === "atual");
  const dias = atual ? diasAte(atual.fim) : null;

  const passos: Passo[] = processo.fases.map((f) => ({
    chave: f.tipo,
    titulo: f.titulo,
    estado: ESTADO_DA_FASE[f.situacao],
    detalhe: periodo(f.inicio, f.fim),
  }));

  return (
    <section className="fu-cartao fu-secao">
      <h2 className="fu-secao__titulo">Calendário do processo {processo.ano}</h2>

      <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        Todas as datas já estão definidas. Você não precisa esperar ser avisada para saber
        quando cada etapa acontece.
      </p>

      <Passos passos={passos} orientacao="vertical" />

      {/* O prazo em dias vem depois da lista, não dentro dela: ele fala de UMA fase,
          e repetido em cada linha viraria ruído. */}
      {atual && dias !== null && dias >= 0 && (
        <p className="fu-prazo" data-urgente={dias <= 7}>
          <span aria-hidden="true">◷</span>
          {dias === 0
            ? `Último dia de "${atual.titulo}" é hoje`
            : dias === 1
              ? `Falta 1 dia para o fim de "${atual.titulo}"`
              : `Faltam ${dias} dias para o fim de "${atual.titulo}"`}
        </p>
      )}

      {/* A matrícula é onde a vaga se perde: 5.994 crianças foram convocadas e não
          matriculadas em 2025. Dizer o prazo antes é o ponto da tela. */}
      {processo.fases.some((f) => f.tipo === "matricula") && (
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Se a criança for chamada, a matrícula precisa ser feita na unidade dentro do período
          de matrícula acima. Passado o prazo, a vaga vai para a próxima criança da fila.
        </p>
      )}
    </section>
  );
}

/**
 * O resultado da classificação (E15), com o que o RF4.1 exige: para cada creche
 * que a família pediu, a nota de corte dela contra a pontuação da criança.
 *
 * A REGRA NÃO MORA AQUI. Os números vêm do motor e a explicação vem pronta do
 * servidor (`server/src/explicacao.ts`, a camada 2 da AD-12, reescrita pelo
 * modelo na camada 3). Esta função não decide quem entrou, não soma ponto e não
 * remonta a frase — um segundo lugar onde a regra é escrita é um segundo lugar
 * onde ela diverge.
 */
function PainelResultado({
  resultado,
  exemplo = false,
}: {
  resultado: Resultado;
  exemplo?: boolean;
}) {
  const { alocada, posicao_preferencia: posicao, detalhe_opcoes: opcoes } = resultado;
  const conseguida = opcoes.find((o) => o.conseguiu);

  return (
    <section className="fu-cartao fu-secao">
      <h2 className="fu-secao__titulo">Resultado</h2>

      {exemplo && (
        <p className="fu-exemplo">
          <strong>Exemplo com dados reais do processo de 2025.</strong> A classificação não roda
          no ambiente de demonstração, então este painel mostra um caso verdadeiro da base da SME
          — pontuação, nota de corte e número de candidatos são os que aconteceram. Não é o
          resultado desta inscrição.
        </p>
      )}

      {/* ── onde a criança ficou ── */}
      <div className="fu-cartao fu-painel" data-tom={alocada ? "confirmado" : "faltando"}>
        <p className="fu-resultado__manchete">
          {alocada ? "Conseguiu vaga" : "Não conseguiu vaga nesta rodada"}
        </p>
        {alocada && conseguida && (
          <p className="fu-resultado__unidade">
            {conseguida.unidade}
            {posicao !== null && (
              <span style={{ color: "var(--text-3)" }}>
                {" "}
                — sua {posicao}ª opção
              </span>
            )}
          </p>
        )}
        {!alocada && (
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            A inscrição continua valendo para as rodadas seguintes. Você não precisa se inscrever
            de novo.
          </p>
        )}
      </div>

      {/* ── nota de corte × pontuação, creche por creche (RF4.1) ── */}
      {opcoes.length > 0 && (
        <>
          <h3 className="mt-5 text-[14px] font-semibold">Creche por creche</h3>
          <p className="mb-3 mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            A nota de corte é a pontuação da última criança que conseguiu vaga na unidade. Se a
            sua pontuação ficou abaixo dela, não havia vaga a partir da sua posição.
          </p>

          <ul className="fu-criterios">
            {[...opcoes]
              .sort((a, b) => a.ordem - b.ordem)
              .map((o) => {
                const corte = o.nota_de_corte;
                // Empate na nota de corte é comum quando a régua não valida nada e
                // todo mundo fica em 0: aí quem separa é o número de sorteio.
                const empatou = corte !== null && o.sua_pontuacao === corte && !o.conseguiu;
                return (
                  <li
                    key={o.ordem}
                    className="fu-cartao fu-corte"
                    data-tom={o.conseguiu ? "confirmado" : "faltando"}
                  >
                    <div className="fu-corte__topo">
                      <span className="fu-corte__ordem">{o.ordem}ª</span>
                      <span className="fu-corte__unidade">{o.unidade}</span>
                    </div>

                    <div className="fu-corte__placar">
                      <span className="fu-corte__lado">
                        <span className="fu-corte__rotulo">Sua pontuação</span>
                        <span className="fu-corte__valor">{nf.format(o.sua_pontuacao)}</span>
                      </span>
                      <span className="fu-corte__vs" aria-hidden="true">
                        ×
                      </span>
                      <span className="fu-corte__lado">
                        <span className="fu-corte__rotulo">Nota de corte</span>
                        <span className="fu-corte__valor">
                          {corte === null ? "—" : nf.format(corte)}
                        </span>
                      </span>
                    </div>

                    <p className="fu-corte__conta fu-num">
                      {nf.format(o.candidatos)}{" "}
                      {o.candidatos === 1 ? "criança concorreu" : "crianças concorreram"} a{" "}
                      {nf.format(o.capacidade)}{" "}
                      {o.capacidade === 1 ? "vaga" : "vagas"}
                    </p>

                    <p className="fu-corte__veredito" data-tom={o.conseguiu ? "confirmado" : "faltando"}>
                      {o.conseguiu
                        ? "Conseguiu vaga aqui"
                        : empatou
                          ? "Empatou com a nota de corte, e o desempate não veio a seu favor"
                          : corte === null
                            ? "Não conseguiu vaga aqui"
                            : `Faltaram ${nf.format(corte - o.sua_pontuacao)} ${
                                corte - o.sua_pontuacao === 1 ? "ponto" : "pontos"
                              }`}
                    </p>
                  </li>
                );
              })}
          </ul>
        </>
      )}

      {/* ── a explicação em texto, pronta do servidor ── */}
      {resultado.explicacao && (
        <>
          <h3 className="mt-5 text-[14px] font-semibold">O que aconteceu</h3>
          <p className="fu-explicacao mt-2">{resultado.explicacao}</p>
          {/* Transparência sobre a origem do texto. Os NÚMEROS são sempre do motor;
              o que muda é quem escreveu a prosa em volta deles. */}
          <p className="fu-explicacao__origem">
            {resultado.origem_explicacao === "modelo"
              ? "Texto escrito por um assistente de IA a partir dos números da classificação. Os números são do sistema e podem ser conferidos acima."
              : "Texto gerado automaticamente a partir dos números da classificação."}
          </p>
        </>
      )}
    </section>
  );
}
