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
import MinhaInscricao from "./telas/MinhaInscricao";
import Revisar from "./telas/Revisar";
import Vulnerabilidades from "./telas/Vulnerabilidades";
import { Botao } from "./telas/provisorio-ui";

function Layout({ children }: { children: React.ReactNode }) {
  const { responsavel, sair } = useSessao();
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

      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">Fila Única</span>
            <span className="hidden text-[12px] sm:inline" style={{ color: "var(--text-3)" }}>
              uma criança, uma fila, uma vaga
            </span>
          </Link>
          {responsavel && (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-[14ch] truncate text-[12px] sm:inline" style={{ color: "var(--text-3)" }}>
                {responsavel.nome}
              </span>
              <Botao variante="fantasma" aoClicar={sair}>Sair</Botao>
            </div>
          )}
        </div>
      </header>

      <main>{children}</main>
    </>
  );
}

function Inicio() {
  const { responsavel } = useSessao();
  return <Navigate to={responsavel ? "/inscricao/nova" : "/entrar"} replace />;
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
