/**
 * Roteador e layout (Dev B).
 *
 * As telas do Dev C (Vulnerabilidades, Documentos, MinhaInscricao) entram por
 * `AguardandoDevC`, um marcador provisorio que vive AQUI, no arquivo do Dev B, para
 * nao criar arquivo na pasta de outra pessoa. Quando as telas dele chegarem, e trocar
 * o elemento da rota por um import e apagar o marcador.
 */
import { Link, Navigate, Route, BrowserRouter as Roteador, Routes, useParams } from "react-router-dom";
import { USANDO_MOCK } from "./api/client";
import { ProvedorSessao, RotaProtegida, useSessao } from "./auth";
import Cadastrar from "./telas/Cadastrar";
import DadosDaCrianca from "./telas/DadosDaCrianca";
import Entrar from "./telas/Entrar";
import EscolherUnidades from "./telas/EscolherUnidades";
import Revisar from "./telas/Revisar";
import Vulnerabilidades from "./telas/Vulnerabilidades";
import { Aviso, Botao } from "./telas/provisorio-ui";

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

/** Marcador das telas do Dev C. Provisorio, e some quando `src/ui/` chegar. */
function AguardandoDevC({ titulo, proxima }: { titulo: string; proxima?: string }) {
  const { id = "" } = useParams();
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <Aviso tom="neutro" titulo={titulo}>
        Esta tela é da trilha do Dev C e ainda não foi integrada. O fluxo do Dev B continua abaixo,
        para o percurso de demonstração rodar inteiro.
      </Aviso>
      {proxima && (
        <Link to={`/inscricao/${id}/${proxima}`}>
          <Botao largura="cheia" variante="secundario">Seguir para a próxima etapa</Botao>
        </Link>
      )}
    </div>
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
              element={<RotaProtegida><AguardandoDevC titulo="Documentos" proxima="revisar" /></RotaProtegida>}
            />
            <Route path="/inscricao/:id/revisar" element={<RotaProtegida><Revisar /></RotaProtegida>} />
            <Route
              path="/inscricao/:id"
              element={<RotaProtegida><AguardandoDevC titulo="Acompanhar a inscrição" /></RotaProtegida>}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </ProvedorSessao>
    </Roteador>
  );
}
