/**
 * Roteador e layout (Dev B).
 *
 * As tres telas do Dev C (Vulnerabilidades, Documentos, MinhaInscricao) ja estao
 * integradas; o marcador `AguardandoDevC` que segurava as rotas foi apagado quando
 * a ultima delas chegou, como o proprio comentario original mandava.
 */
import { Link, Navigate, Route, BrowserRouter as Roteador, Routes } from "react-router-dom";
import { USANDO_MOCK } from "./api/client";
import { ProvedorSessao, RotaProtegida, useSessao } from "./auth";
import Cadastrar from "./telas/Cadastrar";
import DadosDaCrianca from "./telas/DadosDaCrianca";
import Entrar from "./telas/Entrar";
import EscolherUnidades from "./telas/EscolherUnidades";
import Documentos from "./telas/Documentos";
import Inscricoes from "./telas/Inscricoes";
import MinhaInscricao from "./telas/MinhaInscricao";
import Revisar from "./telas/Revisar";
import Vulnerabilidades from "./telas/Vulnerabilidades";

function Layout({ children }: { children: React.ReactNode }) {
  const { me, sair } = useSessao();
  return (
    <>
      {/* O banner e permanente e nao rola pra fora: ninguem digita CPF real aqui. */}
      <div
        className="px-4 py-2 text-center text-[12px] font-semibold"
        style={{ background: "var(--fila)", color: "#fff" }}
        role="note"
      >
        Ambiente de demonstração. Não use CPF ou dado pessoal de verdade.
        {USANDO_MOCK && " Dados servidos pelo mock local."}
      </div>

      {/* Barra institucional azul, como a do matricula.rio: é o elemento que a
          família reconhece antes de ler qualquer palavra da tela. */}
      <header style={{ background: "var(--marca-escura)", color: "var(--sobre-marca-escura)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2" style={{ color: "inherit" }}>
            <span className="text-[15px] font-semibold tracking-tight">Fila Única</span>
            <span className="hidden text-[12px] opacity-80 sm:inline">
              uma criança, uma fila, uma vaga
            </span>
          </Link>
          {me && (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-[14ch] truncate text-[12px] opacity-80 sm:inline">
                {me.responsavel.nome}
              </span>
              {/* Botão de cromo, não de formulário: o `Botao` do kit pinta com
                  --text-2, que sobre o azul institucional some. Mantém os 44px de
                  alvo de toque e o foco visível. */}
              <button
                type="button"
                onClick={sair}
                className="fu-sair"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main>{children}</main>
    </>
  );
}

function Inicio() {
  const { me, carregando } = useSessao();
  // Espera o /me responder antes de decidir. Sem isto, quem abre a URL com sessao
  // salva e jogado no login: no primeiro render `me` ainda e nulo porque a
  // confirmacao do token esta em voo.
  if (carregando) {
    return (
      <p className="p-6 text-sm" style={{ color: "var(--text-3)" }}>
        Carregando...
      </p>
    );
  }
  // Logada com inscrição: a lista. Logada sem nenhuma: direto para a primeira.
  if (!me) return <Navigate to="/entrar" replace />;
  return <Navigate to={me.inscricoes.length > 0 ? "/inscricoes" : "/inscricao/nova"} replace />;
}

export default function App() {
  return (
    <Roteador>
      <ProvedorSessao>
        <Layout>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/cadastrar" element={<Cadastrar />} />

            <Route path="/inscricoes" element={<RotaProtegida><Inscricoes /></RotaProtegida>} />
            <Route path="/inscricao/nova" element={<RotaProtegida><DadosDaCrianca /></RotaProtegida>} />
            <Route path="/inscricao/:id/unidades" element={<RotaProtegida><EscolherUnidades /></RotaProtegida>} />
            <Route
              path="/inscricao/:id/vulnerabilidades"
              element={<RotaProtegida><Vulnerabilidades /></RotaProtegida>}
            />
            <Route
              path="/inscricao/:id/documentos"
              element={<RotaProtegida><Documentos /></RotaProtegida>}
            />
            <Route path="/inscricao/:id/revisar" element={<RotaProtegida><Revisar /></RotaProtegida>} />
            <Route
              path="/inscricao/:id"
              element={<RotaProtegida><MinhaInscricao /></RotaProtegida>}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ProvedorSessao>
    </Roteador>
  );
}
