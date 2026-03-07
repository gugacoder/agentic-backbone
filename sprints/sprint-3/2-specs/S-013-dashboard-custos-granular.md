# AB Hub - Dashboard de Custos Granular

Painel de custos com breakdown por agente e tipo de operacao, tendencias de gasto e alertas de orcamento.

---

## 1. Objetivo

- Exibir custos detalhados por agente, por tipo de operacao (heartbeat, conversa, cron) e por periodo
- Graficos de tendencia de gastos (diario, semanal, mensal)
- Alertas de orcamento configuraveis
- Comparacao entre planos LLM com economia potencial
- Resolver D-030 (custos opacos por agente), D-014 (falta de visibilidade de custos), G-030 (dashboard granular), G-014 (breakdown por agente/tarefa)

---

## 2. Schema DB

### 2.1 Nova Tabela: `cost_daily`

Agregacao diaria de custos por agente e tipo de operacao, preenchida pelo backend ao final de cada operacao.

```sql
CREATE TABLE IF NOT EXISTS cost_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,             -- 'YYYY-MM-DD'
  agent_id    TEXT NOT NULL,             -- ex: 'system.main'
  operation   TEXT NOT NULL,             -- 'heartbeat', 'conversation', 'cron'
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  cost_usd    REAL NOT NULL DEFAULT 0,
  calls       INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date, agent_id, operation)
);

CREATE INDEX idx_cost_daily_date ON cost_daily(date);
CREATE INDEX idx_cost_daily_agent ON cost_daily(agent_id);
```

### 2.2 Nova Tabela: `budget_alerts`

```sql
CREATE TABLE IF NOT EXISTS budget_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scope       TEXT NOT NULL,             -- 'global' ou agent_id
  threshold   REAL NOT NULL,             -- valor em USD
  period      TEXT NOT NULL,             -- 'daily', 'weekly', 'monthly'
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.3 Populacao de `cost_daily`

Inserir/atualizar registros em `cost_daily` nos pontos onde `cost_usd` ja eh calculado:

| Ponto de integracao | Local no codigo | operation |
|---------------------|-----------------|-----------|
| Heartbeat concluido | `heartbeat/index.ts` (apos logHeartbeat) | `heartbeat` |
| Conversa concluida | `conversations/index.ts` (apos sendMessage completo) | `conversation` |
| Cron job concluido | `cron/index.ts` (apos execucao) | `cron` |

Usar `INSERT ... ON CONFLICT(date, agent_id, operation) DO UPDATE SET tokens_in = tokens_in + ?, ...` para agregar incrementalmente.

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/costs/summary` | Resumo de custos do periodo |
| GET | `/costs/by-agent` | Breakdown por agente |
| GET | `/costs/by-operation` | Breakdown por tipo de operacao |
| GET | `/costs/trend` | Serie temporal para graficos |
| GET | `/budget-alerts` | Listar alertas de orcamento |
| POST | `/budget-alerts` | Criar alerta |
| PATCH | `/budget-alerts/:id` | Atualizar alerta |
| DELETE | `/budget-alerts/:id` | Remover alerta |

### 3.1 GET `/costs/summary`

**Query params:**

| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `from` | string (YYYY-MM-DD) | hoje | Data inicio |
| `to` | string (YYYY-MM-DD) | hoje | Data fim |
| `agent_id` | string | — | Filtrar por agente |

**Response:**

```json
{
  "totalCostUsd": 12.45,
  "totalTokensIn": 234000,
  "totalTokensOut": 89000,
  "totalCalls": 456,
  "byAgent": [
    { "agentId": "system.main", "costUsd": 8.20, "tokensIn": 180000, "tokensOut": 65000, "calls": 320 },
    { "agentId": "system.monitor", "costUsd": 4.25, "tokensIn": 54000, "tokensOut": 24000, "calls": 136 }
  ],
  "byOperation": [
    { "operation": "heartbeat", "costUsd": 5.10, "calls": 280 },
    { "operation": "conversation", "costUsd": 6.35, "calls": 150 },
    { "operation": "cron", "costUsd": 1.00, "calls": 26 }
  ]
}
```

### 3.2 GET `/costs/trend`

**Query params:**

| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `from` | string | 7 dias atras | Data inicio |
| `to` | string | hoje | Data fim |
| `granularity` | string | `daily` | `daily` ou `weekly` |
| `agent_id` | string | — | Filtrar por agente |

**Response:**

```json
{
  "points": [
    { "date": "2026-03-01", "costUsd": 1.20, "tokensIn": 30000, "tokensOut": 12000, "calls": 65 },
    { "date": "2026-03-02", "costUsd": 1.85, "tokensIn": 42000, "tokensOut": 18000, "calls": 78 }
  ]
}
```

### 3.3 POST `/budget-alerts`

**Payload:**

```json
{
  "scope": "global",
  "threshold": 10.00,
  "period": "daily"
}
```

Ao inserir registro em `cost_daily`, verificar se algum alerta ativo foi excedido. Se sim, gerar notificacao com type `budget_exceeded` e severity `warning`.

---

## 4. Telas

### 4.1 Pagina de Custos (`/costs`)

**Rota nova.** Acessivel pelo menu lateral e pelo card de custos do dashboard.

**Layout desktop:**

