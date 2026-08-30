/**
 * Atalho de teste do Dev C — cole no console do navegador em http://localhost:5173
 *
 * As três telas do Dev C ficam atrás do login E de uma inscrição existente, então
 * testar uma mudança de CSS custaria refazer o fluxo do Dev B inteiro: cadastrar,
 * dados da criança, escolher 5 unidades. Isto faz esse caminho por baixo, pela
 * mesma API que as telas usam (`client.chamar`), e joga você direto na rota.
 *
 * Não entra no bundle: é ferramenta de desenvolvimento, como o `gerar-fixtures.mjs`.
 * Só funciona com o mock, que é o default do `npm run dev`.
 *
 * IDEMPOTENTE de propósito. O mock guarda as contas em `estado`, uma variável de
 * módulo, e só relê o localStorage quando o módulo carrega — limpar o storage com a
 * página já aberta não apaga a conta da memória, e a segunda execução morreria em
 * "Ja existe conta com este CPF". Então: tenta cadastrar, e se a conta já existir,
 * entra por E2 e reaproveita a inscrição que o /me devolver.
 *
 * Rotas aceitas em `rota`:
 *   "vulnerabilidades"  -> pronta
 *   "documentos"        -> ainda o marcador do Dev B
 *   ""                  -> MinhaInscricao, ainda o marcador do Dev B
 *
 * Uso:
 *   atalhoDevC()                                        // caso do pitch
 *   atalhoDevC({ cpf: "11122233300" })                  // CadÚnico confirmado pela base
 *   atalhoDevC({ rota: "documentos" })
 */
globalThis.atalhoDevC = async ({ cpf = "11122233305", rota = "vulnerabilidades" } = {}) => {
  const { chamar, token } = await import("/src/api/client.ts");
  const { ROTAS } = await import("/src/contracts.gen.ts");

  const NASCIMENTO = "1994-05-02";
  const dados = {
    nome: "Vanessa Teste",
    cpf,
    nascimento: NASCIMENTO,
    telefone: "21990001111",
    email: "vanessa@exemplo.br",
  };

  let sessao;
  try {
    sessao = await chamar(ROTAS.cadastro, { corpo: dados });
  } catch {
    sessao = await chamar(ROTAS.login, { corpo: { cpf, nascimento: NASCIMENTO } });
  }
  token.gravar(sessao.token);

  // Reaproveita a inscrição desta conta, se houver: o mock barra duas inscrições
  // para o mesmo CPF de criança (RF1.1), então criar de novo estouraria.
  const me = await chamar(ROTAS.me);
  let id = me.inscricoes[0]?.id;

  if (!id) {
    const inscricao = await chamar(ROTAS.inscricoes, {
      corpo: {
        crianca: { nome: "Ana Teste", cpf: "55566677788", nascimento: "2025-03-10" },
        grupamento: "MATERNAL I",
        turno: "Integral",
      },
    });
    id = inscricao.id;

    // 5 opções, senão a Revisar reclama e a MinhaInscricao fica sem o que mostrar.
    const pagina = await chamar(`${ROTAS.ofertas}?grupamento=MATERNAL%20I&turno=Integral`);
    await chamar(ROTAS.opcoes(id), {
      metodo: "PUT",
      corpo: { oferta_ids: pagina.itens.slice(0, 5).map((o) => o.id) },
    });
  }

  console.log(`inscrição ${id} pronta — CPF ${cpf}`);
  location.href = `/inscricao/${id}${rota ? `/${rota}` : ""}`;
};

atalhoDevC();
