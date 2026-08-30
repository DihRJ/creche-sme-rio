/**
 * Smoke test do percurso do Dev B contra o mock, sem navegador.
 * Exercita exatamente o codigo que a tela usa: client.chamar -> mock.resolver.
 */
import { chamar, ErroDaApi, token } from "../src/api/client";
import { MAX_OPCOES, ROTAS } from "../src/contracts.gen";
import type { Inscricao, PaginaOfertas, Processo, Sessao } from "../src/contracts.gen";

let falhas = 0;
const ok = (c: boolean, msg: string) => {
  console.log(`${c ? "  ok  " : " FALHA"} ${msg}`);
  if (!c) falhas++;
};

async function esperaErro(fn: () => Promise<unknown>, codigo: string, msg: string) {
  try {
    await fn();
    ok(false, `${msg} (nao lancou)`);
  } catch (e) {
    ok(e instanceof ErroDaApi && e.codigo === codigo, `${msg} -> ${codigo}`);
  }
}

export async function rodar() {
  console.log("\n— processo e catalogo —");
  const proc = await chamar<Processo>(ROTAS.processo);
  ok(proc.ano === 2026 && proc.fases.length === 5, `processo ${proc.ano}, ${proc.fases.length} fases`);

  const pag1 = await chamar<PaginaOfertas>(`${ROTAS.ofertas}?grupamento=MATERNAL%20I&turno=Integral&pagina=1`);
  ok(pag1.itens.length === 12 && pag1.total > 100, `E6 paginado: ${pag1.itens.length} de ${pag1.total}`);
  ok(pag1.itens.every((o) => o.grupamento === "MATERNAL I" && o.turno === "Integral"), "E6 respeita grupamento e turno");
  ok(pag1.itens.every((o) => /^\d{7}$/.test(o.unidade.codigo)), "codigo de unidade com 7 digitos");
  ok(pag1.itens[0].historico[0].processo_ano === 2025, "historico rotulado como 2025");

  const busca = await chamar<PaginaOfertas>(`${ROTAS.ofertas}?busca=jacarepagu&grupamento=MATERNAL%20I&turno=Integral`);
  ok(busca.total > 0, `busca por bairro: ${busca.total} ofertas`);

  console.log("\n— cadastro e sessao —");
  await esperaErro(() => chamar(ROTAS.me), "NAO_AUTENTICADO", "E3 sem token");
  // CPF escolhido: o cruzamento deterministico CONFIRMA o CadUnico para ele.
  const CPF_CONFIRMA = "11122233300";
  const s = await chamar<Sessao>(ROTAS.cadastro, {
    corpo: { nome: "Vanessa Teste", cpf: CPF_CONFIRMA, nascimento: "1994-05-02",
             telefone: "21990001111", email: "v@exemplo.br" },
  });
  token.gravar(s.token);
  ok(s.responsavel.cpf === CPF_CONFIRMA && s.responsavel.contatos.length === 2, "E1 cadastro cria contatos");

  console.log("\n— inscricao —");
  const nova = await chamar<Inscricao>(ROTAS.inscricoes, {
    corpo: { crianca: { nome: "Ana Teste", cpf: "55566677788", nascimento: "2025-03-10" },
             grupamento: "MATERNAL I", turno: "Integral" },
  });
  ok(nova.situacao === "rascunho" && nova.opcoes.length === 0, "E7 cria rascunho vazio");
  ok(nova.respostas.length === 13, `E7 traz as 13 respostas de criterio`);

  await esperaErro(() => chamar(ROTAS.inscricoes, {
    corpo: { crianca: { nome: "Ana Teste", cpf: "555.666.777-88", nascimento: "2025-03-10" },
             grupamento: "MATERNAL I", turno: "Integral" },
  }), "CPF_JA_INSCRITO", "E7 barra segunda inscricao do mesmo CPF (RF1.1)");

  console.log("\n— opcoes (E9) —");
  const cinco = pag1.itens.slice(0, 5).map((o) => o.id);
  let insc = await chamar<Inscricao>(ROTAS.opcoes(nova.id), { metodo: "PUT", corpo: { oferta_ids: cinco } });
  ok(insc.opcoes.length === 5, "grava 5 opcoes");
  ok(insc.opcoes.map((o) => o.ordem).join() === "1,2,3,4,5", "ordem 1..5 contigua (INV2)");
  ok(insc.opcoes[0].oferta.id === cinco[0], "ordem do array = ordem de preferencia");

  await esperaErro(() => chamar(ROTAS.opcoes(nova.id), {
    metodo: "PUT", corpo: { oferta_ids: pag1.itens.slice(0, 6).map((o) => o.id) },
  }), "LIMITE_OPCOES", `barra mais de ${MAX_OPCOES} opcoes`);

  await esperaErro(() => chamar(ROTAS.opcoes(nova.id), {
    metodo: "PUT", corpo: { oferta_ids: [cinco[0], cinco[0]] },
  }), "VALIDACAO", "barra oferta repetida");

  const outroGrup = await chamar<PaginaOfertas>(`${ROTAS.ofertas}?grupamento=BERCARIO&turno=Integral`);
  await esperaErro(() => chamar(ROTAS.opcoes(nova.id), {
    metodo: "PUT", corpo: { oferta_ids: [outroGrup.itens[0].id] },
  }), "VALIDACAO", "barra oferta de outro grupamento");

  // reordenar: troca 1a com 2a, como as setas da tela fazem
  const trocado = [cinco[1], cinco[0], ...cinco.slice(2)];
  insc = await chamar<Inscricao>(ROTAS.opcoes(nova.id), { metodo: "PUT", corpo: { oferta_ids: trocado } });
  ok(insc.opcoes[0].oferta.id === cinco[1], "reordenacao pelas setas persiste");

  console.log("\n— criterios e pontuacao —");
  const criterios = await chamar<{ id: string; codigo: number; pontos: number }[]>(ROTAS.criterios);
  const cad = criterios.find((c) => c.codigo === 28)!;
  const semBase = criterios.find((c) => c.codigo !== 28 && c.codigo !== 6 && c.codigo !== 29)!;
  insc = await chamar<Inscricao>(ROTAS.criteriosDaInscricao(nova.id), {
    metodo: "PUT", corpo: { declarados: [cad.id, semBase.id] },
  });
  const rCad = insc.respostas.find((r) => r.criterio_id === cad.id)!;
  const rSem = insc.respostas.find((r) => r.criterio_id === semBase.id)!;
  ok(rCad.situacao === "confirmado_base" && rCad.pontos_que_contam === cad.pontos,
     `CadUnico (${cad.pontos} pts) confirmado pela base, sem documento (RF2.2)`);
  ok(rSem.situacao === "nao_comprovado" && rSem.pontos_que_contam === 0,
     "criterio sem documento nao pontua (RF2.4)");
  ok(insc.pontuacao.pontos_que_contam === cad.pontos,
     `pontos que contam = ${insc.pontuacao.pontos_que_contam} (so o que tem lastro)`);
  ok(insc.pontuacao.pontos_declarados > insc.pontuacao.pontos_que_contam,
     `declarados ${insc.pontuacao.pontos_declarados} > que contam ${insc.pontuacao.pontos_que_contam}`);
  // AGENTS.md: nao asserte em prosa do servidor, que muda quando alguem melhora a frase.
  // O que importa e existir pendencia e o numero fechar.
  ok(insc.pendencias.length > 0, `${insc.pendencias.length} pendencia(s) sinalizadas`);
  ok(insc.pontuacao.pontos_declarados - insc.pontuacao.pontos_que_contam === semBase.pontos,
     `pontos na mesa = ${insc.pontuacao.pontos_declarados - insc.pontuacao.pontos_que_contam}, igual ao criterio sem lastro`);

  console.log("\n— modo degradado do cruzamento (AD-13) —");
  // Segunda conta, com CPF que o cruzamento NAO confirma: o CadUnico tem que cair
  // para exigencia de documento, nunca para "nao pontua" sem saida para a familia.
  const s2 = await chamar<Sessao>(ROTAS.cadastro, {
    corpo: { nome: "Outra Responsavel", cpf: "11122233305", nascimento: "1990-01-01",
             telefone: "21990002222", email: "o@exemplo.br" },
  });
  token.gravar(s2.token);
  const i2 = await chamar<Inscricao>(ROTAS.inscricoes, {
    corpo: { crianca: { nome: "Bia Teste", cpf: "99988877766", nascimento: "2025-06-01" },
             grupamento: "MATERNAL I", turno: "Integral" },
  });
  const i2b = await chamar<Inscricao>(ROTAS.criteriosDaInscricao(i2.id), {
    metodo: "PUT", corpo: { declarados: [cad.id] },
  });
  const rCad2 = i2b.respostas.find((r) => r.criterio_id === cad.id)!;
  ok(rCad2.situacao === "nao_comprovado" && rCad2.pontos_se_valer === cad.pontos,
     `CPF que a base nao confirma cai para nao_comprovado, e os ${cad.pontos} pts seguem visiveis`);
  ok(i2b.pontuacao.pontos_declarados - i2b.pontuacao.pontos_que_contam === cad.pontos,
     `a familia perde exatamente os ${cad.pontos} pontos do CadUnico por falta de validacao`);

  token.gravar(s.token); // volta para a primeira conta

  console.log("\n— finalizar (E14) —");
  const fim = await chamar<Inscricao>(ROTAS.finalizar(nova.id), { metodo: "POST" });
  ok(fim.situacao === "enviada", "situacao vira enviada");
  ok(!!fim.numero_sorteio && fim.numero_sorteio.length === 8, `numero de sorteio: ${fim.numero_sorteio}`);
  ok(fim.pendencias.length > 0, "pendencia NAO bloqueou o envio (RF2.4)");
  await esperaErro(() => chamar(ROTAS.finalizar(nova.id), { metodo: "POST" }),
    "INSCRICAO_JA_ENVIADA", "nao finaliza duas vezes");
  await esperaErro(() => chamar(ROTAS.opcoes(nova.id), { metodo: "PUT", corpo: { oferta_ids: cinco } }),
    "INSCRICAO_JA_ENVIADA", "nao mexe nas opcoes depois de enviada (R1)");

  console.log(`\n${falhas === 0 ? "TODAS PASSARAM" : `${falhas} FALHA(S)`}`);
  return falhas;
}
