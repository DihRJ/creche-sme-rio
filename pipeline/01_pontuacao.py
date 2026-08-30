"""Reconstroi a pontuacao de cada inscricao usando a regua oficial da SME (QueryC)."""
import duckdb, pathlib
D = pathlib.Path(__file__).resolve().parent.parent / "dados" / "Bases IC_ ClassificadoseFila"
con = duckdb.connect()
con.sql(f"create view qa as select * from read_csv('{D}/01_QueryA_InscricoesPorAno.csv.gz', delim=';', header=true, encoding='utf-8')")
con.sql(f"create view qb as select * from read_csv('{D}/02_QueryB_RespostasSocioEconomicas.csv.gz', delim=';', header=true, encoding='utf-8')")
con.sql(f"create view qc as select * from read_csv('{D}/03_QueryC_PerguntasComDescricao.csv', delim=';', header=true, encoding='utf-8')")

print(con.sql("select ano, count(*) perguntas, sum(perg_pontuacao) pontos_max from qc group by 1 order by 1").df().to_string(index=False))
print("\n--- regua 2025 ---")
print(con.sql("select perg_id, perg_pontuacao, perg_criterio, substr(pergunta_texto,1,85) txt from qc where ano=2025 order by perg_pontuacao desc").df().to_string(index=False))

con.sql("""create view score as
 select b.ano, b.prm_id, b.plm_id, b.ipl_id,
   sum(case when b.resposta='Sim' and b.confirmado='Sim' then c.perg_pontuacao else 0 end) pontos_confirmados,
   sum(case when b.resposta='Sim' then c.perg_pontuacao else 0 end) pontos_declarados
 from qb b join qc c on b.ano=c.ano and b.ich_perg_id=c.ich_perg_id group by 1,2,3,4""")
print("\n--- pontos por ano ---")
print(con.sql("""select ano, count(*) inscricoes, round(avg(pontos_confirmados),1) media, max(pontos_confirmados) maximo,
  sum(case when pontos_confirmados=0 then 1 else 0 end) com_zero from score group by 1 order by 1""").df().to_string(index=False))

print("\n--- pontos confirmados vs desfecho (2025, por crianca) ---")
print(con.sql("""
with x as (select a.aluno_anon, max(s.pontos_confirmados) pts,
   max(case when a.situacao='Confirmado' then 1 else 0 end) matriculou
 from qa a join score s on a.ano=s.ano and a.prm_id=s.prm_id and a.plm_id=s.plm_id and a.ipl_id=s.ipl_id
 where a.ano=2025 group by 1)
select case when pts=0 then '0' when pts<25 then '1-24' when pts<50 then '25-49' when pts<100 then '50-99' else '100+' end faixa,
 count(*) criancas, round(100.0*avg(matriculou),1) pct_matriculou from x group by 1 order by 2 desc""").df().to_string(index=False))
