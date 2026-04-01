# PRP-40 — Agent Performance Benchmarking

Ao publicar nova versao de SOUL.md ou CONVERSATION.md, rodar automaticamente golden sets de eval e comparar score da versao anterior vs. nova. Dashboard de tendencia de qualidade com alertas de regressao.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Config versioning (Sprint 5) detecta mudancas em arquivos de configuracao do agente. Eval runs com LLM-as-judge existem. Porem, nao ha conexao automatica entre mudanca de config e execucao de evals. O operador precisa rodar manualmente e comparar resultados sem suporte de ferramenta.

### Estado desejado

1. Tabelas `benchmark_runs` e `benchmark_cases` no SQLite
2. Gatilho automatico: mudanca em `SOUL.md` ou `CONVERSATION.md` dispara benchmark run em background
3. Integracao com LLM-as-judge existente para scoring
4. Deteccao de regressao com alerta via notificacao push (PWA)
5. Dashboard de tendencia de score por versao e comparacao side-by-side de respostas

## Especificacao

### Feature F-139: Schema DB + Integracao com Config Versioning

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  trigger         TEXT NOT NULL,          -- 'manual' | 'version_change'
  version_from    TEXT,
  version_to      TEXT NOT NULL,
  eval_set_id     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
  score_before    REAL,
  score_after     REAL,
  delta           REAL,
  regression      INTEGER NOT NULL DEFAULT 0,
  cases_total     INTEGER,
  cases_passed    INTEGER,
  cases_failed    INTEGER,
  started_at      TEXT,
  completed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_benchmark_runs_agent ON benchmark_runs(agent_id);
CREATE INDEX idx_benchmark_runs_status ON benchmark_runs(status);
CREATE INDEX idx_benchmark_runs_created ON benchmark_runs(created_at);

CREATE TABLE IF NOT EXISTS benchmark_cases (
  id              TEXT PRIMARY KEY,
  benchmark_id    TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  case_id         TEXT NOT NULL,
  input           TEXT NOT NULL,
  expected        TEXT NOT NULL,
  response_before TEXT,
  response_after  TEXT NOT NULL,
  score_before    REAL,
  score_after     REAL,
  delta           REAL,
  judge_reasoning TEXT
);

CREATE INDEX idx_benchmark_cases_benchmark ON benchmark_cases(benchmark_id);
```

**Configuracao por agente (frontmatter `AGENT.md`):**

```yaml
benchmark:
  auto_benchmark: true
  eval_set_id: "golden-set-v1"       # omitir = usar o mais recente disponivel
  regression_threshold: -0.05         # delta minimo para alertar (-5%)
  alert_on_regression: true
```

**Gatilho automatico — integracao com config versioning:**

```typescript
eventBus.on('config:version_changed', async ({ agentId, file, versionFrom, versionTo }) => {
  if (!['SOUL.md', 'CONVERSATION.md'].includes(file)) return

  const evalSets = await getAgentEvalSets(agentId)
  if (evalSets.length === 0) return  // sem golden sets: skip silencioso

  const config = await getBenchmarkConfig(agentId)
  if (!config.auto_benchmark) return

  await scheduleBenchmarkRun(agentId, evalSets[0].id, versionFrom, versionTo)
})
```

**Execucao do benchmark (background):**

1. Cria registro em `benchmark_runs` com status `pending`
2. Para cada caso no golden set:
   a. Executa o agente com versao atual e o input do caso
   b. Envia resposta ao LLM-as-judge (mesmo mecanismo de eval runs existente)
   c. Armazena resultado em `benchmark_cases`
3. Calcula score agregado e delta
4. Detecta regressao: `delta < regression_threshold`
5. Se regressao: emite alerta via EventBus + notificacao push (PWA)
6. Atualiza `benchmark_runs` com status `done` e scores finais

### Feature F-140: API Endpoints de Benchmarks

**Endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/benchmarks` | Listar benchmark runs do agente |
| POST | `/agents/:id/benchmarks` | Disparar benchmark manual |
| GET | `/agents/:id/benchmarks/:runId` | Detalhes de um benchmark run |
| GET | `/agents/:id/benchmarks/:runId/cases` | Casos individuais do benchmark |
| GET | `/agents/:id/benchmarks/trend` | Tendencia de score ao longo de versoes |

**POST `/agents/:id/benchmarks` — Trigger manual:**

