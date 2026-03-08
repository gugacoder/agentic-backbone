# S-040 — Agent Performance Benchmarking

Ao publicar nova versão de SOUL.md/CONVERSATION.md, rodar automaticamente golden sets de eval e comparar score da versão anterior vs. nova. Dashboard de tendência de qualidade com alertas de regressão.

**Resolve:** G-061 (agent performance benchmarking automático)
**Score de prioridade:** 7
**Dependência:** Config versioning (Sprint 5, implementado) + Eval runs/LLM-as-judge (Sprint anterior, implementado)

---

## 1. Objetivo

- Integrar benchmarking automático no ciclo de config versioning existente
- Ao detectar nova versão de `SOUL.md` ou `CONVERSATION.md`, disparar run de benchmark com golden sets disponíveis
- Dashboard de tendência de score ao longo de versões do agente
- Alertas configuráveis se nova versão regride score abaixo de threshold
- Comparação side-by-side de respostas: versão anterior vs. nova

---

## 2. Schema DB

### 2.1 Tabela `benchmark_runs`

```sql
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id              TEXT PRIMARY KEY,             -- uuid v4
  agent_id        TEXT NOT NULL,
  trigger         TEXT NOT NULL,                -- 'manual' | 'version_change'
  version_from    TEXT,                         -- hash/label da versão anterior
  version_to      TEXT NOT NULL,               -- hash/label da versão atual
  eval_set_id     TEXT NOT NULL,               -- ID do golden set usado
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | failed
  score_before    REAL,                         -- score da versão anterior (null se primeira run)
  score_after     REAL,
  delta           REAL,                         -- score_after - score_before
  regression      INTEGER NOT NULL DEFAULT 0,  -- 1 se houve regressão
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
```

### 2.2 Tabela `benchmark_cases`

```sql
CREATE TABLE IF NOT EXISTS benchmark_cases (
  id              TEXT PRIMARY KEY,
  benchmark_id    TEXT NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  case_id         TEXT NOT NULL,               -- ID do caso no golden set
  input           TEXT NOT NULL,
  expected        TEXT NOT NULL,
  response_before TEXT,                        -- resposta da versão anterior
  response_after  TEXT NOT NULL,               -- resposta da versão atual
  score_before    REAL,
  score_after     REAL,
  delta           REAL,
  judge_reasoning TEXT                         -- reasoning do LLM-as-judge
);

CREATE INDEX idx_benchmark_cases_benchmark ON benchmark_cases(benchmark_id);
```

---

## 3. Integração com Config Versioning

### 3.1 Gatilho automático

O módulo de config versioning existente emite um evento quando detecta mudança em `SOUL.md` ou `CONVERSATION.md` de um agente. O módulo de benchmarking se inscreve neste evento:

```typescript
eventBus.on('config:version_changed', async ({ agentId, file, versionFrom, versionTo }) => {
  if (!['SOUL.md', 'CONVERSATION.md'].includes(file)) return

  const evalSets = await getAgentEvalSets(agentId)
  if (evalSets.length === 0) return  // sem golden sets, skip silencioso

  const config = await getBenchmarkConfig(agentId)
  if (!config.auto_benchmark) return  // benchmark automático desabilitado

  await scheduleBenchmarkRun(agentId, evalSets[0].id, versionFrom, versionTo)
})
```

### 3.2 Execução do benchmark

1. Cria registro em `benchmark_runs` com status `pending`
2. Para cada caso no golden set:
   a. Executa o agente com `versionTo` (versão atual) e o input do caso
   b. Se `versionFrom` disponível: busca resposta anterior do histórico de eval runs ou executa novamente
   c. Envia ambas as respostas ao LLM-as-judge (mesmo mecanismo de eval runs existente)
   d. Armazena resultado em `benchmark_cases`
3. Calcula score agregado e delta
4. Detecta regressão: `delta < -threshold` (configurável por agente, padrão: -0.05)
5. Se regressão: emite alerta via EventBus e notificação push (PWA)
6. Atualiza `benchmark_runs` com status `done` e scores finais

---

## 4. Configuração por Agente

Frontmatter em `AGENT.md`:

```yaml
benchmark:
  auto_benchmark: true          # disparar ao detectar mudança de versão
  eval_set_id: "golden-set-v1"  # golden set padrão (omitir = usar o mais recente)
  regression_threshold: -0.05   # delta mínimo para alertar (−5%)
  alert_on_regression: true     # enviar notificação push se regredir
```

---

## 5. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/benchmarks` | Listar benchmark runs do agente |
| POST | `/agents/:id/benchmarks` | Disparar benchmark manual |
| GET | `/agents/:id/benchmarks/:runId` | Detalhes de um benchmark run |
| GET | `/agents/:id/benchmarks/:runId/cases` | Casos individuais do benchmark |
| GET | `/agents/:id/benchmarks/trend` | Tendência de score ao longo de versões |

### 5.1 POST `/agents/:id/benchmarks` — Disparar manual

**Request:**
```json
{
  "evalSetId": "golden-set-v1",
  "compareWithVersion": "abc123"   // hash da versão para comparar (opcional)
}
```

**Response 202:**
```json
{
  "benchmarkId": "bm_xyz",
  "status": "pending",
  "message": "Benchmark iniciado em background"
}
```

### 5.2 GET `/agents/:id/benchmarks/trend`

**Query params:** `limit` (default 10 últimas runs)

**Response:**
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

---

## 6. Telas (Hub)

### 6.1 `/agents/:id/benchmarks`

- Linha do tempo de benchmark runs: cada ponto = uma run, cor verde (melhora) / vermelho (regressão) / cinza (neutro)
- Tabela de runs: versão, data, score antes, score depois, delta (badge colorido), status
- Botão "Rodar benchmark agora" (trigger manual)
- Select de golden set (se múltiplos disponíveis)
- Alerta visual no topo se a run mais recente detectou regressão

### 6.2 `/agents/:id/benchmarks/:runId` — Detalhes

- Resumo: score antes/depois, delta, total de casos, passados, falhos
- Tabela de casos: input (truncado), score antes, score depois, delta, botão "Ver detalhes"
- Modal "Detalhes do caso":
  - Input completo
  - Expected output
  - Resposta versão anterior
  - Resposta versão atual
  - Score de cada lado
  - Reasoning do LLM-as-judge

### 6.3 `/agents/:id` — Badge de saúde de benchmark

- Se última run detectou regressão: badge vermelho "⚠ Regressão detectada" com link para benchmark
- Se última run melhorou: badge verde "↑ Score melhorou"
- Se nenhuma run: badge neutro "Sem benchmark"

---

## 7. Critérios de Aceite

- [ ] Mudança em `SOUL.md` ou `CONVERSATION.md` dispara benchmark automático se `auto_benchmark: true`
- [ ] Sem golden sets configurados: benchmark automático é silenciosamente ignorado
- [ ] Benchmark manual via POST `/agents/:id/benchmarks` executa e persiste resultados
- [ ] `score_before` e `score_after` calculados corretamente a partir do LLM-as-judge existente
- [ ] `regression: true` registrado quando `delta < regression_threshold`
- [ ] Notificação push enviada ao detectar regressão (integração com PWA existente)
- [ ] Linha do tempo de trend exibe histórico de scores com cores corretas
- [ ] Modal de detalhes exibe respostas antes/depois com reasoning do judge
- [ ] Badge de saúde na página do agente reflete estado da última benchmark run
- [ ] Benchmark em background não bloqueia operação normal do agente
