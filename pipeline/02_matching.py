"""Fila Unica - motor de matching estavel (aceitacao diferida) para a Inscricao Creche.

Pergunta: com as MESMAS vagas que a rede ja planejou e a MESMA regua de pontuacao da SME,
o que muda ao classificar CRIANCA em vez de OPCAO?

Capacidade:
  - rede publica: turmas x 25 (teto normativo, confirmado pelo p90 observado em 2025)
  - parceiras e demais: piso conservador = criancas efetivamente matriculadas
"""
import duckdb, pathlib, json, sys, unicodedata
import pandas as pd
from collections import defaultdict

ANO = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
TETO_TURMA = 25
ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / "dados" / "Bases IC_ ClassificadoseFila"
O = ROOT / "dados" / "OferecimentosEvagas"
OUT = ROOT / "app" / "public" / "data"; OUT.mkdir(parents=True, exist_ok=True)

def norm(s):
    if s is None: return ""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.upper().split())

con = duckdb.connect()
con.sql(f"create view qa as select * from read_csv('{D}/01_QueryA_InscricoesPorAno.csv.gz', delim=';', header=true, encoding='utf-8')")
con.sql(f"create view qb as select * from read_csv('{D}/02_QueryB_RespostasSocioEconomicas.csv.gz', delim=';', header=true, encoding='utf-8')")
con.sql(f"create view qc as select * from read_csv('{D}/03_QueryC_PerguntasComDescricao.csv', delim=';', header=true, encoding='utf-8')")

con.sql(f"""create table score as
 select b.prm_id, b.plm_id, b.ipl_id,
   sum(case when b.resposta='Sim' and b.confirmado='Sim' then c.perg_pontuacao else 0 end) pontos,
   sum(case when b.resposta='Sim' and b.confirmado='Sim' and c.perg_criterio='Sim' then 1 else 0 end) desempate
 from qb b join qc c on b.ano=c.ano and b.ich_perg_id=c.ich_perg_id
 where b.ano={ANO} group by 1,2,3""")

con.sql(f"""create table opt as
 select a.aluno_anon, a.opcao, a.unidade, a.nome_unidade,
   upper(strip_accents(trim(a.grupamento))) grup, a.horario,
   upper(strip_accents(trim(coalesce(a.bairro,'')))) bairro,
   a.unidade||'|'||upper(strip_accents(trim(a.grupamento)))||'|'||a.horario as vaga_id,
   a.situacao, a.data_criacao,
   coalesce(s.pontos,0) pontos, coalesce(s.desempate,0) desempate
 from qa a left join score s using (prm_id, plm_id, ipl_id) where a.ano={ANO}""")

# --- capacidade planejada da rede publica, a partir de turmas ---
pub = pd.read_excel(O / f"totaalunoscreche{ANO}.xlsx" if (O / f"totaalunoscreche{ANO}.xlsx").exists()
                    else O / "totaalunoscreche2025.xlsx", sheet_name="Consolidado", header=None, skiprows=2)
pub.columns = ["cre","designacao","denominacao","ber_int_al","ber_int_tur","ber_par_al","ber_par_tur",
  "m1_int_al","m1_int_tur","m1_par_al","m1_par_tur","m2_int_al","m2_int_tur","m2_par_al","m2_par_tur",
  "tot_int_al","tot_int_tur","tot_par_al","tot_par_tur"]
pub = pub[pub["designacao"].notna()].copy()
pub["designacao"] = pub["designacao"].astype(str).str.strip().str.zfill(7)
# ociosidade fisica observada = turmas x teto - alunos efetivamente na turma.
# Nao e capacidade total: a capacidade total inclui criancas que permanecem de um ano
# para o outro e nao passam pelo processo de inscricao. So a sobra vira vaga nova.
COLS = {("BERCARIO","Integral"):("ber_int_tur","ber_int_al"), ("BERCARIO","Parcial"):("ber_par_tur","ber_par_al"),
        ("MATERNAL I","Integral"):("m1_int_tur","m1_int_al"), ("MATERNAL I","Parcial"):("m1_par_tur","m1_par_al"),
        ("MATERNAL II","Integral"):("m2_int_tur","m2_int_al"), ("MATERNAL II","Parcial"):("m2_par_tur","m2_par_al")}
ocioso_fisico = {}
for _, r in pub.iterrows():
    for (g, h), (ct, ca) in COLS.items():
        t = pd.to_numeric(r[ct], errors="coerce"); al = pd.to_numeric(r[ca], errors="coerce")
        if pd.notna(t) and t > 0:
            sobra = int(t) * TETO_TURMA - int(al if pd.notna(al) else 0)
            if sobra > 0:
                ocioso_fisico[f"{r['designacao']}|{g}|{h}"] = sobra

