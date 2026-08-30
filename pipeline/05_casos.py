"""Gera casos de auditoria: para cada crianca, a prova de por que ela ficou onde ficou.

A saida e o insumo que o explicador do painel entrega ao Claude. Nenhum dado pessoal:
a base ja vem anonimizada e aqui so trafegam codigo anonimo, pontuacao e regua.
"""
import duckdb, pathlib, json, random
import pandas as pd
from collections import defaultdict

ANO, TETO, N_CASOS = 2025, 25, 60
ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / "dados" / "Bases IC_ ClassificadoseFila"; O = ROOT / "dados" / "OferecimentosEvagas"
OUT = ROOT / "app" / "public" / "data"

con = duckdb.connect()
for n, f in [("qa", "01_QueryA_InscricoesPorAno.csv.gz"), ("qb", "02_QueryB_RespostasSocioEconomicas.csv.gz"),
             ("qc", "03_QueryC_PerguntasComDescricao.csv")]:
    con.sql(f"create view {n} as select * from read_csv('{D}/{f}', delim=';', header=true, encoding='utf-8')")

con.sql(f"""create table score as select b.prm_id, b.plm_id, b.ipl_id,
   sum(case when b.resposta='Sim' and b.confirmado='Sim' then c.perg_pontuacao else 0 end) pontos,
   sum(case when b.resposta='Sim' then c.perg_pontuacao else 0 end) pontos_decl,
   sum(case when b.resposta='Sim' and b.confirmado='Sim' and c.perg_criterio='Sim' then 1 else 0 end) des
 from qb b join qc c on b.ano=c.ano and b.ich_perg_id=c.ich_perg_id where b.ano={ANO} group by 1,2,3""")

con.sql(f"""create table opt as select a.aluno_anon, a.opcao, a.nome_unidade,
   a.unidade||'|'||upper(strip_accents(trim(a.grupamento)))||'|'||a.horario vaga_id,
   upper(strip_accents(trim(a.grupamento))) grup, a.horario,
   upper(strip_accents(trim(coalesce(a.bairro,'')))) bairro, a.situacao, a.data_criacao,
   coalesce(s.pontos,0) pts, coalesce(s.pontos_decl,0) pts_decl, coalesce(s.des,0) des
 from qa a left join score s using (prm_id, plm_id, ipl_id) where a.ano={ANO}""")

# criterios declarados e validados, por crianca (para o texto da explicacao)
crit = defaultdict(lambda: {"declarados": [], "validados": []})
for al, txt, pontos, conf in con.sql(f"""
  select o.aluno_anon, c.pergunta_texto, c.perg_pontuacao, b.confirmado
  from qb b
  join qc c on b.ano=c.ano and b.ich_perg_id=c.ich_perg_id
  join (select distinct aluno_anon, prm_id, plm_id, ipl_id from qa where ano={ANO}) o
    on o.prm_id=b.prm_id and o.plm_id=b.plm_id and o.ipl_id=b.ipl_id
  where b.ano={ANO} and b.resposta='Sim'""").fetchall():
    k = "validados" if conf == "Sim" else "declarados"
    crit[al][k].append({"criterio": txt[:110], "pontos": int(pontos)})

pub = pd.read_excel(O / "totaalunoscreche2025.xlsx", sheet_name="Consolidado", header=None, skiprows=2)
pub.columns = ["cre","designacao","denominacao","ber_int_al","ber_int_tur","ber_par_al","ber_par_tur",
 "m1_int_al","m1_int_tur","m1_par_al","m1_par_tur","m2_int_al","m2_int_tur","m2_par_al","m2_par_tur",
 "tot_int_al","tot_int_tur","tot_par_al","tot_par_tur"]
pub = pub[pub["designacao"].notna()].copy()
pub["designacao"] = pub["designacao"].astype(str).str.strip().str.zfill(7)
COLS = {("BERCARIO","Integral"):("ber_int_tur","ber_int_al"), ("BERCARIO","Parcial"):("ber_par_tur","ber_par_al"),
        ("MATERNAL I","Integral"):("m1_int_tur","m1_int_al"), ("MATERNAL I","Parcial"):("m1_par_tur","m1_par_al"),
        ("MATERNAL II","Integral"):("m2_int_tur","m2_int_al"), ("MATERNAL II","Parcial"):("m2_par_tur","m2_par_al")}
