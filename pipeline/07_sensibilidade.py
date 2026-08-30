"""Sensibilidade do ganho a taxa de aceite da Fase 3 (vaga remanescente no bairro).

Por que este script existe
--------------------------
O cenario `regua_viva`, que sustenta a manchete de +4.595 criancas, aloca 3.020
criancas em vaga ociosa de uma creche que a familia NAO escolheu. O `04_cenarios.py`
trata isso como alocacao: a criança entra e ponto.

O AD-8 do PLANO define a mesma coisa de outro jeito, e o certo e o dele: a oferta
remanescente e "um convite, nao uma alocacao", e recusar nao custa posicao em fila
nenhuma. Ou seja, o contrafactual assume 100% de aceite de uma vaga longe de casa,
e o proprio gatilho de revisao do AD-8 fala em "se a taxa de aceite vier acima de
~80%", o que revela que 100% nao e a expectativa dos autores.

Este script nao corrige o motor. Ele mede o quanto a manchete depende dessa premissa,
que e o que faltava estar escrito.

Nao precisa das bases: le o proprio `cenarios.json` que o painel publica, porque
`realocadas_no_bairro` ja vem separado do emparelhamento.

  python3 pipeline/07_sensibilidade.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = ROOT / "app" / "public" / "data" / "cenarios.json"
SAIDA = ROOT / "app" / "public" / "data" / "sensibilidade.json"

d = json.loads(ENTRADA.read_text(encoding="utf-8"))
VAGAS = d["vagas"]
atual = d["cenarios"]["atual"]
alvo = d["cenarios"]["regua_viva"]

BASE = atual["alocadas"]
BASE_VULN = atual["vulneraveis_atendidas"]
BASE_OCIOSAS = atual["ociosas"]

# O ganho se decompoe em duas partes de natureza diferente:
#   - emparelhamento: a criança entra numa creche que ELA escolheu. Nao depende de aceite.
#   - fase 3: a criança recebe convite para uma creche que ela NAO escolheu. Depende.
FASE3 = alvo["realocadas_no_bairro"]
EMPARELHAMENTO = alvo["alocadas"] - FASE3

TAXAS = [1.00, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.20, 0.00]


def n(v: float, sinal: bool = False) -> str:
    """Milhar com ponto, como se escreve em portugues."""
    return f"{v:{'+' if sinal else ''},.0f}".replace(",", ".")


def modelo_a(taxa: float) -> int:
    """Pessimista: cada vaga e oferecida UMA vez. Recusa deixa a vaga vazia."""
    return round(EMPARELHAMENTO + taxa * FASE3)


def modelo_b(taxa: float, candidatos: int) -> int:
    """
    Com reoferta, que e o que o AD-8 manda fazer: a recusa devolve a vaga ao conjunto
    de remanescentes na hora. A vaga so fica vazia se TODOS os candidatos elegiveis
    daquele bairro e grupamento recusarem.

    `candidatos` = quantas criancas nao alocadas disputam cada vaga remanescente no
    mesmo bairro e grupamento. Nao sai do cenarios.json: exige rodar o pipeline sobre
    as bases. Por isso aqui entra como parametro, nao como resultado.
    """
    preenchida = 1 - (1 - taxa) ** candidatos
    return round(EMPARELHAMENTO + preenchida * FASE3)


print(f"""
Decomposicao do ganho de {n(alvo['alocadas'] - BASE, True)} criancas (cenario `regua_viva`)

  emparelhamento estavel   {n(EMPARELHAMENTO - BASE, True):>6}   creche que a familia escolheu, nao depende de aceite
  fase 3 (vaga no bairro)  {n(FASE3, True):>6}   creche que a familia NAO escolheu, depende de aceite
  {'-' * 66}
  total                    {n(alvo['alocadas'] - BASE, True):>6}   = {100 * FASE3 / (alvo['alocadas'] - BASE):.0f}% do ganho vem da fase 3
