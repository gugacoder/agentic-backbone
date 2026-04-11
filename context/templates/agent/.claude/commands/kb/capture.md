Extrai memórias da sessão atual para `kb/calendar/notes/`.

Executa `uv run --directory .systems python memory/scripts/kb/flush.py` a partir da raiz do projeto, passando o contexto da conversa atual.

Passos:
1. Resuma a conversa atual em formato de daily log (seguindo o template em `.systems/memory/prompts/flush.md`)
2. Escreva o resumo em `kb/calendar/notes/YYYY-MM-DD.md` (data de hoje), fazendo append se o arquivo já existir
3. Se o arquivo não existir, crie com o header `# Daily Log: YYYY-MM-DD\n\n## Sessions\n\n## Memory Maintenance\n\n`
4. Use o formato de seção: `### Session (HH:MM) - Título breve`

Inclua apenas o que vale a pena preservar: decisões, lições, insights. Ignore tool calls rotineiros.
