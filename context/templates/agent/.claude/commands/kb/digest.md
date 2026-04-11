Digere as notes brutas de `kb/calendar/notes/` em artigos de conhecimento no `kb/atlas/`.

Executa `uv run --directory .systems python memory/scripts/kb/compile.py` a partir da raiz do projeto.

Aceita argumentos opcionais:
- `--all` — recompila tudo, mesmo notes já digeridas
- `--file <path>` — digere apenas uma note específica
- `--dry-run` — mostra o que seria digerido sem executar

Se nenhum argumento for passado, digere apenas notes novas ou alteradas.

Ao finalizar, reporte: quantas notes foram digeridas, quantos artigos existem no KB, e o custo.
