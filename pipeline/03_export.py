"""Exporta os agregados que o painel Fila Unica consome (JSON estatico, sem backend)."""
import duckdb, pathlib, json, unicodedata
import pandas as pd
ANO=2025; TETO=25
ROOT=pathlib.Path(__file__).resolve().parent.parent
D=ROOT/"dados"/"Bases IC_ ClassificadoseFila"; O=ROOT/"dados"/"OferecimentosEvagas"
OUT=ROOT/"app"/"public"/"data"; OUT.mkdir(parents=True,exist_ok=True)
con=duckdb.connect()
con.sql(f"create view qa as select * from read_csv('{D}/01_QueryA_InscricoesPorAno.csv.gz', delim=';', header=true, encoding='utf-8')")
con.sql(f"create view qb as select * from read_csv('{D}/02_QueryB_RespostasSocioEconomicas.csv.gz', delim=';', header=true, encoding='utf-8')")
con.sql(f"create view qc as select * from read_csv('{D}/03_QueryC_PerguntasComDescricao.csv', delim=';', header=true, encoding='utf-8')")

def w(name,obj):
    (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":")))
    print(f"  {name}  {(OUT/name).stat().st_size/1024:.0f} KB")

# 1. Funil de convocacao por ano (crianca, nao opcao)
funil=con.sql("""with c as (select ano, aluno_anon,
   max(case when situacao='Confirmado' then 1 else 0 end) conf,
   max(case when situacao='Cancelado na confirmacao' then 1 else 0 end) perdeu,
   max(case when situacao='Lista de espera' then 1 else 0 end) fila
 from qa group by 1,2)
select ano, count(*) inscritas, sum(conf) matricularam,
  sum(case when perdeu=1 and conf=0 then 1 else 0 end) convocadas_e_perdidas,
  sum(case when conf=0 and perdeu=0 and fila=1 then 1 else 0 end) so_fila
from c group by 1 order by 1""").df()
w("funil.json", funil.to_dict("records"))

# 2. Validacao da regua: declarado x confirmado
val=con.sql("""select b.ano, c.perg_id, c.perg_pontuacao pontos, c.pergunta_texto,
  sum(case when b.resposta='Sim' then 1 else 0 end) declarou,
  sum(case when b.resposta='Sim' and b.confirmado='Sim' then 1 else 0 end) validou
 from qb b join qc c on b.ano=c.ano and b.ich_perg_id=c.ich_perg_id
 group by 1,2,3,4 having sum(case when b.resposta='Sim' then 1 else 0 end)>0 order by 1, declarou desc""").df()
val["pct"]=(100*val.validou/val.declarou).round(1)
w("regua.json", val.to_dict("records"))

# 3. Unidades com localizacao
loc=pd.read_excel(O/"Unidades_Unificadas_com_Localizacao.xlsx", sheet_name="Unidades_Unificadas")
loc["designacao"]=loc["DESIGNACAO"].astype(str).str.strip().str.zfill(7)
loc=loc[["designacao","CRE","microárea","DENOMINACAO","BAIRRO","LATITUDE","LONGITUDE","Tipo"]]
loc.columns=["unidade","cre","microarea","nome","bairro","lat","lng","tipo"]
con.register("loc",loc)

pub=pd.read_excel(O/"totaalunoscreche2025.xlsx",sheet_name="Consolidado",header=None,skiprows=2)
pub.columns=["cre","designacao","denominacao","ber_int_al","ber_int_tur","ber_par_al","ber_par_tur",
 "m1_int_al","m1_int_tur","m1_par_al","m1_par_tur","m2_int_al","m2_int_tur","m2_par_al","m2_par_tur",
 "tot_int_al","tot_int_tur","tot_par_al","tot_par_tur"]
pub=pub[pub["designacao"].notna()].copy()
pub["unidade"]=pub["designacao"].astype(str).str.strip().str.zfill(7)
num=[c for c in pub.columns if c.endswith(("_al","_tur"))]
pub[num]=pub[num].apply(pd.to_numeric,errors="coerce").fillna(0)
pub["turmas"]=pub["tot_int_tur"]+pub["tot_par_tur"]; pub["alunos"]=pub["tot_int_al"]+pub["tot_par_al"]
pub["ociosas"]=(pub["turmas"]*TETO-pub["alunos"]).clip(lower=0)
con.register("pub",pub[["unidade","turmas","alunos","ociosas"]])

uni=con.sql(f"""
with x as (select unidade, any_value(nome_unidade) nome,
   count(distinct case when situacao='Lista de espera' then aluno_anon end) fila,
   count(distinct case when situacao='Confirmado' then aluno_anon end) matriculou,
   count(distinct case when situacao='Cancelado na confirmacao' then aluno_anon end) perdeu
 from qa where ano={ANO} group by 1)
select x.*, l.cre, l.microarea, l.bairro, l.lat, l.lng, l.tipo,
  coalesce(p.turmas,0) turmas, coalesce(p.ociosas,0) ociosas
from x left join loc l using(unidade) left join pub p using(unidade) order by x.fila desc""").df()
uni=uni.where(pd.notna(uni),None)
w("unidades.json", json.loads(uni.to_json(orient="records")))

# 4. Agregado por CRE
cre=con.sql(f"""
with x as (select unidade, count(distinct case when situacao='Lista de espera' then aluno_anon end) fila,
   count(distinct case when situacao='Confirmado' then aluno_anon end) matriculou
 from qa where ano={ANO} group by 1)
select l.cre, count(*) unidades, sum(x.fila) fila, sum(x.matriculou) matriculou, sum(coalesce(p.ociosas,0)) ociosas
from x join loc l using(unidade) left join pub p using(unidade) where l.cre is not null
group by 1 order by 1""").df()
w("cre.json", json.loads(cre.to_json(orient="records")))
print("\nCRE:\n", cre.to_string(index=False))
print("\nunidades com lat/lng:", int(uni.lat.notna().sum()), "de", len(uni))
