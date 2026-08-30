import "./stub";
import { chamar, token } from "../src/api/client";
import { ROTAS } from "../src/contracts.gen";
import type { Me, Responsavel, Sessao } from "../src/contracts.gen";

let falhas = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "  ok  " : " FALHA"} ${m}`); if (!c) falhas++; };

const s = await chamar<Sessao>(ROTAS.login, { corpo: { cpf: "90000000004", nascimento: "1992-04-15" } });
token.gravar(s.token);

const me = await chamar<Me>(ROTAS.me);
ok(!!me.responsavel.nome && me.responsavel.cpf.length === 11, `dados pessoais: ${me.responsavel.nome}`);
ok(me.responsavel.contatos.length >= 2, `${me.responsavel.contatos.length} contatos vindos do /me`);
ok(me.inscricoes.length > 0, `${me.inscricoes.length} inscrição(ões) para a lista compacta`);

const antes = me.responsavel.contatos.find((c) => c.canal === "telefone_principal")!;
const r = await chamar<Responsavel>(ROTAS.contatos, {
  metodo: "PUT", corpo: { contatos: [{ canal: "telefone_principal", valor: "21955554444" }] },
});
const depois = r.contatos.find((c) => c.canal === "telefone_principal")!;
ok(depois.valor === "21955554444", `telefone salvo: ${depois.valor}`);
ok(depois.versao === antes.versao + 1, `versão subiu ${antes.versao} -> ${depois.versao} (RF1.5)`);

const r2 = await chamar<Responsavel>(ROTAS.contatos, {
  metodo: "PUT", corpo: { contatos: [{ canal: "telefone_principal", valor: "21955554444" }] },
});
ok(r2.contatos.find((c) => c.canal === "telefone_principal")!.versao === depois.versao,
   "reenviar o mesmo valor não cria versão nova");

try {
  await chamar<Responsavel>(ROTAS.contatos, { metodo: "PUT", corpo: { contatos: [{ canal: "email", valor: "invalido" }] } });
  ok(false, "e-mail inválido devia falhar");
} catch { ok(true, "e-mail inválido recusado, e a tela mostra a mensagem"); }

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo ok");
