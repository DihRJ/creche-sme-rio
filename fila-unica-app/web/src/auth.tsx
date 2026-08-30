/**
 * Sessao da familia. Token em localStorage: e demo, e o servidor assina JWT curto.
 * Login sem senha, por CPF + data de nascimento, como o E2 do contrato define.
 *
 * O contexto guarda o `Me` INTEIRO, nao so o responsavel. A versao anterior tipava a
 * resposta como `{ responsavel }` e descartava `criancas` e `inscricoes` no `.then`,
 * o que fazia a familia com inscricao em andamento cair em "cadastrar nova crianca"
 * depois do login e bater em CPF_JA_INSCRITO sem entender. Era o G4 do PRD voltando
 * por outra porta.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { CorpoCadastro, CorpoLogin, Me, Sessao } from "./contracts.gen";
import { ROTAS } from "./contracts.gen";
import { chamar, token } from "./api/client";

type Contexto = {
  /** Nulo quando nao ha sessao valida. */
  me: Me | null;
  carregando: boolean;
  /** Devolve o `Me` para quem chamou decidir o destino sem esperar re-render. */
  entrar: (c: CorpoLogin) => Promise<Me>;
  cadastrar: (c: CorpoCadastro) => Promise<Me>;
  /** Rebusca o `/me`. A lista de inscricoes muda quando uma e criada ou enviada. */
  recarregar: () => Promise<Me | null>;
  sair: () => void;
};

const Ctx = createContext<Contexto | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  // Ja nasce com o valor certo: sem token nao ha o que carregar.
  const [carregando, setCarregando] = useState(() => !!token.ler());

  // Ha token guardado? Confirma com o servidor antes de dar a sessao por valida.
  useEffect(() => {
    if (!token.ler()) return;
    let vivo = true;
    chamar<Me>(ROTAS.me)
      .then((m) => vivo && setMe(m))
      .catch(() => token.limpar())
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const buscarMe = useCallback(async () => {
    const m = await chamar<Me>(ROTAS.me);
    setMe(m);
    return m;
  }, []);

  const autenticar = useCallback(
    async (rota: string, corpo: CorpoLogin | CorpoCadastro) => {
      const s = await chamar<Sessao>(rota, { corpo });
      token.gravar(s.token);
      // O `Sessao` só traz o responsável; a lista de inscrições vem do /me.
      return buscarMe();
    },
    [buscarMe],
  );

  const valor = useMemo<Contexto>(
    () => ({
      me,
      carregando,
      entrar: (c) => autenticar(ROTAS.login, c),
      cadastrar: (c) => autenticar(ROTAS.cadastro, c),
      recarregar: async () => (token.ler() ? buscarMe() : null),
      sair: () => {
        token.limpar();
        setMe(null);
      },
    }),
    [me, carregando, autenticar, buscarMe],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora do ProvedorSessao");
  return c;
}

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { me, carregando } = useSessao();
  const local = useLocation();
  if (carregando) {
    return (
      <p className="p-6 text-sm" style={{ color: "var(--text-3)" }}>
        Carregando...
      </p>
    );
  }
  // Guarda de onde a familia veio, pra devolver ela pro mesmo lugar depois de entrar.
  if (!me) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  return <>{children}</>;
}
