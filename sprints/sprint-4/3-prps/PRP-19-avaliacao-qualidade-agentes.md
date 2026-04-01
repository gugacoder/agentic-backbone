# PRP-19 — Avaliacao de Qualidade de Agentes (Golden Sets + LLM-as-Judge)

Suite de avaliacao sistematica de agentes: golden sets de pares entrada/saida esperada, avaliacao automatica via LLM-as-judge, score historico por agente e pagina de resultados detalhada.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone nao possui nenhum mecanismo para avaliar a qualidade das respostas de agentes. Operadores nao tem como medir se um agente esta respondendo corretamente antes de publicar mudancas de SOUL.md ou prompts. Nao ha tabelas de avaliacao no SQLite nem endpoints relacionados.

### Estado desejado

1. Tabelas `eval_sets`, `eval_cases`, `eval_runs`, `eval_results` no SQLite
2. CRUD completo de eval sets e casos via API
3. Endpoint para disparar run de avaliacao (background) com LLM-as-judge
4. Aba "Avaliacao" na pagina do agente no Hub
5. Pagina de detalhe de run com tabela de resultados por caso

## Especificacao

### Feature F-075: Tabelas de avaliacao + migracao DB

**Novas tabelas em `apps/backbone/src/db/`:**

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

CREATE TABLE IF NOT EXISTS eval_cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES eval_sets(id) ON DELETE CASCADE,
  input       TEXT NOT NULL,
  expected    TEXT NOT NULL,
  tags        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_eval_cases_set ON eval_cases(set_id);