```
+---sidebar---+--------content-------------------+
| ...         | Custos                            |
| >Custos     |                                   |
| ...         | [Periodo: ___] [Agente: ___]      |
|             |                                   |
|             | [Total] [Por Agente] [Por Op]      |
|             |   $12.45   cards resumo            |
|             |                                   |
|             | Tendencia de Custos                |
|             | [grafico de area]                  |
|             |                                   |
|             | Breakdown por Agente               |
|             | [grafico de barras horizontal]     |
|             |                                   |
|             | Breakdown por Operacao             |
|             | [grafico de pizza/donut]           |
|             |                                   |
|             | Alertas de Orcamento               |
|             | [lista + botao criar]              |
+-------------+-----------------------------------+
```

**Layout mobile:** Stack vertical, graficos em largura total.

### 4.2 Filtros

| Filtro | Tipo | Opcoes |
|--------|------|--------|
| Periodo | Date range picker | Hoje, 7 dias, 30 dias, custom |
| Agente | Select | Todos / lista de agentes |

Filtros em query params: `?from=2026-03-01&to=2026-03-07&agent=system.main`

### 4.3 Cards de Resumo

Tres cards no topo:

| Card | Valor | Subtexto |
|------|-------|----------|
| Custo Total | `$12.45` | "no periodo selecionado" |
| Total de Chamadas | `456` | "heartbeat: 280, conversa: 150, cron: 26" |
| Tokens Consumidos | `323k` | "entrada: 234k, saida: 89k" |

### 4.4 Graficos

| Grafico | Tipo | Dados |
|---------|------|-------|
| Tendencia de custos | Area chart (Recharts) | `cost_usd` por dia |
| Breakdown por agente | Bar chart horizontal | `cost_usd` por `agent_id` |
| Breakdown por operacao | Pie/donut chart | `cost_usd` por `operation` |

### 4.5 Alertas de Orcamento

Lista de alertas configurados com:

| Coluna | Descricao |
|--------|-----------|
| Escopo | "Global" ou nome do agente |
| Limite | Valor em USD |
| Periodo | Diario / Semanal / Mensal |
| Status | Ativo/Inativo (toggle) |
| Acoes | Editar, Excluir |

Botao "Novo alerta" abre dialog/drawer com formulario.

---

## 5. Componentes

### 5.1 CostsPage

**Localizacao:** `routes/_authenticated/costs/index.tsx`

### 5.2 CostSummaryCards

**Localizacao:** `components/costs/cost-summary-cards.tsx`

```typescript
interface CostSummaryCardsProps {
  totalCostUsd: number;
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
}
```

### 5.3 CostTrendChart

**Localizacao:** `components/costs/cost-trend-chart.tsx`

```typescript
interface CostTrendChartProps {
  points: Array<{ date: string; costUsd: number; calls: number }>;
}
```

- Usa shadcn Chart (Recharts AreaChart)

### 5.4 CostByAgentChart

**Localizacao:** `components/costs/cost-by-agent-chart.tsx`

- Recharts BarChart horizontal

### 5.5 CostByOperationChart

**Localizacao:** `components/costs/cost-by-operation-chart.tsx`

- Recharts PieChart/donut

### 5.6 BudgetAlertList

**Localizacao:** `components/costs/budget-alert-list.tsx`

### 5.7 BudgetAlertForm

**Localizacao:** `components/costs/budget-alert-form.tsx`

- Dialog/Drawer com React Hook Form + Zod

### 5.8 API Module

**Localizacao:** `api/costs.ts`

```typescript
export const costSummaryQueryOptions = (params: { from: string; to: string; agentId?: string }) =>
  queryOptions({
    queryKey: ["costs", "summary", params],
    queryFn: () => request<CostSummary>(`/costs/summary?${...}`),
  });

export const costTrendQueryOptions = (params: { from: string; to: string; granularity?: string; agentId?: string }) =>
  queryOptions({
    queryKey: ["costs", "trend", params],
    queryFn: () => request<CostTrend>(`/costs/trend?${...}`),
  });

export const budgetAlertsQueryOptions = () =>
  queryOptions({
    queryKey: ["budget-alerts"],
    queryFn: () => request<BudgetAlert[]>("/budget-alerts"),
  });
```

---

## 6. Navegacao

Adicionar "Custos" ao menu lateral:

| Item | Icone | Rota |
|------|-------|------|
| Custos | DollarSign | `/costs` |

Posicionar apos "Dashboard" ou em secao "Analytics".

Atualizar card de custos do dashboard (`/`) para linkar para `/costs`.

---

## 7. Criterios de Aceite

- [ ] Tabela `cost_daily` criada e populada incrementalmente a cada heartbeat, conversa e cron
- [ ] Rota `/costs` renderiza pagina de custos com filtros de periodo e agente
- [ ] Cards de resumo exibem totais corretos do periodo
- [ ] Grafico de tendencia exibe serie temporal de custos
- [ ] Breakdown por agente mostra custo de cada agente em bar chart
- [ ] Breakdown por operacao mostra distribuicao em pie/donut chart
- [ ] Filtros refletidos em query params (URL compartilhavel)
- [ ] Alertas de orcamento: criar, editar, ativar/desativar, excluir
- [ ] Alerta excedido gera notificacao automatica (type `budget_exceeded`)
- [ ] Menu lateral inclui "Custos" com link funcional
- [ ] Card de custos no dashboard linka para `/costs`
- [ ] Responsivo: mobile stack vertical, desktop grid

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| cost_daily + populacao | D-030 (custos opacos), D-014 (visibilidade custos) |
| CostSummaryCards | G-030 (breakdown granular), G-014 (breakdown por agente) |
| CostTrendChart | D-031 (tendencia), G-030 (tendencias) |
| CostByAgentChart | D-030 (custo por agente), G-014 (breakdown) |
| CostByOperationChart | D-030 (custo por operacao) |
| BudgetAlerts | G-030 (budget alerts), G-014 (budget alerts) |
