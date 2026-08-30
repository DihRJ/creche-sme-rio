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
import Conta from "./telas/Conta";
import DadosDaCrianca from "./telas/DadosDaCrianca";
import Entrar from "./telas/Entrar";
import EscolherUnidades from "./telas/EscolherUnidades";
import Documentos from "./telas/Documentos";
import Inscricoes from "./telas/Inscricoes";
import MinhaInscricao from "./telas/MinhaInscricao";
import Revisar from "./telas/Revisar";
import Vulnerabilidades from "./telas/Vulnerabilidades";
import { Botao } from "./telas/provisorio-ui";

/** Engrenagem do acesso a conta. SVG inline: o projeto nao tem sprite de icones. */
function Engrenagem() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.9 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2.05 2.05 0 1 1-2.9 2.9l-.06-.07a1.7 1.7 0 0 0-1.87-.33 1.7 1.7 0 0 0-1.03 1.55v.17a2.05 2.05 0 1 1-4.1 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2.05 2.05 0 1 1-2.9-2.9l.07-.06a1.7 1.7 0 0 0 .33-1.88 1.7 1.7 0 0 0-1.55-1.03h-.17a2.05 2.05 0 1 1 0-4.1h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2.05 2.05 0 1 1 2.9-2.9l.06.07a1.7 1.7 0 0 0 1.88.33h.08a1.7 1.7 0 0 0 1.03-1.55v-.17a2.05 2.05 0 1 1 4.1 0v.09a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06a2.05 2.05 0 1 1 2.9 2.9l-.07.06a1.7 1.7 0 0 0-.33 1.88v.08a1.7 1.7 0 0 0 1.55 1.03h.17a2.05 2.05 0 1 1 0 4.1h-.09a1.7 1.7 0 0 0-1.55 1.03Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">Fila Única</span>
            <span className="hidden text-[12px] sm:inline" style={{ color: "var(--text-3)" }}>
              uma criança, uma fila, uma vaga
            </span>
          </Link>
          {me && (
            <div className="flex items-center gap-2">
              {/* Nome + engrenagem sao UM alvo so, e a engrenagem aparece tambem no
                  celular: com o nome escondido em telas pequenas, sem ela nao haveria
                  como chegar em /conta pelo telefone — que e o acesso da maioria (RNF1).
                  O `aria-label` carrega o nome porque `hidden` some para leitor de tela. */}
              <Link
                to="/conta"
                aria-label={`Minha conta de ${me.responsavel.nome}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 text-[12px] transition hover:opacity-70"
                style={{ color: "var(--text-3)" }}
              >
                <span className="hidden max-w-[14ch] truncate sm:inline">{me.responsavel.nome}</span>
                <Engrenagem />
              </Link>
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

            <Route path="/conta" element={<RotaProtegida><Conta /></RotaProtegida>} />
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