CREATE TABLE IF NOT EXISTS eval_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id      INTEGER NOT NULL REFERENCES eval_sets(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  score_avg   REAL,
  total_cases INTEGER NOT NULL DEFAULT 0,
  passed      INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_eval_runs_agent ON eval_runs(agent_id);
CREATE INDEX idx_eval_runs_set ON eval_runs(set_id);

CREATE TABLE IF NOT EXISTS eval_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  case_id     INTEGER NOT NULL REFERENCES eval_cases(id),
  actual      TEXT NOT NULL,
  score       REAL NOT NULL,
  reasoning   TEXT,
  passed      INTEGER NOT NULL DEFAULT 0,
  latency_ms  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_eval_results_run ON eval_results(run_id);
```

Adicionar migracao no startup do backbone (arquivo `db/migrations.ts` ou equivalente existente).

### Feature F-076: Endpoints CRUD de eval sets e cases + API module Hub

**Novas rotas em `apps/backbone/src/routes/evaluation.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/eval-sets` | Listar sets do agente |
| POST | `/agents/:id/eval-sets` | Criar set (`{ name, description }`) |
| GET | `/agents/:id/eval-sets/:setId` | Obter set com lista de casos |
| PATCH | `/agents/:id/eval-sets/:setId` | Atualizar set |
| DELETE | `/agents/:id/eval-sets/:setId` | Remover set (cascade deleta casos e runs) |
| POST | `/agents/:id/eval-sets/:setId/cases` | Adicionar caso (`{ input, expected, tags? }`) |
| PATCH | `/agents/:id/eval-sets/:setId/cases/:caseId` | Atualizar caso |
| DELETE | `/agents/:id/eval-sets/:setId/cases/:caseId` | Remover caso |

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/evaluation.ts`:**

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

### Feature F-077: Pipeline LLM-as-judge + endpoints de eval runs

**Novos endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/agents/:id/eval-sets/:setId/runs` | Disparar run (202 Accepted, executa em background) |
| GET | `/agents/:id/eval-runs` | Historico de runs do agente |
| GET | `/agents/:id/eval-runs/:runId` | Detalhe do run com resultados |

**Background pipeline** (executado apos retornar 202):

1. Criar `eval_runs` com `status: running`
2. Para cada `eval_case` do set: chamar `runAgent()` com o `input` (sem persistir sessao), coletar `actual`
3. Chamar LLM-as-judge com prompt fixo (modelo da configuracao `conversation` do `llm.json`):

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

4. Inserir `eval_results` com `score`, `reasoning`, `passed = score >= 0.7`
5. Ao concluir todos os casos: atualizar `eval_runs` com `score_avg`, `passed`, `failed`, `status: done`

### Feature F-078: Aba Avaliacao na pagina do agente

**Nova aba** na pagina do agente (`/agents/:id`) com rota `routes/_authenticated/agents/$agentId/evaluation.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `EvalTab` | `routes/_authenticated/agents/$agentId/evaluation.tsx` |
| `EvalSetCard` | `components/evaluation/eval-set-card.tsx` |
| `EvalSetDialog` | `components/evaluation/eval-set-dialog.tsx` |
| `EvalCaseTable` | `components/evaluation/eval-case-table.tsx` |
| `EvalScoreBadge` | `components/evaluation/eval-score-badge.tsx` |

**EvalSetCard** exibe: nome do set, quantidade de casos, ultimo score como badge colorido (verde >= 0.8, amarelo 0.5-0.79, vermelho < 0.5), botao "Run" e menu com Editar/Remover.

**EvalSetDialog** — sheet/dialog para criar/editar set:
- Campos: `name`, `description`
- Tabela de casos com colunas: Entrada (textarea), Resposta esperada (textarea), Tags (input chips), Acoes (editar, remover)
- Botao "Adicionar caso" appends linha editavel

### Feature F-079: Pagina de detalhe de run

**Nova rota** `routes/_authenticated/agents/$agentId/eval-runs/$runId.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `EvalRunPage` | `routes/_authenticated/agents/$agentId/eval-runs/$runId.tsx` |
| `EvalResultTable` | `components/evaluation/eval-result-table.tsx` |

**Layout:**

```
Score Geral: 82%   Casos: 10   Aprovados: 8   Reprovados: 2

[Tabela de resultados]
| Entrada | Esperado | Real | Score | Status |
```

- Linhas com `score < 0.7` destacadas em vermelho
- Clicar na linha expande campo `reasoning` do judge
- Botao "Exportar para golden set" em linhas reprovadas — adiciona `input`+`actual` como novo caso editavel no set

## Limites

- **NAO** implementar comparacao de versoes de agente (futuro)
- **NAO** implementar runs automaticos agendados (futuro)
- **NAO** implementar export de runs em CSV (futuro)
- **NAO** persistir sessao de conversa usada no run (runs sao stateless)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes / pagina do agente) deve estar implementado — nova aba adicionada

## Validacao

- [ ] Tabelas `eval_sets`, `eval_cases`, `eval_runs`, `eval_results` criadas via migracao
- [ ] CRUD de eval sets e casos funcional via API
- [ ] POST `/eval-sets/:setId/runs` retorna 202 e executa avaliacao em background
- [ ] LLM-as-judge avalia cada caso e armazena score + reasoning
- [ ] `eval_runs.status` atualizado para `done` ao concluir
- [ ] Aba "Avaliacao" visivel na pagina do agente
- [ ] EvalSetCard exibe ultimo score como badge colorido
- [ ] EvalSetDialog permite criar/editar set com casos inline
- [ ] Pagina de run exibe tabela de resultados com score por caso
- [ ] Casos reprovados (score < 0.7) destacados em vermelho
- [ ] Reasoning do judge visivel ao expandir linha
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-075 Tabelas de avaliacao | S-019 sec 2 | D-034 |
| F-076 CRUD eval sets e cases | S-019 sec 3.1-3.2 | D-034 |
| F-077 LLM-as-judge pipeline | S-019 sec 3.3-3.4 | G-035 |
| F-078 Aba Avaliacao + dialogs | S-019 sec 4.1-4.2, 4.5 | D-034, G-035 |
| F-079 Pagina de run + resultados | S-019 sec 4.3 | G-035, G-038 |