ocioso = {}
for _, r in pub.iterrows():
    for (g, h), (ct, ca) in COLS.items():
        t = pd.to_numeric(r[ct], errors="coerce"); al_ = pd.to_numeric(r[ca], errors="coerce")
        if pd.notna(t) and t > 0:
            s = int(t) * TETO - int(al_ if pd.notna(al_) else 0)
            if s > 0: ocioso[f"{r['designacao']}|{g}|{h}"] = s
ocupado = {r[0]: int(r[1]) for r in con.sql(
    "select vaga_id, count(distinct aluno_anon) from opt where situacao='Confirmado' group by 1").fetchall()}
CAP = {v: ocupado.get(v, 0) + ocioso.get(v, 0)
       for v in {r[0] for r in con.sql("select distinct vaga_id from opt").fetchall()}
       if ocupado.get(v, 0) + ocioso.get(v, 0) > 0}

rows = con.sql("""select aluno_anon, opcao, vaga_id, nome_unidade, pts, des, data_criacao, situacao
                  from opt order by aluno_anon, opcao""").fetchall()
prefs, nomes, meta, real = defaultdict(list), {}, {}, {}
for al, op, vg, nu, p, d, dt, sit in rows:
    if vg not in prefs[al]: prefs[al].append(vg)
    nomes[vg] = nu
    m = meta.setdefault(al, {"p": p, "d": d, "dt": str(dt)})
    m["p"] = max(m["p"], p); m["d"] = max(m["d"], d)
    if sit == "Confirmado": real[al] = vg

prio = {a: (-m["p"], -m["d"], m["dt"]) for a, m in meta.items()}
held, ptr = defaultdict(list), defaultdict(int)
fila = list(prefs)
while fila:
    a = fila.pop()
    while ptr[a] < len(prefs[a]):
        v = prefs[a][ptr[a]]; ptr[a] += 1
        c = CAP.get(v, 0)
        if not c: continue
        h = held[v]; h.append(a); h.sort(key=lambda x: prio[x])
        if len(h) > c:
            out = h.pop()
            if out != a: fila.append(out)
            else: continue
        break
aloc = {a: v for v, l in held.items() for a in l}

# nota de corte de cada vaga = pior prioridade entre os que ficaram (a prova de estabilidade)
corte = {v: {"pontos": meta[l[-1]]["p"], "lotada": len(l) >= CAP.get(v, 0), "capacidade": CAP.get(v, 0),
             "candidatos": len(l)} for v, l in held.items() if l}

random.seed(22)
# amostra deliberadamente enviesada para os casos que exigem explicacao
nao_1a = [a for a in aloc if prefs[a] and aloc[a] != prefs[a][0]]
sem_vaga = [a for a in prefs if a not in aloc]
com_pontos = [a for a in aloc if meta[a]["p"] > 0]
escolhidos = (random.sample(nao_1a, min(28, len(nao_1a))) + random.sample(sem_vaga, min(20, len(sem_vaga)))
              + random.sample(com_pontos, min(12, len(com_pontos))))

casos = []
for a in dict.fromkeys(escolhidos):
    v = aloc.get(a)
    opcoes = []
    for i, vg in enumerate(prefs[a][:5]):
        c = corte.get(vg, {})
        opcoes.append({
            "posicao": i + 1, "unidade": nomes.get(vg, "—"),
            "grupamento": vg.split("|")[1].title(), "turno": vg.split("|")[2],
            "capacidade": c.get("capacidade", CAP.get(vg, 0)),
            "candidatos": c.get("candidatos", 0),
            "nota_de_corte": c.get("pontos"),
            "conseguiu": vg == v,
        })
    casos.append({
        "id": a, "pontos": meta[a]["p"], "desempates": meta[a]["d"],
        "criterios_validados": crit[a]["validados"], "criterios_so_declarados": crit[a]["declarados"],
        "opcoes": opcoes,
        "resultado_fila_unica": {"conseguiu": v is not None,
                                 "unidade": nomes.get(v) if v else None,
                                 "opcao": (prefs[a].index(v) + 1) if v else None},
        "resultado_processo_atual": {"conseguiu": a in real, "unidade": nomes.get(real.get(a))},
    })

(OUT / "casos.json").write_text(json.dumps({"ano": ANO, "casos": casos}, ensure_ascii=False, indent=1))
print(f"{len(casos)} casos · {sum(1 for c in casos if not c['resultado_fila_unica']['conseguiu'])} sem vaga · "
      f"{sum(1 for c in casos if c['pontos']>0)} com pontuação")
print(json.dumps(casos[0], ensure_ascii=False, indent=1)[:900])
