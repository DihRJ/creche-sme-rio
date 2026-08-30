import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErroDaApi, chamar, mensagemDe } from "../api/client";
import type { Grupamento, Inscricao, Processo, Turno } from "../contracts.gen";
import { GRUPAMENTOS, ROTAS, ROTULO_GRUPAMENTO, TURNOS } from "../contracts.gen";
import { erroDeCpf, erroDeData, grupamentoSugerido, mascaraCpf, soDigitos } from "../formato";
import { Aviso, Botao, Campo, Passos, Selecao, Titulo } from "./provisorio-ui";

type Erros = Partial<Record<"nome" | "cpf" | "nascimento", string>>;

export default function DadosDaCrianca() {
  const navegar = useNavigate();
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [f, setF] = useState({ nome: "", cpf: "", nascimento: "" });
  const [grupamentoEscolhido, setGrupamentoEscolhido] = useState<Grupamento | null>(null);
  const [turno, setTurno] = useState<Turno>("Integral");
  const [erros, setErros] = useState<Erros>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    chamar<Processo>(ROTAS.processo).then(setProcesso).catch(() => setProcesso(null));
  }, []);

  const ano = processo?.ano ?? new Date().getFullYear() + 1;
  const sugerido = grupamentoSugerido(f.nascimento, ano);
  // Derivado, nao efeito: vale a sugestao pela idade ate a familia escolher outro.
  const grupamento: Grupamento = grupamentoEscolhido ?? sugerido ?? "MATERNAL I";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v: Erros = {
      nome: f.nome.trim().length < 3 ? "Escreva o nome completo da criança." : undefined,
      cpf: erroDeCpf(f.cpf),
      nascimento: erroDeData(f.nascimento, "data de nascimento"),
    };
    setErros(v);
    if (Object.values(v).some(Boolean)) return;

    setEnviando(true);
    setFalha(null);
    try {
      const inscricao = await chamar<Inscricao>(ROTAS.inscricoes, {
        corpo: {
          crianca: { nome: f.nome.trim(), cpf: soDigitos(f.cpf), nascimento: f.nascimento },
          grupamento,
          turno,
        },
      });
      navegar(`/inscricao/${inscricao.id}/unidades`);
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.codigo === "CPF_JA_INSCRITO") {
        // RF1.1: uma inscricao ativa por crianca por processo. E a metade da correcao do G1.
        setErros({
          cpf:
            "Esta criança já tem uma inscrição neste processo. Cada criança tem uma inscrição só, " +
            "e é ela que concorre em todas as opções ao mesmo tempo.",
        });
      } else if (erro instanceof ErroDaApi && erro.campo) {
        setErros({ [erro.campo]: erro.message } as Erros);
      } else {
        setFalha(mensagemDe(erro));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Passos etapa={1} />
      <Titulo apoio={`Inscrição para o processo de ${ano}.`}>Dados da criança</Titulo>

      <form onSubmit={enviar} className="card space-y-4 p-5" noValidate>
        <Campo rotulo="Nome completo da criança" value={f.nome} erro={erros.nome}
          onChange={(e) => setF((a) => ({ ...a, nome: e.target.value }))} />
        <Campo rotulo="CPF da criança" inputMode="numeric" placeholder="000.000.000-00"
          value={mascaraCpf(f.cpf)} erro={erros.cpf}
          onChange={(e) => setF((a) => ({ ...a, cpf: e.target.value }))} />
        <Campo rotulo="Data de nascimento" type="date" value={f.nascimento} erro={erros.nascimento}
          onChange={(e) => setF((a) => ({ ...a, nascimento: e.target.value }))} />

        <Selecao
          rotulo="Grupamento"
          ajuda={
            sugerido
              ? `Sugerimos ${ROTULO_GRUPAMENTO[sugerido]} pela idade da criança em março de ${ano}. Você pode mudar.`
              : "Preencha a data de nascimento e sugerimos o grupamento."
          }
          value={grupamento}
          onChange={(e) => setGrupamentoEscolhido(e.target.value as Grupamento)}
        >
          {GRUPAMENTOS.map((g) => (
            <option key={g} value={g}>{ROTULO_GRUPAMENTO[g]}</option>
          ))}
        </Selecao>

        <Selecao
          rotulo="Turno"
          ajuda="Integral é o dia inteiro. Parcial é meio período, e não existe em toda unidade."
          value={turno}
          onChange={(e) => setTurno(e.target.value as Turno)}
        >
          {TURNOS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Selecao>

        {falha && <Aviso tom="ruim">{falha}</Aviso>}

        <Botao tipo="submit" largura="cheia" desabilitado={enviando}>
          {enviando ? "Salvando..." : "Continuar para escolher as creches"}
        </Botao>
      </form>
    </div>
  );
}
