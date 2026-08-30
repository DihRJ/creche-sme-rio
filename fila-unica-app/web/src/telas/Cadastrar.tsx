import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErroDaApi, mensagemDe } from "../api/client";
import { useSessao } from "../auth";
import { erroDeCpf, erroDeData, mascaraCpf, mascaraTelefone, soDigitos } from "../formato";
import { Aviso, Botao, Campo, Titulo } from "./provisorio-ui";

type Erros = Partial<Record<"nome" | "cpf" | "nascimento" | "telefone" | "email", string>>;

export default function Cadastrar() {
  const { cadastrar } = useSessao();
  const navegar = useNavigate();

  const [f, setF] = useState({ nome: "", cpf: "", nascimento: "", telefone: "", email: "" });
  const [erros, setErros] = useState<Erros>({});
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const mudar = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((a) => ({ ...a, [campo]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v: Erros = {
      nome: f.nome.trim().length < 3 ? "Escreva o nome completo." : undefined,
      cpf: erroDeCpf(f.cpf),
      nascimento: erroDeData(f.nascimento, "data de nascimento"),
      telefone: soDigitos(f.telefone).length < 10 ? "Informe o telefone com DDD." : undefined,
      email: !f.email.includes("@") ? "Informe um e-mail válido." : undefined,
    };
    setErros(v);
    if (Object.values(v).some(Boolean)) return;

    setEnviando(true);
    setFalha(null);
    try {
      await cadastrar({
        nome: f.nome.trim(),
        cpf: soDigitos(f.cpf),
        nascimento: f.nascimento,
        telefone: soDigitos(f.telefone),
        email: f.email.trim(),
      });
      navegar("/inscricao/nova", { replace: true });
    } catch (erro) {
      // O servidor pode apontar o campo que reprovou; mostra no campo, nao no topo.
      if (erro instanceof ErroDaApi && erro.campo) {
        setErros({ [erro.campo]: erro.message } as Erros);
      } else {
        setFalha(mensagemDe(erro));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Titulo apoio="Estes são os dados do responsável. Os da criança vêm na próxima tela.">
        Criar acesso
      </Titulo>

      <form onSubmit={enviar} className="card space-y-4 p-5" noValidate>
        <Campo
          rotulo="Nome completo"
          autoComplete="name"
          value={f.nome}
          erro={erros.nome}
          onChange={mudar("nome")}
        />
        <Campo
          rotulo="CPF"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={mascaraCpf(f.cpf)}
          erro={erros.cpf}
          onChange={mudar("cpf")}
        />
        <Campo
          rotulo="Data de nascimento"
          type="date"
          value={f.nascimento}
          erro={erros.nascimento}
          onChange={mudar("nascimento")}
        />
        <Campo
          rotulo="Telefone com DDD"
          ajuda="É por aqui que a convocação chega. Você pode corrigir depois, a qualquer momento."
          inputMode="tel"
          placeholder="(21) 90000-0000"
          value={mascaraTelefone(f.telefone)}
          erro={erros.telefone}
          onChange={mudar("telefone")}
        />
        <Campo
          rotulo="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={f.email}
          erro={erros.email}
          onChange={mudar("email")}
        />

        {falha && <Aviso tom="ruim">{falha}</Aviso>}

        <Botao tipo="submit" largura="cheia" desabilitado={enviando}>
          {enviando ? "Criando..." : "Criar acesso"}
        </Botao>

        <p className="text-center text-[13px]" style={{ color: "var(--text-2)" }}>
          Já tem acesso?{" "}
          <Link to="/entrar" style={{ color: "var(--ociosa)", textDecoration: "underline" }}>
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