ocupado = {r[0]: int(r[1]) for r in con.sql(
    "select vaga_id, count(distinct aluno_anon) from opt where situacao='Confirmado' group by 1").fetchall()}
vagas_todas = {r[0] for r in con.sql("select distinct vaga_id from opt").fetchall()}

# vaga disponivel no processo = o que o processo ja alocou + o que ficou fisicamente vazio
cap = {}
for v in vagas_todas:
    c = ocupado.get(v, 0) + ocioso_fisico.get(v, 0)
    if c > 0: cap[v] = c
cap_publica = sum(ocioso_fisico.get(v, 0) for v in cap)

# --- aceitacao diferida (crianca propoe) ---
rows = con.sql("select aluno_anon, opcao, vaga_id, pontos, desempate, data_criacao from opt order by aluno_anon, opcao").fetchall()
prefs, prio = defaultdict(list), {}
for aluno, opcao, vaga, pts, des, dt in rows:
    if vaga not in prefs[aluno]:
        prefs[aluno].append(vaga)
    p = (-pts, -des, str(dt))
    if aluno not in prio or p < prio[aluno]:
        prio[aluno] = p

held = defaultdict(list); ptr = defaultdict(int)
fila = list(prefs.keys())
while fila:
    aluno = fila.pop()
    while ptr[aluno] < len(prefs[aluno]):
        vaga = prefs[aluno][ptr[aluno]]; ptr[aluno] += 1
        c = cap.get(vaga, 0)
        if c == 0: continue
        h = held[vaga]; h.append(aluno); h.sort(key=lambda a: prio[a])
        if len(h) > c:
            out = h.pop()
            if out != aluno: fila.append(out)
            else: continue
        break

aloc = {a: v for v, lst in held.items() for a in lst}
pos = defaultdict(int)
for a, v in aloc.items(): pos[prefs[a].index(v) + 1] += 1

# --- fallback territorial: sobrou vaga no bairro de quem ficou de fora? ---
bairro_aluno = {r[0]: r[1] for r in con.sql("select aluno_anon, any_value(bairro) from opt group by 1").fetchall()}
grup_aluno = {r[0]: r[1] for r in con.sql("select aluno_anon, any_value(grup) from opt group by 1").fetchall()}
bairro_vaga = {r[0]: r[1] for r in con.sql("""select o.vaga_id, any_value(u.bairro) from opt o
  join (select column1 cod, upper(strip_accents(trim(column7))) bairro from
        read_csv('%s/04_UnidadesEscolaresComEndereco.csv', delim=';', header=false, encoding='utf-8', all_varchar=true)) u
  on o.unidade = lpad(u.cod,7,'0') group by 1""" % D).fetchall()}
sobra = {v: cap[v] - len(held[v]) for v in cap if cap[v] - len(held[v]) > 0}
sem_vaga = [a for a in prefs if a not in aloc]
realoc = 0
for a in sem_vaga:
    b, g = bairro_aluno.get(a, ""), grup_aluno.get(a, "")
    for v, s in sobra.items():
        if s > 0 and bairro_vaga.get(v) == b and b and v.split("|")[1] == g:
            sobra[v] -= 1; realoc += 1; break

base = con.sql("select count(distinct aluno_anon) from opt where situacao='Confirmado'").fetchone()[0]
base_op = {int(r[0]): int(r[1]) for r in con.sql(
    "select opcao, count(distinct aluno_anon) from opt where situacao='Confirmado' group by 1 order by 1").fetchall()}
total = con.sql("select count(distinct aluno_anon) from opt").fetchone()[0]
vagas = sum(cap.values())

res = {"ano": ANO, "teto_turma": TETO_TURMA,
 "criancas_inscritas": int(total), "vagas_planejadas": int(vagas), "vagas_ociosas_fisicas": int(cap_publica),
 "atual": {"alocadas": int(base), "por_opcao": base_op, "ociosas": int(vagas - base)},
 "fila_unica": {"alocadas": int(len(aloc)), "por_opcao": {int(k): int(v) for k, v in sorted(pos.items())},
                "ociosas": int(vagas - len(aloc)), "realocadas_no_bairro": int(realoc),
                "alocadas_com_fallback": int(len(aloc) + realoc)}}
res["ganho_1a_opcao"] = res["fila_unica"]["por_opcao"].get(1, 0) - base_op.get(1, 0)
res["ganho_criancas"] = res["fila_unica"]["alocadas_com_fallback"] - base
print(json.dumps(res, indent=2, ensure_ascii=False))
(OUT / f"matching_{ANO}.json").write_text(json.dumps(res, ensure_ascii=False, indent=2))
