import matching from "../../public/data/matching_2025.json";
import funil from "../../public/data/funil.json";
import regua from "../../public/data/regua.json";
import cre from "../../public/data/cre.json";
import unidades from "../../public/data/unidades.json";

export type Matching = {
  ano: number; teto_turma: number; criancas_inscritas: number;
  vagas_planejadas: number; vagas_ociosas_fisicas: number;
  atual: { alocadas: number; por_opcao: Record<string, number>; ociosas: number };
  fila_unica: {
    alocadas: number; por_opcao: Record<string, number>; ociosas: number;
    realocadas_no_bairro: number; alocadas_com_fallback: number;
  };
  ganho_1a_opcao: number; ganho_criancas: number;
};
export type Funil = { ano: number; inscritas: number; matricularam: number; convocadas_e_perdidas: number; so_fila: number };
export type Regua = { ano: number; perg_id: number; pontos: number; pergunta_texto: string; declarou: number; validou: number; pct: number };
export type Cre = { cre: number; unidades: number; fila: number; matriculou: number; ociosas: number };
export type Unidade = {
  unidade: string; nome: string; fila: number; matriculou: number; perdeu: number;
  cre: number | null; microarea: string | null; bairro: string | null;
  lat: number | null; lng: number | null; tipo: string | null; turmas: number; ociosas: number;
};

export const M = matching as Matching;
export const FUNIL = funil as Funil[];
export const REGUA = regua as Regua[];
export const CRE = cre as Cre[];
export const UNIDADES = unidades as Unidade[];

export const nf = new Intl.NumberFormat("pt-BR");
export const fmt = (n: number) => nf.format(Math.round(n));

/** Nomes correntes das 11 Coordenadorias Regionais de Educacao. */
export const CRE_NOME: Record<number, string> = {
  1: "Centro / Sto. Cristo", 2: "Tijuca / Zona Sul", 3: "Ramos / Penha", 4: "Irajá / Vicente de Carvalho",
  5: "Madureira / Pavuna", 6: "Bangu / Realengo", 7: "Jacarepaguá / Barra", 8: "Campo Grande",
  9: "Santa Cruz / Sepetiba", 10: "Guaratiba / Paciência", 11: "Ilha do Governador",
};

import cenarios from "../../public/data/cenarios.json";
export type Cenario = {
  nome: string; alocadas: number; por_opcao: Record<string, number>; ociosas: number;
  realocadas_no_bairro: number; vulneraveis_atendidas: number; descricao: string;
};
export type Cenarios = {
  ano: number; teto_turma: number; vagas: number; criancas_inscritas: number;
  vulneraveis_inscritas: number; cenarios: Record<string, Cenario>;
};
export const C = cenarios as Cenarios;
export const ORDEM = ["atual", "fila_unica", "com_bairro", "regua_viva"] as const;
