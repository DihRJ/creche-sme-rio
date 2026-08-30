"""Roda os cenarios que o painel Fila Unica compara.

  atual        - o que o processo de 2025 efetivamente entregou
  fila_unica   - aceitacao diferida, mesma regua, mesmas vagas
  com_bairro   - + oferta automatica da vaga ociosa no proprio bairro
  regua_viva   - + a regua valendo de fato (prioridade pela declaracao, como
                 seria se a validacao do CadUnico funcionasse em vez de 6,8%)
"""
import duckdb, pathlib, json
import pandas as pd
from collections import defaultdict

ANO, TETO = 2025, 25
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
   sum(case when b.resposta='Sim' and b.confirmado='Sim' and c.perg_criterio='Sim' then 1 else 0 end) des,
   sum(case when b.resposta='Sim' and c.perg_criterio='Sim' then 1 else 0 end) des_decl,
   max(case when b.resposta='Sim' and c.perg_id in (28,6) then 1 else 0 end) vulneravel
 from qb b join qc c on b.ano=c.ano and b.ich_perg_id=c.ich_perg_id where b.ano={ANO} group by 1,2,3""")

con.sql(f"""create table opt as select a.aluno_anon, a.opcao,
   a.unidade||'|'||upper(strip_accents(trim(a.grupamento)))||'|'||a.horario vaga_id,
   upper(strip_accents(trim(a.grupamento))) grup,
   upper(strip_accents(trim(coalesce(a.bairro,'')))) bairro, a.situacao, a.data_criacao,
   coalesce(s.pontos,0) pts, coalesce(s.pontos_decl,0) pts_decl,
   coalesce(s.des,0) des, coalesce(s.des_decl,0) des_decl, coalesce(s.vulneravel,0) vuln
 from qa a left join score s using (prm_id, plm_id, ipl_id) where a.ano={ANO}""")

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
        t = pd.to_numeric(r[ct], errors="coerce"); al = pd.to_numeric(r[ca], errors="coerce")
        if pd.notna(t) and t > 0:
            s = int(t) * TETO - int(al if pd.notna(al) else 0)
            if s > 0: ocioso[f"{r['designacao']}|{g}|{h}"] = s

ocupado = {r[0]: int(r[1]) for r in con.sql(
    "select vaga_id, count(distinct aluno_anon) from opt where situacao='Confirmado' group by 1").fetchall()}
CAP = {v: ocupado.get(v, 0) + ocioso.get(v, 0)
       for v in {r[0] for r in con.sql("select distinct vaga_id from opt").fetchall()}
       if ocupado.get(v, 0) + ocioso.get(v, 0) > 0}

rows = con.sql("""select aluno_anon, opcao, vaga_id, pts, pts_decl, des, des_decl, vuln, bairro, grup, data_criacao
                  from opt order by aluno_anon, opcao""").fetchall()
prefs, meta = defaultdict(list), {}
for al, op, vg, p, pdc, d, dd, vu, ba, gr, dt in rows:
    if vg not in prefs[al]: prefs[al].append(vg)
    m = meta.setdefault(al, {"p": p, "pd": pdc, "d": d, "dd": dd, "vuln": vu, "bairro": ba, "grup": gr, "dt": str(dt)})
    m["p"] = max(m["p"], p); m["pd"] = max(m["pd"], pdc); m["vuln"] = max(m["vuln"], vu)

bairro_vaga = {r[0]: r[1] for r in con.sql(f"""select o.vaga_id, any_value(u.bairro) from opt o
  join (select column1 cod, upper(strip_accents(trim(column7))) bairro from
        read_csv('{D}/04_UnidadesEscolaresComEndereco.csv', delim=';', header=false, encoding='utf-8', all_varchar=true)) u
  on split_part(o.vaga_id,'|',1) = lpad(u.cod,7,'0') group by 1""").fetchall()}

def rodar(usar_declarado: bool, fallback_bairro: bool):
    prio = {a: (-(m["pd"] if usar_declarado else m["p"]),
                -(m["dd"] if usar_declarado else m["d"]), m["dt"]) for a, m in meta.items()}
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
    realoc = 0
    if fallback_bairro:
        sobra = {v: CAP[v] - len(held[v]) for v in CAP if CAP[v] - len(held[v]) > 0}
        por_bairro = defaultdict(list)
        for v in sobra: por_bairro[(bairro_vaga.get(v), v.split("|")[1])].append(v)
        for a in sorted((x for x in prefs if x not in aloc), key=lambda x: prio[x]):
            m = meta[a]
            for v in por_bairro.get((m["bairro"], m["grup"]), []):
                if sobra.get(v, 0) > 0:
                    sobra[v] -= 1; aloc[a] = v; realoc += 1; break
    pos = defaultdict(int)
    for a, v in aloc.items():
        pos[prefs[a].index(v) + 1 if v in prefs[a] else 99] += 1
    return {"alocadas": len(aloc), "ociosas": sum(CAP.values()) - len(aloc),
            "por_opcao": {str(k): v for k, v in sorted(pos.items())},
            "realocadas_no_bairro": realoc,
            "vulneraveis_atendidas": sum(1 for a in aloc if meta[a]["vuln"])}

base_pos = {str(int(r[0])): int(r[1]) for r in con.sql(
    "select opcao, count(distinct aluno_anon) from opt where situacao='Confirmado' group by 1 order by 1").fetchall()}
base_n = con.sql("select count(distinct aluno_anon) from opt where situacao='Confirmado'").fetchone()[0]
base_vuln = con.sql("select count(distinct aluno_anon) from opt where situacao='Confirmado' and vuln=1").fetchone()[0]

cen = {
 "atual": {"nome": "Processo atual", "alocadas": int(base_n), "por_opcao": base_pos,
   "ociosas": int(sum(CAP.values()) - base_n), "realocadas_no_bairro": 0,
   "vulneraveis_atendidas": int(base_vuln),
   "descricao": "O que a Inscrição Creche de 2025 efetivamente entregou: classificação por opção e convocação em cascata."},
 "fila_unica": {"nome": "Fila Única", **rodar(False, False),
   "descricao": "Aceitação diferida: a criança é classificada uma vez e todas as opções resolvem na mesma rodada. Mesma régua, mesmas vagas."},
 "com_bairro": {"nome": "Fila Única + oferta no bairro", **rodar(False, True),
   "descricao": "Quem não entrou em nenhuma das cinco opções recebe automaticamente a vaga ociosa mais próxima no próprio bairro."},
 "regua_viva": {"nome": "Fila Única + régua valendo", **rodar(True, True),
   "descricao": "O mesmo, com a régua de vulnerabilidade efetivamente aplicada — como seria se a validação do CadÚnico funcionasse em vez de 6,8%."},
}
res = {"ano": ANO, "teto_turma": TETO, "vagas": int(sum(CAP.values())),
       "criancas_inscritas": int(con.sql("select count(distinct aluno_anon) from opt").fetchone()[0]),
       "vulneraveis_inscritas": int(con.sql("select count(distinct aluno_anon) from opt where vuln=1").fetchone()[0]),
       "cenarios": cen}
(OUT / "cenarios.json").write_text(json.dumps(res, ensure_ascii=False, indent=2))
print(f"inscritas={res['criancas_inscritas']}  vulneraveis={res['vulneraveis_inscritas']}  vagas={res['vagas']}\n")
for v in cen.values():
    print(f"{v['nome']:32} alocadas={v['alocadas']:6d}  1a opcao={int(v['por_opcao'].get('1',0)):6d}  "
          f"ociosas={v['ociosas']:6d}  vulneraveis={v['vulneraveis_atendidas']:6d}")
