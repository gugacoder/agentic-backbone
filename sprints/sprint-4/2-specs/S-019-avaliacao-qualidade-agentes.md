# S-019 — Avaliacao de Qualidade de Agentes (Golden Sets + LLM-as-Judge)

Suite de avaliacao sistematica de agentes: golden sets de pares pergunta/resposta esperada, avaliacao automatica via LLM-as-judge, score historico por agente e comparacao de versoes antes de publicar.

---

## 1. Objetivo

- Permitir que operadores criem golden sets (pares entrada/saida esperada) por agente
- Disparar avaliacoes automaticas que usam LLM-as-judge para comparar resposta real vs. esperada
- Armazenar historico de scores por agente e exibir evolucao temporal
- Resolver D-034 (sem avaliacao de qualidade), G-035 (avaliacao automatica com LLM-as-judge)

---

## 2. Schema DB

### 2.1 Tabela `eval_sets`

```sql
CREATE TABLE IF NOT EXISTS eval_sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_eval_sets_agent ON eval_sets(agent_id);
```

### 2.2 Tabela `eval_cases`

```sql
CREATE TABLE IF NOT EXISTS eval_cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES eval_sets(id) ON DELETE CASCADE,
  input       TEXT NOT NULL,   -- mensagem de entrada
  expected    TEXT NOT NULL,   -- resposta esperada ideal
  tags        TEXT,            -- JSON array de strings (ex: ["saudacao","produto"])
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_eval_cases_set ON eval_cases(set_id);
```

### 2.3 Tabela `eval_runs`

```sql
CREATE TABLE IF NOT EXISTS eval_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES eval_sets(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending','running','done','error'
  score_avg   REAL,           -- 0.0 a 1.0, media de todos os casos
  total_cases INTEGER NOT NULL DEFAULT 0,
  passed      INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_eval_runs_agent ON eval_runs(agent_id);
CREATE INDEX idx_eval_runs_set ON eval_runs(set_id);
```

### 2.4 Tabela `eval_results`

```sql
CREATE TABLE IF NOT EXISTS eval_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  case_id     INTEGER NOT NULL REFERENCES eval_cases(id),
  actual      TEXT NOT NULL,   -- resposta real do agente
  score       REAL NOT NULL,   -- 0.0 a 1.0
  reasoning   TEXT,            -- justificativa do LLM-as-judge
  passed      INTEGER NOT NULL DEFAULT 0,  -- 1 se score >= 0.7
  latency_ms  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_eval_results_run ON eval_results(run_id);
```

---

## 3. API Endpoints

### 3.1 Eval Sets (CRUD)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/eval-sets` | Listar sets do agente |
| POST | `/agents/:id/eval-sets` | Criar set |
| GET | `/agents/:id/eval-sets/:setId` | Obter set com casos |
| PATCH | `/agents/:id/eval-sets/:setId` | Atualizar set |
| DELETE | `/agents/:id/eval-sets/:setId` | Remover set |

### 3.2 Eval Cases (CRUD)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/agents/:id/eval-sets/:setId/cases` | Adicionar caso |
| PATCH | `/agents/:id/eval-sets/:setId/cases/:caseId` | Atualizar caso |
| DELETE | `/agents/:id/eval-sets/:setId/cases/:caseId` | Remover caso |

### 3.3 Eval Runs

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/agents/:id/eval-sets/:setId/runs` | Disparar avaliacao |
| GET | `/agents/:id/eval-runs` | Historico de runs do agente |
| GET | `/agents/:id/eval-runs/:runId` | Detalhes do run com resultados |

#### POST `/agents/:id/eval-sets/:setId/runs` — Payload e Response

**Payload:** `{}` (sem parametros obrigatorios; inicia run com todos os casos ativos do set)

**Response imediata (202 Accepted):**

```json
{
  "runId": 42,
  "status": "pending",
  "totalCases": 10
}
```

O run eh executado em background pelo backend:
1. Para cada caso do set, enviar `input` para o agente via `runAgent()` (modo conversa sem persistir sessao)
2. Passar `actual` + `expected` para LLM-as-judge com prompt padrao (ver 3.4)
3. Armazenar score e reasoning em `eval_results`
4. Ao concluir, atualizar `eval_runs` com `score_avg`, `passed`, `failed`, `status: done`

#### GET `/agents/:id/eval-runs` — Response

```json
{
  "runs": [
    {
      "id": 42,
      "setId": 5,
      "setName": "FAQ Produto",
      "status": "done",
      "scoreAvg": 0.82,
      "totalCases": 10,
      "passed": 8,
      "failed": 2,
      "finishedAt": "2026-03-07T20:00:00Z"
    }
  ]
}
```

### 3.4 Prompt LLM-as-Judge

O judge usa o mesmo modelo configurado no plano `conversation` do `llm.json`. Prompt fixo:

```
Voce eh um avaliador de qualidade de respostas de agentes de IA.

