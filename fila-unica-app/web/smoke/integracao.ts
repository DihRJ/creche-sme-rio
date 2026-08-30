/**
 * Integração real: o cliente do web contra a API do Dev A, sem navegador.
 *
 * Diferente do `percurso.ts`, que roda contra o mock. Aqui o objetivo é achar
 * divergência de contrato cedo, que é o que mata integração às 3h50.
 *
 *   VITE_USAR_MOCK=false VITE_API_URL=http://localhost:3001/api npm run integracao
 *
 * CPFs são sorteados por execução: o banco é o de verdade e guarda o que criamos.
 */
import { ErroDaApi, chamar, token } from "../src/api/client";
import { ROTAS } from "../src/contracts.gen";
import type {
  Criterio, Inscricao, Me, PaginaOfertas, Processo, Saude, Sessao,
} from "../src/contracts.gen";

let falhas = 0;
let pendentes = 0;

const ok = (c: boolean, msg: string) => {
  console.log(`${c ? "  ok  " : " FALHA"} ${msg}`);
  if (!c) falhas++;
};

/** Endpoint que o contrato prevê mas o servidor ainda não expõe. Não é falha do web. */
const naoEntregue = (msg: string) => {
  console.log(`  ---  ${msg}`);
  pendentes++;
};

const cpf = (semente: number) => String(10000000000 + (Date.now() % 800000000) + semente);