""")

print("MODELO A - oferta unica, recusa perde a vaga (piso)\n")
print(f"{'aceite':>7} {'na creche':>10} {'ganho':>8} {'ociosas':>9} {'reducao':>9}")
linhas = []
for t in TAXAS:
    a = modelo_a(t)
    ociosas = VAGAS - a
    red = 100 * (1 - ociosas / BASE_OCIOSAS)
    print(f"{t:>6.0%} {n(a):>10} {n(a - BASE, True):>8} {n(ociosas):>9} {red:>8.0f}%")
    linhas.append({"taxa_aceite": t, "alocadas": a, "ganho": a - BASE,
                   "ociosas": ociosas, "reducao_ociosas_pct": round(red, 1)})

alvo_prd = 4000
taxa_minima = (alvo_prd - (EMPARELHAMENTO - BASE)) / FASE3
print(f"""
A meta de ano 1 do PRD e +{n(alvo_prd)} criancas. Pelo modelo A ela exige aceite de
{taxa_minima:.0%} — que e exatamente o limiar do gatilho de revisao do AD-8.
""")

print("MODELO B - com reoferta (AD-8), por candidatos elegiveis por vaga\n")
CANDS = [1, 2, 3, 5]
print(f"{'aceite':>7}" + "".join(f"{f'k={k}':>12}" for k in CANDS))
grade = []
for t in [0.80, 0.60, 0.40, 0.20]:
    cel = [modelo_b(t, k) - BASE for k in CANDS]
    print(f"{t:>6.0%}" + "".join(f"{n(c, True):>12}" for c in cel))
    grade.append({"taxa_aceite": t, "ganho_por_candidatos": dict(zip(map(str, CANDS), cel))})

print(f"""
Leitura: com reoferta, o ganho volta rapido para perto do numero publicado. Com
aceite de 60% e 3 candidatos por vaga, ja sao {n(modelo_b(0.6, 3) - BASE, True)} criancas.
O que o projeto NAO pode dizer e "{n(alvo['alocadas'] - BASE, True)}" sem declarar a premissa.
""")

# --- vulneraveis: da para limitar, nao para cravar ---
VULN = alvo["vulneraveis_atendidas"]
vuln_piso = VULN - FASE3   # se TODAS as vagas da fase 3 tiverem ido para vulneravel
vuln_teto = VULN           # se NENHUMA tiver ido
print(f"""CRIANCAS VULNERAVEIS: so da para limitar

O cenarios.json nao separa quantas das {n(FASE3)} realocacoes foram de criança
vulneravel, entao o ganho de {n(VULN - BASE_VULN, True)} com aceite de 100% cai, com aceite
zero, para algo entre {n(vuln_piso - BASE_VULN, True)} e {n(vuln_teto - BASE_VULN, True)}.

A faixa e larga e o valor real fica perto do PISO, porque o fallback do
`04_cenarios.py` percorre os nao alocados JA ORDENADOS por prioridade, e no cenario
`regua_viva` a prioridade e a pontuacao declarada — onde CadUnico e Bolsa Familia
pesam 51 e 21 pontos. Ou seja, a fase 3 atende preferencialmente vulneravel, e por
isso o numero de vulneraveis e o MAIS exposto a taxa de aceite, nao o menos.

Fechar essa faixa exige rodar o pipeline sobre as bases, marcando `vuln` na
realocacao. E uma linha em `04_cenarios.py` e depende de ter o `dados/` em maquina.
""")

SAIDA.write_text(json.dumps({
    "base": {"alocadas": BASE, "vulneraveis": BASE_VULN, "ociosas": BASE_OCIOSAS, "vagas": VAGAS},
    "decomposicao": {"emparelhamento": EMPARELHAMENTO - BASE, "fase_3": FASE3,
                     "total": alvo["alocadas"] - BASE},
    "modelo_a_oferta_unica": linhas,
    "modelo_b_com_reoferta": grade,
    "taxa_minima_para_meta_prd": round(taxa_minima, 3),
    "vulneraveis": {"ganho_com_aceite_total": VULN - BASE_VULN,
                    "faixa_com_aceite_zero": [vuln_piso - BASE_VULN, vuln_teto - BASE_VULN],
                    "nota": "faixa larga; valor real perto do piso porque o fallback ordena por prioridade"},
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"escrito: {SAIDA.relative_to(ROOT)}")
