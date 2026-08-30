# SME-Rio

## Como abrir este projeto
Sempre por `claude-api` (alias → `~/scripts/claude-api.sh`), nunca por `claude` puro.
Este projeto roda nos **créditos da API (Console)**, não na assinatura.

    cd ~/Documents/04_Projetos/SME-Rio && claude-api

Conferir na sessão: `/status` tem que mostrar a linha `API key`.

## O que muda numa sessão pela API
- **Conectores do claude.ai não carregam** (Supabase, Drive, Gmail, Linear, Notion, Canva, Stripe) e `/schedule` não funciona. Se precisar de Supabase aqui, é CLI local ou MCP local via `claude mcp add`.
- MCPs locais seguem normais: playwright, chrome, computer-use, context7.
- Freio pontual de gasto: `claude-api --max-budget-usd 20`.

## Escopo (definido em 30/08/2026)
Hackathon **Claude Impact Lab Rio — 2ª edição**, Prefeitura do Rio / SME. Diego está no **grupo 22**.
Desafio: *Inteligência na Fila da Creche* — planejamento de vagas, classificação e convocação da Inscrição Creche (0 a 3a11m).
Entrega até **16h30 de 30/08**: repo público no GitHub + e-mail para `eventos@taicor.ai` com o número do grupo no assunto.

- Briefing completo e números já extraídos da base: `BRIEFING.md`
- `./brief` — clone de `taicor-ai/claude-impact-lab-rio-2` (regras e critérios de julgamento)
- `./dados` — clone de `CIT-SME-RJ/dadoscreche` (69 MB, dados reais anonimizados 2021–2025)

Ferramentas: DuckDB (instalado via pip) para as bases grandes. Não usar Excel na QueryB (4,3M linhas).
