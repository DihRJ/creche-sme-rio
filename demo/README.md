# Vídeo de apresentação

`fila-unica.webm` — 2min27s, percurso completo do app da família, do cadastro ao
resultado. Gravado num navegador de verdade em 420×900, que é o alvo móvel do RNF1.

**Sem áudio.** A narração é legenda na tela, o que tem a vantagem de funcionar no
mudo — que é como a maioria assiste vídeo institucional.

VP8/WebM: abre em Chrome, Firefox, Edge e VLC. **Não abre no QuickTime.** O ffmpeg
que vem com o Playwright só traz VP8; converter para mp4 exige um ffmpeg completo
(`brew install ffmpeg`).

## Regravar

```bash
cd fila-unica-app/web
npm i --no-save playwright && npx playwright install chromium   # se ainda não tiver
npm run dev                                                     # noutro terminal
node e2e/video.mjs
```

Sai em `e2e/videos/`, que não é versionada — copie para cá o que for publicar.

O roteiro roda contra o **mock**, de propósito: é determinístico, não escreve em banco
nenhum, e o cruzamento por CPF é estável, então a cena do CadÚnico confirmado acontece
sempre no mesmo ponto. O script se recusa a rodar contra URL que não seja localhost,
porque ele preenche formulário e finaliza inscrição — contra a pública isso escreveria
em produção.

## O que o vídeo mostra

| Trecho | Conteúdo |
| --- | --- |
| 0:00 | O problema: 93% das inscrições com zero ponto, CadÚnico validado em 6,8% |
| 0:14 | Etapa 1 — criar acesso, sem senha |
| 0:25 | Etapa 2 — a criança, com grupamento sugerido pela idade |
| 0:36 | Etapa 3 — escolher até 5 creches, ordem vinculante |
| 1:03 | Etapa 4 — os 13 critérios com o valor em pontos, e o CadÚnico confirmado pela base |
| 1:26 | Etapa 5 — comprovantes por foto do celular |
| 1:37 | Etapa 6 — revisar e finalizar, com o número de inscrição |
| 1:50 | Acompanhamento: calendário do processo, nota de corte × pontuação, e a explicação |
