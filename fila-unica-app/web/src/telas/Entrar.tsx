import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { mensagemDe } from "../api/client";
import { useSessao } from "../auth";
import { destinoPosLogin } from "../destino";
import { erroDeCpf, erroDeData, mascaraCpf, soDigitos } from "../formato";
import { Aviso, Botao, Campo, Titulo } from "./provisorio-ui";

export default function Entrar() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const local = useLocation() as { state?: { de?: string } };

  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [erros, setErros] = useState<{ cpf?: string; nascimento?: string }>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = { cpf: erroDeCpf(cpf), nascimento: erroDeData(nascimento, "data de nascimento") };
    setErros(v);
    if (v.cpf || v.nascimento) return;

    setEnviando(true);
    setFalha(null);
    try {
      const me = await entrar({ cpf: soDigitos(cpf), nascimento });
      // Respeita a rota de origem quando a familia foi barrada por <RotaProtegida>;
      // fora disso, decide pelo estado das inscricoes em vez de mandar todo mundo
      // para "cadastrar nova crianca".
      navegar(local.state?.de ?? (await destinoPosLogin(me)), { replace: true });
    } catch (erro) {
      setFalha(mensagemDe(erro));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Titulo apoio="Entre com o CPF do responsável e a data de nascimento dele. Não tem senha.">
        Inscrição na creche
      </Titulo>

      <form onSubmit={enviar} className="card space-y-4 p-5" noValidate>
        <Campo
          rotulo="CPF do responsável"
          inputMode="numeric"
          autoComplete="username"
          placeholder="000.000.000-00"
          value={mascaraCpf(cpf)}
          erro={erros.cpf}
          onChange={(e) => setCpf(e.target.value)}
        />
        <Campo
          rotulo="Data de nascimento do responsável"
          type="date"
          autoComplete="bday"
          value={nascimento}
          erro={erros.nascimento}
          onChange={(e) => setNascimento(e.target.value)}
        />

        {falha && <Aviso tom="ruim">{falha}</Aviso>}

        <Botao tipo="submit" largura="cheia" desabilitado={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </Botao>

        <p className="text-center text-[13px]" style={{ color: "var(--text-2)" }}>
          Primeira vez?{" "}
          <Link to="/cadastrar" style={{ color: "var(--ociosa)", textDecoration: "underline" }}>
            Criar acesso
          </Link>
        </p>
      </form>
    </div>
  );
}
