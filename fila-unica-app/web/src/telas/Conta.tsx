/**
 * Minha conta — dados do responsável, contato editável e as inscrições em resumo.
 *
 * A razão de existir é o E16, que estava no ar sem nenhuma interface. Editar o
 * contato é o gargalo G4 do PRD e o mais barato de consertar de todos: 5.994
 * crianças foram convocadas e não matriculadas em 2025, cerca de 44 mil de 2021 a
 * 2025. Sem contato válido não há convocação — hoje o diretor anota o telefone novo
 * no caderno porque o sistema não deixa editar, e a vaga se perde.
 *
 * A lista daqui é DELIBERADAMENTE compacta. A visão rica, com pontuação e
 * pendências, é a `/inscricoes` do Dev B: aqui é "minha conta", lá é "minhas
 * inscrições". Duas telas, dois papéis.
 *
 * Nome, CPF e nascimento aparecem em somente leitura porque o contrato não tem
 * endpoint para alterá-los — o E16 recebe `CorpoContatos` e nada mais. E faz
 * sentido: o CPF é a chave de login e a identidade validada.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { chamar, mensagemDe } from "../api/client";
import { useSessao } from "../auth";
import { ROTAS, ROTULO_GRUPAMENTO } from "../contracts.gen";
import type { CanalContato, Contato, Responsavel } from "../contracts.gen";
import { EXPLICACAO_SITUACAO, ROTULO_SITUACAO, TOM_SITUACAO, etapaDoRascunho } from "../destino";
import { mascaraCpf, mascaraTelefone } from "../formato";
import { Aviso, Botao, Campo, Carregando, Vazio } from "../ui";
import { Titulo } from "./provisorio-ui";
import type { Inscricao } from "../contracts.gen";

/** Ordem de exibição e rótulo de cada canal. O e-mail vem por último, como no form. */
const CANAIS: { canal: CanalContato; rotulo: string; ajuda: string; tipo: string }[] = [
  {
    canal: "telefone_principal",
    rotulo: "Telefone principal",
    ajuda: "É por aqui que a convocação chega primeiro, por SMS.",
    tipo: "tel",
  },
  {
    canal: "telefone_alternativo",
    rotulo: "Telefone alternativo",
    ajuda: "De um parente ou vizinho, para o caso de o principal não atender.",
    tipo: "tel",
  },
  { canal: "email", rotulo: "E-mail", ajuda: "Recebe o mesmo aviso da convocação.", tipo: "email" },
];

const valorDe = (contatos: Contato[], canal: CanalContato) =>
  contatos.find((c) => c.canal === canal)?.valor ?? "";

export default function Conta() {
  const { me, recarregar, sair } = useSessao();
  const responsavel = me?.responsavel ?? null;

  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // Sempre que a sessão recarrega, o formulário volta a refletir o servidor.
  useEffect(() => {
    if (!responsavel) return;
    setRascunho(Object.fromEntries(CANAIS.map((c) => [c.canal, valorDe(responsavel.contatos, c.canal)])));
  }, [responsavel]);

  const alterados = useMemo(() => {
    if (!responsavel) return [];
    return CANAIS.filter(({ canal }) => {
      const novo = (rascunho[canal] ?? "").trim();
      return novo !== "" && novo !== valorDe(responsavel.contatos, canal);
    }).map(({ canal }) => ({ canal, valor: (rascunho[canal] ?? "").trim() }));
  }, [rascunho, responsavel]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (alterados.length === 0) return;
    setSalvando(true);
    setFalha(null);
    setSalvo(false);
    try {
      // O E16 versiona: a versão anterior fica no histórico, não é sobrescrita.
      await chamar<Responsavel>(ROTAS.contatos, { metodo: "PUT", corpo: { contatos: alterados } });
      await recarregar();
      setSalvo(true);
    } catch (erro) {
      setFalha(mensagemDe(erro));
    } finally {
      setSalvando(false);
    }
  }

  if (!responsavel) return <Carregando rotulo="Carregando seus dados" />;

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <Titulo apoio="Seus dados e suas inscrições">Minha conta</Titulo>

      {/* ── dados pessoais ─────────────────────────────────────────── */}
      <section className="fu-cartao space-y-3 p-4">
        <h2 className="text-[15px] font-semibold">Dados pessoais</h2>
        <dl className="space-y-2 text-[14px]">
          {[
            ["Nome", responsavel.nome],
            ["CPF", mascaraCpf(responsavel.cpf)],
            ["Data de nascimento", responsavel.nascimento.split("-").reverse().join("/")],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-4">
              <dt style={{ color: "var(--text-2)" }}>{rotulo}</dt>
              <dd className="text-right font-medium">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] leading-snug" style={{ color: "var(--text-3)" }}>
          Nome, CPF e data de nascimento não podem ser alterados aqui: o CPF é o seu login e a
          identificação validada na Receita. Para corrigir, procure um polo de atendimento.
        </p>
      </section>

      {/* ── contato, editável (E16 · RF1.5) ────────────────────────── */}
      <section className="fu-cartao space-y-4 p-4">
        <div>
          <h2 className="text-[15px] font-semibold">Contato</h2>
          <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-2)" }}>
            Mudou de número? Corrija aqui, a qualquer momento, sem ir à unidade e sem refazer a
            inscrição. <strong>Sem contato válido a convocação não chega.</strong>
          </p>
        </div>

        <form onSubmit={salvar} className="space-y-4" noValidate>
          {CANAIS.map(({ canal, rotulo, ajuda, tipo }) => {
            const atual = responsavel.contatos.find((c) => c.canal === canal);
            return (
              <div key={canal} className="space-y-1">
                <Campo
                  rotulo={rotulo}
                  ajuda={ajuda}
                  type={tipo}
                  inputMode={tipo === "tel" ? "numeric" : undefined}
                  autoComplete={tipo === "tel" ? "tel" : "email"}
                  value={rascunho[canal] ?? ""}
                  onChange={(ev) =>
                    setRascunho((r) => ({
                      ...r,
                      [canal]: tipo === "tel" ? mascaraTelefone(ev.target.value) : ev.target.value,
                    }))
                  }
                />
                {/* A versão é a prova, para a família, de que a correção foi registrada.
                    É o RF1.5 visível: toda alteração fica versionada com data. */}
                {atual && atual.versao > 1 && (
                  <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                    Alterado {atual.versao - 1}×. Versão atual salva em{" "}
                    {new Date(atual.atualizado_em).toLocaleDateString("pt-BR")}.
                  </p>
                )}
              </div>
            );
          })}

          {falha && <Aviso tom="faltando">{falha}</Aviso>}
          {salvo && alterados.length === 0 && (
            <Aviso tom="confirmado">Contato atualizado. A convocação vai para os dados novos.</Aviso>
          )}

          <Botao type="submit" carregando={salvando} disabled={alterados.length === 0} larguraTotal>
            {alterados.length === 0
              ? "Nada para salvar"
              : `Salvar ${alterados.length === 1 ? "alteração" : `${alterados.length} alterações`}`}
          </Botao>
        </form>
      </section>

      {/* ── inscrições, em resumo ──────────────────────────────────── */}
      <ResumoInscricoes />

      <button type="button" onClick={sair} className="w-full py-2 text-[14px] underline" style={{ color: "var(--text-3)" }}>
        Sair da conta
      </button>
    </div>
  );
}