```json
// Request
{ "evalSetId": "golden-set-v1", "compareWithVersion": "abc123" }

// Response 202
{ "benchmarkId": "bm_xyz", "status": "pending", "message": "Benchmark iniciado em background" }
```

**GET `/agents/:id/benchmarks/trend`:**

Query params: `limit` (default: 10)

```json
{
  "agentId": "system.main",
  "trend": [
    { "version": "v1", "score": 0.82, "date": "2026-02-15", "benchmarkId": "bm_001" },
    { "version": "v2", "score": 0.85, "date": "2026-02-28", "benchmarkId": "bm_002" },
    { "version": "v3", "score": 0.79, "date": "2026-03-07", "benchmarkId": "bm_003", "regression": true }
  ]
}
```

**GET `/agents/:id/benchmarks/:runId`:**

```json
{
  "id": "bm_xyz",
  "agentId": "system.main",
  "trigger": "version_change",
  "versionFrom": "abc123",
  "versionTo": "def456",
  "evalSetId": "golden-set-v1",
  "status": "done",
  "scoreBefore": 0.82,
  "scoreAfter": 0.79,
  "delta": -0.03,
  "regression": false,
  "casesTotal": 20,
  "casesPassed": 16,
  "casesFailed": 4,
  "completedAt": "2026-03-07T15:05:00Z"
}
```

### Feature F-141: Hub — Dashboard de Benchmarks + Badge de Saude

**`/agents/:id/benchmarks` — Dashboard de benchmark runs:**

- Linha do tempo de runs: cada ponto = uma run, cor verde (melhora) / vermelho (regressao) / cinza (neutro)
- Tabela de runs: versao, data, score antes, score depois, delta (badge colorido), status
- Botao "Rodar benchmark agora" (trigger manual)
- Select de golden set (se multiplos disponiveis)
- Alerta visual no topo se a run mais recente detectou regressao

**`/agents/:id/benchmarks/:runId` — Detalhes da run:**

- Resumo: score antes/depois, delta, total de casos, passados, falhos
- Tabela de casos: input (truncado), score antes, score depois, delta, botao "Ver detalhes"
- Modal "Detalhes do caso":
  - Input completo
  - Expected output
  - Resposta versao anterior
  - Resposta versao atual
  - Score de cada lado
  - Reasoning do LLM-as-judge

**`/agents/:id` — Badge de saude de benchmark:**

- Se ultima run detectou regressao: badge vermelho "Regressao detectada" com link para benchmark
- Se ultima run melhorou: badge verde "Score melhorou"
- Se nenhuma run: badge neutro "Sem benchmark"

## Limites

- **NAO** implementar comparacao entre multiplos golden sets em uma unica run
- **NAO** implementar re-execucao da versao anterior em tempo real (usar resultado de run anterior armazenado)
- **NAO** implementar alertas por email ou Slack (apenas notificacao push PWA)

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova secao na pagina do agente
- Config versioning (Sprint 5) deve estar implementado — evento `config:version_changed`
- Eval runs / LLM-as-judge (Sprint anterior) deve estar implementado — mecanismo de scoring reutilizado
- PWA + notificacoes push devem estar habilitadas para alertas de regressao

## Validacao

- [ ] Mudanca em `SOUL.md` ou `CONVERSATION.md` dispara benchmark automatico se `auto_benchmark: true`
- [ ] Sem golden sets configurados: benchmark automatico e silenciosamente ignorado
- [ ] Benchmark manual via POST `/agents/:id/benchmarks` executa e persiste resultados
- [ ] `score_before` e `score_after` calculados corretamente a partir do LLM-as-judge existente
- [ ] `regression: true` registrado quando `delta < regression_threshold`
- [ ] Notificacao push enviada ao detectar regressao (integracao com PWA existente)
- [ ] Linha do tempo de trend exibe historico de scores com cores corretas
- [ ] Modal de detalhes exibe respostas antes/depois com reasoning do judge
- [ ] Badge de saude na pagina do agente reflete estado da ultima benchmark run
- [ ] Benchmark em background nao bloqueia operacao normal do agente
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-139 Schema DB + config versioning | S-040 sec 2-3 | G-061 |
| F-140 API endpoints benchmarks | S-040 sec 5 | G-061 |
| F-141 Hub dashboard + badge | S-040 sec 6 | G-061 |
