"""Gera, com o Claude, a explicacao auditavel de cada caso de alocacao.

Roda no build, nao em runtime: o painel publicado serve texto estatico, entao a demo
nao depende de rede e nenhum dado de crianca trafega para o modelo em producao.

Modelo: Sonnet 5, seguindo a orientacao do organizador do evento de reservar os
modelos maiores para o que precisa. A tarefa e reescrita factual de dados ja
estruturados pelo pipeline, entao effort baixo basta.
"""
import json, os, pathlib, sys
from concurrent.futures import ThreadPoolExecutor
import anthropic

MODELO = "claude-sonnet-5"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "public" / "data"
if not os.environ.get("ANTHROPIC_API_KEY"):
    os.environ["ANTHROPIC_API_KEY"] = pathlib.Path(os.environ.get(
        "CLAUDE_API_KEY_FILE", os.path.expanduser("~/.config/anthropic/projeto-api.key"))).read_text().strip()
client = anthropic.Anthropic()

SISTEMA = """Você explica, para o gestor da Secretaria Municipal de Educação do Rio, por que uma
criança ficou onde ficou na alocação da fila da creche. O algoritmo é aceitação diferida: a criança
propõe na ordem de preferência que a família declarou, e cada unidade retém as maiores pontuações
até lotar.

Escreva em português do Brasil, 3 a 5 frases, tom de servidor público explicando a uma família.
Não use travessão. Não invente número que não esteja nos dados. Nunca trate a criança como caso
perdido: se ela ficou de fora, diga o que aconteceu e o que vem a seguir.

Duas coisas são obrigatórias quando se aplicam:

1. Se ela não conseguiu uma opção, diga a nota de corte daquela unidade e compare com a pontuação
   dela. É isso que torna a decisão auditável.
2. Se existir critério em "criterios_so_declarados", diga com todas as letras que a família
   declarou aquele direito, que ele valeria os pontos indicados e que ele não foi validado, então
   não contou. Esse é o ponto mais importante da explicação quando ele aparece.

Responda apenas com o texto da explicação, sem título e sem preâmbulo."""

casos = json.loads((OUT / "casos.json").read_text())["casos"]

def explicar(c):
    corpo = json.dumps({
        "pontuacao_que_valeu": c["pontos"],
        "criterios_validados": c["criterios_validados"],
        "criterios_so_declarados": c["criterios_so_declarados"],
        "opcoes_da_familia": c["opcoes"],
        "onde_ficou": c["resultado_fila_unica"],
    }, ensure_ascii=False)
    try:
        r = client.messages.create(
            model=MODELO, max_tokens=4000,
            output_config={"effort": "low"},
            system=SISTEMA, messages=[{"role": "user", "content": corpo}])
        txt = next((b.text for b in r.content if b.type == "text"), None)
        if not txt:
            print(f"  sem texto {c['id']} (stop={r.stop_reason})", file=sys.stderr)
        return c["id"], (txt or "").strip() or None, r.usage
    except anthropic.APIStatusError as e:
        print(f"  falhou {c['id']}: HTTP {e.status_code}", file=sys.stderr)
    except anthropic.APIConnectionError as e:
        print(f"  conexão {c['id']}: {e}", file=sys.stderr)
    return c["id"], None, None

saida, tin, tout = {}, 0, 0
with ThreadPoolExecutor(max_workers=6) as ex:
    for i, (cid, txt, uso) in enumerate(ex.map(explicar, casos), 1):
        if txt:
            saida[cid] = txt
            tin += uso.input_tokens; tout += uso.output_tokens
        if i % 20 == 0: print(f"  {i}/{len(casos)}")

(OUT / "explicacoes.json").write_text(json.dumps(saida, ensure_ascii=False, indent=1))
print(f"\n{len(saida)}/{len(casos)} explicações · {tin} in, {tout} out · ~US$ {tin/1e6*2 + tout/1e6*10:.2f}")
ex_id = next((c["id"] for c in casos if c["id"] in saida), None)
if ex_id: print("\n--- exemplo ---\n" + saida[ex_id])
