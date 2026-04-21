Processa os arquivos do inbox `kb/+/` e incorpora ao knowledge base.

Executa `uv run --directory .systems python memory/scripts/kb/ingest.py` a partir da raiz do projeto.

Aceita argumentos opcionais:
- `--all` — reprocessa todos os arquivos do inbox, ignorando o hash-tracking
- `--file <path>` — ingere um arquivo específico (relativo a `kb/+/` ou absoluto)
- `--dry-run` — mostra o que seria ingerido sem executar

Se nenhum argumento for passado, ingere apenas arquivos novos ou alterados.

O agente decide como processar cada arquivo com base nas ferramentas disponíveis (lê texto direto, invoca `pdftotext` via Bash pra PDFs, analisa imagens visualmente, transcreve áudios se houver whisper, etc.). Para cada arquivo, ele cria/atualiza artigos no wiki, preserva o binário em `kb/x/files/` se fizer sentido, e atualiza `kb/HOME.md` e `kb/calendar/log.md`.

Ao finalizar, reporte: quantos arquivos foram ingeridos, quais artigos foram criados/atualizados, quais binários foram preservados, e o custo total.