/**
 * Lista compacta: nome da criança, situação e as duas ações que a família precisa.
 * Sem pontuação e sem pendências — isso é papel da `/inscricoes`.
 */
function ResumoInscricoes() {
  const { me } = useSessao();
  const resumos = me?.inscricoes ?? [];
  const [detalhes, setDetalhes] = useState<Record<string, Inscricao>>({});

  // O `/me` traz resumo e não diz em que etapa o rascunho parou. Buscamos o
  // detalhe só dos rascunhos, que é onde o botão "Continuar" precisa do destino.
  useEffect(() => {
    const pendentes = resumos.filter((r) => r.situacao === "rascunho");
    if (pendentes.length === 0) return;
    let vivo = true;
    Promise.all(pendentes.map((r) => chamar<Inscricao>(ROTAS.inscricao(r.id))))
      .then((lista) => {
        if (vivo) setDetalhes(Object.fromEntries(lista.map((i) => [i.id, i])));
      })
      .catch(() => {
        /* silencioso: sem o detalhe o botão cai em /unidades, que também resolve */
      });
    return () => {
      vivo = false;
    };
  }, [resumos.map((r) => r.id).join(",")]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Minhas inscrições</h2>
        {resumos.length > 0 && (
          <Link to="/inscricoes" className="text-[13px] underline" style={{ color: "var(--text-2)" }}>
            Ver detalhes
          </Link>
        )}
      </div>

      {resumos.length === 0 ? (
        <Vazio
          titulo="Você ainda não tem inscrição"
          descricao="A inscrição leva poucos minutos e pode ser retomada depois."
          acao={
            <Link to="/inscricao/nova">
              <Botao>Fazer a primeira inscrição</Botao>
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {resumos.map((r) => {
              const detalhe = detalhes[r.id];
              const rascunho = r.situacao === "rascunho";
              return (
                <li key={r.id} className="fu-cartao space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold leading-snug">{r.crianca.nome}</p>
                      {detalhe && (
                        <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
                          {ROTULO_GRUPAMENTO[detalhe.grupamento]} · {detalhe.turno}
                        </p>
                      )}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium"
                      style={{ background: "var(--surface-2)", color: TOM_SITUACAO[r.situacao] }}
                    >
                      {ROTULO_SITUACAO[r.situacao]}
                    </span>
                  </div>

                  <p className="text-[13px] leading-snug" style={{ color: "var(--text-2)" }}>
                    {EXPLICACAO_SITUACAO[r.situacao]}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {rascunho && (
                      <Link to={detalhe ? etapaDoRascunho(detalhe) : `/inscricao/${r.id}/unidades`}>
                        <Botao>Editar inscrição</Botao>
                      </Link>
                    )}
                    {/* Documentos em QUALQUER situação, não só em rascunho: o backend
                        aceita anexar depois de enviada, e é assim que a família
                        regulariza a comprovação que hoje trava em 6,8% de validação. */}
                    <Link to={`/inscricao/${r.id}/documentos`}>
                      <Botao variante="secundario">Documentos</Botao>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link to="/inscricao/nova" className="block">
            <Botao variante="secundario" larguraTotal>
              Inscrever outra criança
            </Botao>
          </Link>
        </>
      )}
    </section>
  );
}
