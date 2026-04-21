Mostra o status do knowledge base e os comandos disponíveis.

Passos:
1. Conte os artigos em `kb/atlas/concepts/`, `kb/atlas/connections/`, `kb/effort/qa/`
2. Conte as notes em `kb/calendar/notes/`
3. Verifique se existe `kb/x/memory/state.json` e leia: último digest, total de queries, custo acumulado
4. Liste notes não digeridas (existem em `kb/calendar/notes/` mas não em `state.json.ingested`)

Mostre o status em formato conciso, e ao final liste os comandos disponíveis:

```
Comandos:
  /kb:digest    — Digere notes em artigos
  /kb:ask       — Consulta o KB
  /kb:audit     — Checa saúde do KB
  /kb:capture   — Extrai memórias da sessão atual
  /kb:note      — Registro manual nas notes do dia
  /kb:file      — Arquiva Q&A em effort/qa
  /kb:review    — Revisa código contra o KB
  /kb:check     — Valida approach contra decisões anteriores
```
