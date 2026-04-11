Checa a saúde do knowledge base.

Executa `uv run --directory .systems python memory/scripts/kb/lint.py` a partir da raiz do projeto.

Aceita argumento opcional:
- `--structural-only` — pula o check de contradições (LLM), mais rápido e gratuito

Ao finalizar, mostre um resumo dos resultados: erros, warnings e sugestões encontradas. Indique o path do relatório gerado em `kb/calendar/lint/`.
