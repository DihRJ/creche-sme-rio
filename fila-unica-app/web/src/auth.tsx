/**
 * Sessao da familia. Token em localStorage: e demo, e o servidor assina JWT curto.
 * Login sem senha, por CPF + data de nascimento, como o E2 do contrato define.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { CorpoCadastro, CorpoLogin, Responsavel, Sessao } from "./contracts.gen";
import { ROTAS } from "./contracts.gen";
import { chamar, token } from "./api/client";

type Contexto = {
  responsavel: Responsavel | null;
  carregando: boolean;
  entrar: (c: CorpoLogin) => Promise<void>;
  cadastrar: (c: CorpoCadastro) => Promise<void>;
  sair: () => void;
};

const Ctx = createContext<Contexto | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [responsavel, setResponsavel] = useState<Responsavel | null>(null);
  // Ja nasce com o valor certo: sem token nao ha o que carregar.
  const [carregando, setCarregando] = useState(() => !!token.ler());

  // Ha token guardado? Confirma com o servidor antes de dar a sessao por valida.
  useEffect(() => {
    if (!token.ler()) return;
    let vivo = true;
    chamar<{ responsavel: Responsavel }>(ROTAS.me)
      .then((me) => vivo && setResponsavel(me.responsavel))
      .catch(() => token.limpar())
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const aplicar = useCallback((s: Sessao) => {
    token.gravar(s.token);
    setResponsavel(s.responsavel);
  }, []);

  const valor = useMemo<Contexto>(
    () => ({
      responsavel,
      carregando,
      entrar: async (c) => aplicar(await chamar<Sessao>(ROTAS.login, { corpo: c })),
      cadastrar: async (c) => aplicar(await chamar<Sessao>(ROTAS.cadastro, { corpo: c })),
      sair: () => {
        token.limpar();
        setResponsavel(null);
      },
    }),
    [responsavel, carregando, aplicar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSessao(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora do ProvedorSessao");
  return c;
}

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { responsavel, carregando } = useSessao();
  const local = useLocation();
  if (carregando) {
    return (
      <p className="p-6 text-sm" style={{ color: "var(--text-3)" }}>
        Carregando...
      </p>
    );
  }
  // Guarda de onde a familia veio, pra devolver ela pro mesmo lugar depois de entrar.
  if (!responsavel) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  return <>{children}</>;
}