async function main() {
  console.log("\n— o que a API entrega (E17, E4, E5, E6) —");

  const saude = await chamar<Saude>(ROTAS.saude);
  ok(saude.ok === true && saude.banco === "ok", `E17 saúde: banco=${saude.banco} versão=${saude.versao}`);

  const proc = await chamar<Processo>(ROTAS.processo);
  ok(proc.ano > 2000 && Array.isArray(proc.fases), `E4 processo ${proc.ano}, ${proc.fases.length} fases`);
  ok(proc.fases.every((f) => f.inicio && f.fim && f.situacao),
     "E4 toda fase tem início, fim e situação (a linha do tempo do Dev C depende)");
  ok(proc.max_opcoes === 5, `E4 max_opcoes = ${proc.max_opcoes}`);

  const criterios = await chamar<Criterio[]>(ROTAS.criterios);
  ok(criterios.length === 13, `E5 ${criterios.length} critérios`);
  const soma = criterios.reduce((s, c) => s + c.pontos, 0);
  ok(soma === 100, `E5 a régua soma ${soma} pontos`);
  const cad = criterios.find((c) => c.codigo === 28);
  ok(!!cad && cad.pontos === 51, `E5 CadÚnico (código 28) vale ${cad?.pontos} pontos`);

  const pag = await chamar<PaginaOfertas>(
    `${ROTAS.ofertas}?grupamento=MATERNAL%20I&turno=Integral&pagina=1`);
  ok(pag.itens.length > 0 && pag.total > pag.itens.length,
     `E6 paginado: ${pag.itens.length} de ${pag.total}`);
  ok(pag.itens.every((o) => /^\d{7}$/.test(o.unidade.codigo)),
     "E6 código de unidade é string de 7 dígitos (a armadilha nº 1 do Dev A)");
  ok(pag.itens.every((o) => o.grupamento === "MATERNAL I" && o.turno === "Integral"),
     "E6 respeita o filtro de grupamento e turno");
  ok(pag.itens.every((o) => Array.isArray(o.historico)),
     "E6 toda oferta traz `historico`, mesmo vazio (o cartão da tela depende)");
  const comHist = pag.itens.filter((o) => o.historico.length > 0);
  ok(comHist.length > 0, `E6 ${comHist.length} de ${pag.itens.length} ofertas com histórico preenchido`);
  ok(comHist.every((o) => o.historico[0].processo_ano === 2025),
     "E6 histórico rotulado como processo 2025");

  const busca = await chamar<PaginaOfertas>(
    `${ROTAS.ofertas}?busca=bangu&grupamento=MATERNAL%20I&turno=Integral`);
  ok(busca.total > 0, `E6 busca por bairro devolve ${busca.total} ofertas`);

  console.log("\n— sessão (E1, E2, E3) —");
  const cpfResp = cpf(1);
  const s = await chamar<Sessao>(ROTAS.cadastro, {
    corpo: { nome: "Teste Integração", cpf: cpfResp, nascimento: "1992-04-15",
             telefone: "21988887777", email: `t${cpfResp}@exemplo.br` },
  });
  ok(!!s.token && s.responsavel.cpf.replace(/\D/g, "") === cpfResp, "E1 cadastro devolve token e responsável");
  ok(s.responsavel.contatos.length >= 1, `E1 gravou ${s.responsavel.contatos.length} contato(s)`);
  token.gravar(s.token);

  const me = await chamar<Me>(ROTAS.me);
  ok(me.responsavel.cpf.replace(/\D/g, "") === cpfResp, "E3 /me responde com o token do cadastro");

  const s2 = await chamar<Sessao>(ROTAS.login, { corpo: { cpf: cpfResp, nascimento: "1992-04-15" } });
  ok(!!s2.token, "E2 login sem senha, por CPF + nascimento");
  token.gravar(s2.token);

  console.log("\n— inscrição (E7, E8) —");
  const cpfCrianca = cpf(2);
  const nova = await chamar<Inscricao>(ROTAS.inscricoes, {
    corpo: { crianca: { nome: "Criança Integração", cpf: cpfCrianca, nascimento: "2025-02-20" },
             grupamento: "MATERNAL I", turno: "Integral" },
  });
  ok(nova.situacao === "rascunho", `E7 cria rascunho (situação: ${nova.situacao})`);
  ok(Array.isArray(nova.opcoes) && nova.opcoes.length === 0, "E7 rascunho nasce sem opções");
  ok(Array.isArray(nova.respostas), `E7 devolve ${nova.respostas.length} respostas de critério`);
  ok(!!nova.pontuacao && typeof nova.pontuacao.pontos_que_contam === "number",
     "E7 devolve o bloco `pontuacao` (a tela Revisar depende)");
  ok(Array.isArray(nova.pendencias), "E7 devolve `pendencias`");

  const lida = await chamar<Inscricao>(ROTAS.inscricao(nova.id));
  ok(lida.id === nova.id, "E8 lê a inscrição criada");

  try {
    await chamar(ROTAS.inscricoes, {
      corpo: { crianca: { nome: "Criança Integração", cpf: cpfCrianca, nascimento: "2025-02-20" },
               grupamento: "MATERNAL I", turno: "Integral" },
    });
    ok(false, "E7 deveria barrar CPF já inscrito (RF1.1)");
  } catch (e) {
    ok(e instanceof ErroDaApi && e.codigo === "CPF_JA_INSCRITO",
       `E7 barra CPF já inscrito -> ${e instanceof ErroDaApi ? e.codigo : "?"}`);
  }

  console.log("\n— opções, critérios e finalização (E9, E10, E14) —");
  const ids = pag.itens.slice(0, 3).map((o) => o.id);
  try {
    const comOpcoes = await chamar<Inscricao>(ROTAS.opcoes(nova.id), {
      metodo: "PUT", corpo: { oferta_ids: ids },
    });
    ok(comOpcoes.opcoes.length === 3 && comOpcoes.opcoes[0].oferta.id === ids[0],
       "E9 grava as opções na ordem do array");
  } catch (e) {
    const c = e instanceof ErroDaApi ? e.codigo : "?";
    if (c === "NAO_ENCONTRADO") naoEntregue("E9 PUT /inscricoes/:id/opcoes — não implementado (EscolherUnidades depende)");
    else ok(false, `E9 falhou com ${c}: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const comCriterios = await chamar<Inscricao>(ROTAS.criteriosDaInscricao(nova.id), {
      metodo: "PUT", corpo: { declarados: cad ? [cad.id] : [] },
    });
    ok(comCriterios.respostas.some((r) => r.declarado),
       "E10 grava os critérios declarados e devolve a Inscricao inteira");
  } catch (e) {
    const c = e instanceof ErroDaApi ? e.codigo : "?";
    if (c === "NAO_ENCONTRADO") naoEntregue("E10 PUT /inscricoes/:id/criterios — não implementado");
    else ok(false, `E10 falhou com ${c}`);
  }

  // E14 vem por ULTIMO de propósito: finalizar congela a inscrição, e qualquer E9 ou
  // E10 depois disso é recusado com INSCRICAO_JA_ENVIADA. Isso é o comportamento
  // correto pela regra R1 — na ordem trocada, parecia falha da API.
  try {
    const fim = await chamar<Inscricao>(ROTAS.finalizar(nova.id), { metodo: "POST" });
    ok(!!fim.numero_sorteio, `E14 finaliza e devolve número de sorteio ${fim.numero_sorteio}`);
    ok(fim.situacao !== "rascunho", `E14 muda a situação para "${fim.situacao}"`);
  } catch (e) {
    const c = e instanceof ErroDaApi ? e.codigo : "?";
    if (c === "NAO_ENCONTRADO") naoEntregue("E14 POST /inscricoes/:id/finalizar — não implementado (Revisar depende)");
    else ok(false, `E14 falhou com ${c}: ${e instanceof Error ? e.message : e}`);
  }

  console.log(
    `\n${falhas === 0 ? "SEM DIVERGENCIA DE CONTRATO" : `${falhas} DIVERGENCIA(S)`}` +
    `${pendentes > 0 ? ` · ${pendentes} endpoint(s) do contrato ainda não implementado(s)` : ""}`,
  );
  return falhas;
}

export { main as rodar };
