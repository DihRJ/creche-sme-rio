/**
 * Famílias de demonstração, a partir dos casos reais de auditoria.
 *
 * Serve para o pitch entrar por uma conta já preenchida em vez de digitar tudo ao
 * vivo, e para a tela de resultado ter conteúdo VERDADEIRO: nota de corte, número
 * de candidatos e a explicação que o Claude gerou sobre os números do motor
 * (`pipeline/06_explicar.py`), não texto inventado aqui.
 *
 * O que é real e o que é fictício:
 *   REAL     pontuação, nota de corte, candidatos, capacidade, ordem de preferência,
 *            unidade, e o texto da explicação
 *   FICTÍCIO nome e CPF da família. A base da SME é anonimizada — `aluno_0012265`
 *            não tem nome. Inventamos um para a tela não ficar com código na cara
 *            da pessoa.
 *
 * Idempotente: apaga as famílias de demonstração e recria.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { poolDireto, sqlDireto } from "./db.ts";
import { numeroDeSorteio } from "./sorteio.ts";
import { normalizar } from "./texto.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DADOS = join(AQUI, "..", "dados");
const ANO = 2026;
const QUANTAS = 10;

type Opcao = {
  posicao: number; unidade: string; grupamento: string; turno: string;
  capacidade: number; candidatos: number; nota_de_corte: number | null; conseguiu: boolean;
};
type Caso = {
  id: string; pontos: number; desempates: number;
  criterios_validados: { criterio: string; pontos: number }[];
  criterios_so_declarados: { criterio: string; pontos: number }[];
  opcoes: Opcao[];
  resultado_fila_unica: { conseguiu: boolean; unidade: string | null; opcao: number | null };
};

/** Nomes fictícios. A base é anonimizada; isto é só para a tela não mostrar código. */
const FAMILIAS: [string, string][] = [
  ["Vanessa Moreira da Silva", "Alice Moreira da Silva"],
  ["Juliana Aparecida Rocha", "Miguel Rocha Nascimento"],
  ["Patrícia Gomes dos Santos", "Helena Gomes dos Santos"],
  ["Rosângela Ferreira Lima", "Davi Ferreira Lima"],
  ["Simone Barbosa de Souza", "Sophia Barbosa de Souza"],
  ["Márcia Regina Alves", "Théo Alves Cardoso"],
  ["Cláudia Nogueira Pinto", "Manuela Nogueira Pinto"],
  ["Adriana Correia Muniz", "Bernardo Correia Muniz"],
  ["Fernanda Duarte Ramos", "Laura Duarte Ramos"],
  ["Tatiane Oliveira Pires", "Enzo Oliveira Pires"],
];

const GRUPAMENTO: Record<string, string> = {
  BERCARIO: "BERCARIO", "MATERNAL I": "MATERNAL I", "MATERNAL II": "MATERNAL II",
};

const ler = <T>(arq: string): T => JSON.parse(readFileSync(join(DADOS, arq), "utf8")) as T;

/** CPF fictício, determinístico e estável: a mesma demo dá sempre o mesmo login. */
const cpfDemo = (prefixo: number, i: number) => `${prefixo}${String(i).padStart(8, "0")}`;