Dado o seguinte contexto:
- Entrada do usuario: {input}
- Resposta esperada: {expected}
- Resposta real do agente: {actual}

Avalie a qualidade da resposta real em relacao a esperada numa escala de 0.0 a 1.0, onde:
- 1.0 = semanticamente equivalente ou melhor
- 0.7 = resposta correta mas incompleta ou com palavras diferentes
- 0.4 = parcialmente correta, informacoes importantes ausentes
- 0.0 = incorreta ou irrelevante

Responda APENAS com JSON no formato: {"score": 0.85, "reasoning": "..."}
```

---

## 4. Telas

### 4.1 Aba Avaliacao na pagina do agente (`/agents/:id/evaluation`)

Nova aba na pagina do agente, apos as abas existentes.

**Layout:**

```
+-- tabs do agente ---------------------+
| Identidade | Heartbeat | ... | Avaliacao |
+--------------------------------------+
| [+ Novo Set]                         |
|                                      |
| FAQ Produto                    [Run] |
| 10 casos — ultimo score: 82%   [...] |
|                                      |
| Testes de Saudacao             [Run] |
| 5 casos — sem runs ainda       [...] |
+--------------------------------------+
```

### 4.2 Dialog de Set (`EvalSetDialog`)

Criar/editar set com campos: `name`, `description`.

Lista de casos com tabela:

| Campo | Tipo |
|-------|------|
| Entrada | Textarea (multiline) |
| Resposta esperada | Textarea (multiline) |
| Tags | Input chips (separado por virgula) |
| Acoes | Editar, Remover |

Botao "Adicionar caso" appends nova linha editavel.

### 4.3 Pagina de Run (`/agents/:id/eval-runs/:runId`)

**Layout:**

```
Score Geral: 82%   Casos: 10   Aprovados: 8   Reprovados: 2

[Tabela de resultados]
| Entrada           | Esperado    | Real        | Score | Status |
| Oi, voces atendem...| Sim, atend...| Sim! Nosso...| 0.95 | OK    |
| Qual o preco?     | R$ 99/mes  | Nao sei...  | 0.10  | FALHA |
```

Linha reprovada (score < 0.7) em destaque vermelho. Clicar expande `reasoning` do judge.

Botao "Exportar para golden set" na linha reprovada — adiciona `input`+`actual` como novo caso esperado editavel.

### 4.5 Historico de Runs (`/agents/:id/evaluation`)

Lista de runs com score_avg como badge colorido:
- Verde: >= 0.8
- Amarelo: 0.5-0.79
- Vermelho: < 0.5

---

## 5. Componentes

| Componente | Localizacao |
|------------|-------------|
| `EvalTab` | `routes/_authenticated/agents/$agentId/evaluation.tsx` |
| `EvalSetCard` | `components/evaluation/eval-set-card.tsx` |
| `EvalSetDialog` | `components/evaluation/eval-set-dialog.tsx` |
| `EvalCaseTable` | `components/evaluation/eval-case-table.tsx` |
| `EvalRunPage` | `routes/_authenticated/agents/$agentId/eval-runs/$runId.tsx` |
| `EvalResultTable` | `components/evaluation/eval-result-table.tsx` |
| `EvalScoreBadge` | `components/evaluation/eval-score-badge.tsx` |

**API module:** `api/evaluation.ts`

```typescript
export const evalSetsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["eval-sets", agentId],
    queryFn: () => request<EvalSet[]>(`/agents/${agentId}/eval-sets`),
  });

export const evalRunsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["eval-runs", agentId],
    queryFn: () => request<EvalRun[]>(`/agents/${agentId}/eval-runs`),
  });

export const evalRunDetailQueryOptions = (agentId: string, runId: string) =>
  queryOptions({
    queryKey: ["eval-runs", agentId, runId],
    queryFn: () => request<EvalRunDetail>(`/agents/${agentId}/eval-runs/${runId}`),
  });
```

---

## 6. Criterios de Aceite

- [ ] Tabelas `eval_sets`, `eval_cases`, `eval_runs`, `eval_results` criadas e migradas
- [ ] CRUD completo de eval sets com casos via API e UI
- [ ] Disparar run executa avaliacao em background sem bloquear resposta HTTP
- [ ] LLM-as-judge avalia cada caso e armazena score + reasoning
- [ ] Aba Avaliacao visivel na pagina do agente
- [ ] Lista de sets mostra ultimo score como badge colorido
- [ ] Pagina de run exibe tabela de resultados com score por caso
- [ ] Casos reprovados (score < 0.7) destacados em vermelho
- [ ] Reasoning do judge visivel ao expandir linha reprovada
- [ ] Run com status `done` atualiza automaticamente a UI (polling ou SSE)
- [ ] Score historico de runs anteriores listado em ordem cronologica

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| eval_sets + eval_cases | D-034 (sem golden sets) |
| LLM-as-judge pipeline | G-035 (avaliacao automatica) |
| Score historico + badge | G-035 (historico de scores) |
| Export para golden set | G-038 (baixo-avaliados para golden sets) |
