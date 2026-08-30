/**
 * Verificador de contraste WCAG 2.1 AA da paleta do projeto (RNF6).
 *
 *   node devc/contraste.mjs claro
 *   node devc/contraste.mjs escuro
 *
 * A paleta é derivada do matricula.rio, o site oficial da SME-Rio, e vive em três
 * arquivos que precisam concordar:
 *   fila-unica-app/web/src/ui/tema.css      (kit do app da família)
 *   fila-unica-app/web/src/index.css        (base do app da família)
 *   app/src/app/globals.css                 (painel analítico)
 *
 * Mexeu em cor? Rode isto antes de commitar. A tela decide vaga de creche: um par
 * reprovado aqui é uma família que não consegue ler a própria pontuação.
 *
 * O site de origem NÃO passa em tudo — o `.btn-primary` dele é branco sobre ciano
 * #1bb5da, que dá 2.42:1. Herdamos a identidade, não o erro: aqui o ciano é
 * acento e borda, nunca preenchimento de botão com texto branco.
 */
const hex = (h) => { const s = h.replace('#',''); return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)); };
const lin = (c) => { const s = c/255; return s <= 0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4; };
const lum = (h) => { const [r,g,b] = hex(h).map(lin); return 0.2126*r + 0.7152*g + 0.0722*b; };
const razao = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m); return (x+0.05)/(y+0.05); };

const P = process.argv[2] === 'escuro' ? {
  'surface-0':'#0e1418','surface-1':'#151d23','surface-2':'#1e2830','border':'#35444f',
  'text-1':'#ffffff','text-2':'#c2ced8','text-3':'#8fa0ad',
  'marca':'#4aa3dc','marca-escura':'#0d2b42','marca-forte':'#5fb0e2','sobre-marca':'#08131a','sobre-marca-escura':'#ffffff',
  'acento':'#3fc9e8','acento-escuro':'#1ba7c8',
  'fila':'#e8783f','ociosa':'#4aa3dc','ganho':'#2fb98a','perda':'#eb7070',
  'confirmado-fg':'#5fd6a6','confirmado-bg':'#0e2620','confirmado-br':'#245f48',
  'pendente-fg':'#5fc9e8','pendente-bg':'#0b242e','pendente-br':'#1d5a70',
  'faltando-fg':'#f39494','faltando-bg':'#2a1517','faltando-br':'#6e3236',
  'neutro-fg':'#c2ced8','neutro-bg':'#1e2830','neutro-br':'#35444f',
} : {
  'surface-0':'#f1f5f9','surface-1':'#ffffff','surface-2':'#e4ecf2','border':'#c2d2df',
  'text-1':'#181818','text-2':'#424242','text-3':'#5f6c78',
  'marca':'#00508a','marca-escura':'#004a80','marca-forte':'#034c7f','sobre-marca':'#ffffff','sobre-marca-escura':'#ffffff',
  'acento':'#1bb5da','acento-escuro':'#008eb6',
  'fila':'#bf4718','ociosa':'#0a6fb5','ganho':'#12805c','perda':'#c9342f',
  'confirmado-fg':'#0f7350','confirmado-bg':'#e3f4ec','confirmado-br':'#a3ddc5',
  'pendente-fg':'#03657f','pendente-bg':'#e0f3f9','pendente-br':'#96d3e5',
  'faltando-fg':'#b3282b','faltando-bg':'#fdecec','faltando-br':'#f2b8b8',
  'neutro-fg':'#424242','neutro-bg':'#e4ecf2','neutro-br':'#c2d2df',
};

const PARES = [
  ['text-1','surface-0',4.5],['text-1','surface-1',4.5],['text-1','surface-2',4.5],
  ['text-2','surface-0',4.5],['text-2','surface-1',4.5],
  ['text-3','surface-0',4.5],['text-3','surface-1',4.5],
  ['sobre-marca','marca',4.5],['sobre-marca-escura','marca-escura',4.5],['sobre-marca','marca-forte',4.5],
  ['marca','surface-0',4.5],['marca','surface-1',4.5],
  ['ociosa','surface-1',4.5],['ociosa','surface-0',4.5],
  ['confirmado-fg','confirmado-bg',4.5],['pendente-fg','pendente-bg',4.5],
  ['faltando-fg','faltando-bg',4.5],['neutro-fg','neutro-bg',4.5],
  ['confirmado-fg','surface-1',4.5],['pendente-fg','surface-1',4.5],['faltando-fg','surface-1',4.5],
  ['ganho','surface-1',4.5],['perda','surface-1',4.5],['fila','surface-1',4.5],
  ['border','surface-1',1.5],['acento','surface-1',1.5],
];

let ruins = 0;
console.log(`\n=== tema ${process.argv[2] === 'escuro' ? 'ESCURO' : 'CLARO'} ===`);
for (const [a,b,min] of PARES) {
  const r = razao(P[a],P[b]);
  const passa = r >= min;
  if (!passa) ruins++;
  console.log(`${passa?'  ok  ':' FALHA'} ${r.toFixed(2)}:1  (min ${min})  ${a} sobre ${b}`);
}
// O proprio matricula.rio erra aqui, e nao vamos copiar o erro.
console.log(`\n  nota: branco sobre o ciano #1bb5da do site = ${razao('#ffffff','#1bb5da').toFixed(2)}:1 -> reprova AA`);
console.log(ruins === 0 ? '\nPALETA OK' : `\n${ruins} PAR(ES) REPROVADO(S)`);
process.exit(ruins === 0 ? 0 : 1);