export async function semearDemo(): Promise<{ cpf: string; nome: string; situacao: string }[]> {
  const casos = ler<{ casos: Caso[] }>("casos.json").casos;
  const explicacoes = ler<Record<string, string>>("explicacoes.json");
  const unidades = ler<{ unidade: string; nome: string; turmas: number | null }[]>("unidades.json");

  const codigoPorNome = new Map<string, string>();
  for (const u of unidades) {
    if ((u.turmas ?? 0) > 0) codigoPorNome.set(normalizar(u.nome), String(u.unidade).padStart(7, "0"));
  }

  const mapeavel = (c: Caso) =>
    c.opcoes.length > 0 &&
    c.id in explicacoes &&
    c.opcoes.every((o) => codigoPorNome.has(normalizar(o.unidade)));

  // Amostra deliberadamente enviesada para os casos que EXIGEM explicação: quem
  // declarou critério e não teve validado, e quem ficou sem vaga. Um painel só com
  // finais felizes não demonstra nada — a explicação existe justamente para a
  // conversa difícil.
  //
  // A cota de "sem vaga" é garantida, não deixada ao acaso: sem ela, ordenar por
  // "declarou e conseguiu" preenche as 10 vagas e o cenário mais importante do
  // RF4.3 desaparece da demonstração. Foi o que aconteceu na primeira versão.
  const aptos = casos.filter(mapeavel);
  const SEM_VAGA = 3;
  const semVaga = aptos.filter((c) => !c.resultado_fila_unica.conseguiu).slice(0, SEM_VAGA);
  const comVaga = [
    ...aptos.filter((c) => c.criterios_so_declarados.length > 0 && c.resultado_fila_unica.conseguiu),
    ...aptos.filter((c) => c.criterios_so_declarados.length === 0 && c.resultado_fila_unica.conseguiu),
  ].slice(0, QUANTAS - semVaga.length);
  // Intercalado, para quem abrir a lista não ver os três casos tristes no fim.
  const escolhidos: Caso[] = [];
  for (let i = 0; i < QUANTAS; i++) {
    const proximo = i % 3 === 2 ? semVaga.shift() ?? comVaga.shift() : comVaga.shift() ?? semVaga.shift();
    if (proximo) escolhidos.push(proximo);
  }

  const criterios = await sqlDireto<{ id: string; texto: string; pontos: number }>(
    `select id, texto, pontos from criterio where processo_ano = $1`,
    [ANO],
  );
  /** casos.json trunca o texto do critério em 110 caracteres; casamos por prefixo. */
  const acharCriterio = (texto: string) =>
    criterios.find((c) => normalizar(c.texto).startsWith(normalizar(texto).slice(0, 60)));

  // Limpa só as famílias de demonstração, pelo CPF reservado. Não toca em conta
  // criada por quem estiver testando.
  await sqlDireto(`delete from responsavel where cpf like '900%' or cpf like '910%'`);

  const [rodada] = await sqlDireto<{ id: string }>(
    `insert into rodada (processo_ano, numero, tipo) values ($1,1,'R1')
     on conflict (processo_ano, numero) do update set tipo = 'R1' returning id`,
    [ANO],
  );

  const contas: { cpf: string; nome: string; situacao: string }[] = [];

  for (const [i, caso] of escolhidos.entries()) {
    const [nomeResp, nomeCrianca] = FAMILIAS[i % FAMILIAS.length];
    const cpfResp = cpfDemo(900, i + 1);
    const cpfCrianca = cpfDemo(910, i + 1);
    const grupamento = GRUPAMENTO[normalizar(caso.opcoes[0].grupamento)] ?? "MATERNAL I";
    const turno = caso.opcoes[0].turno === "Parcial" ? "Parcial" : "Integral";

    const [resp] = await sqlDireto<{ id: string }>(
      `insert into responsavel (cpf, nome, nascimento) values ($1,$2,'1992-04-15') returning id`,
      [cpfResp, nomeResp],
    );
    await sqlDireto(
      `insert into contato (responsavel_id, canal, valor) values ($1,'telefone_principal',$2),($1,'email',$3)`,
      [resp.id, `2199${String(100000 + i * 7).slice(0, 6)}`, `familia${i + 1}@exemplo.org`],
    );
    const [crianca] = await sqlDireto<{ id: string }>(
      `insert into crianca (cpf, nome, nascimento, responsavel_id) values ($1,$2,'2024-05-20',$3) returning id`,
      [cpfCrianca, nomeCrianca, resp.id],
    );

    const alocada = caso.resultado_fila_unica.conseguiu;
    const [insc] = await sqlDireto<{ id: string }>(
      `insert into inscricao (processo_ano, crianca_id, grupamento, turno, situacao, enviada_em, numero_sorteio)
       values ($1,$2,$3,$4,$5, now() - interval '20 days', 'temp') returning id`,
      [ANO, crianca.id, grupamento, turno, alocada ? "classificada" : "nao_alocada"],
    );
    await sqlDireto(`update inscricao set numero_sorteio = $2 where id = $1`, [insc.id, numeroDeSorteio(insc.id)]);

    // opções e notas de corte, com os números reais do motor
    for (const o of caso.opcoes) {
      const codigo = codigoPorNome.get(normalizar(o.unidade))!;
      const [oferta] = await sqlDireto<{ id: string }>(
        `select id from oferta where unidade_codigo = $1 and grupamento = $2 and turno = $3`,
        [codigo, grupamento, turno],
      );
      if (!oferta) continue;
      await sqlDireto(
        `insert into opcao (inscricao_id, ordem, oferta_id) values ($1,$2,$3)
         on conflict do nothing`,
        [insc.id, o.posicao, oferta.id],
      );
      await sqlDireto(
        `insert into nota_corte (rodada_id, oferta_id, pontos, candidatos, capacidade, lotada)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (rodada_id, oferta_id) do update
           set pontos = excluded.pontos, candidatos = excluded.candidatos,
               capacidade = excluded.capacidade, lotada = excluded.lotada`,
        [rodada.id, oferta.id, o.nota_de_corte ?? 0, o.candidatos, o.capacidade, o.candidatos >= o.capacidade],
      );
      if (o.conseguiu) {
        await sqlDireto(
          `insert into alocacao (rodada_id, inscricao_id, oferta_id, posicao_preferencia, origem)
           values ($1,$2,$3,$4,'emparelhamento') on conflict (rodada_id, inscricao_id) do nothing`,
          [rodada.id, insc.id, oferta.id, o.posicao],
        );
      }
    }

    // critérios: validados pontuam, declarados sem validação não (RF2.4)
    for (const { criterio, situacao } of [
      ...caso.criterios_validados.map((c) => ({ criterio: c.criterio, situacao: "confirmado_base" })),
      ...caso.criterios_so_declarados.map((c) => ({ criterio: c.criterio, situacao: "nao_comprovado" })),
    ]) {
      const achado = acharCriterio(criterio);
      if (!achado) continue;
      await sqlDireto(
        `insert into resposta_criterio (inscricao_id, criterio_id, declarado, situacao)
         values ($1,$2,true,$3) on conflict (inscricao_id, criterio_id) do update set situacao = excluded.situacao`,
        [insc.id, achado.id, situacao],
      );
    }

    await sqlDireto(
      `insert into explicacao (rodada_id, inscricao_id, texto, origem) values ($1,$2,$3,'modelo')
       on conflict (rodada_id, inscricao_id) do update set texto = excluded.texto`,
      [rodada.id, insc.id, explicacoes[caso.id]],
    );

    contas.push({ cpf: cpfResp, nome: nomeResp, situacao: alocada ? `alocada na ${caso.resultado_fila_unica.opcao}ª opção` : "sem vaga" });
  }

  return contas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const contas = await semearDemo();
  console.log(`\n${contas.length} famílias de demonstração · senha: data de nascimento 1992-04-15\n`);
  for (const c of contas) console.log(`  ${c.cpf}  ${c.nome.padEnd(28)} ${c.situacao}`);
  await poolDireto.end();
}
