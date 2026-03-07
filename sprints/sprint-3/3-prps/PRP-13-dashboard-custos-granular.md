# PRP-13 — Dashboard de Custos Granular

Painel de custos com breakdown por agente e tipo de operacao, graficos de tendencia, e alertas de orcamento configuraveis.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem dashboard de sistema (PRP-08) com card de custos mostrando total do dia (`$0.42`), mas sem breakdown por agente ou operacao. O backbone calcula `cost_usd` em heartbeats, conversas e cron jobs, mas nao persiste dados granulares. Nao ha tabela de custos historicos nem alertas de orcamento.

### Estado desejado

1. Tabela `cost_daily` com agregacao diaria por agente e operacao
2. Tabela `budget_alerts` para alertas de orcamento
3. Populacao incremental de `cost_daily` nos pontos de heartbeat, conversa e cron
4. Endpoints de custos (summary, by-agent, by-operation, trend)
5. Pagina `/costs` com cards de resumo, graficos (tendencia, por agente, por operacao) e alertas
6. Filtros por periodo e agente em query params
7. Item "Custos" no menu lateral
8. Card de custos no dashboard linkando para `/costs`

## Especificacao

### Feature F-049: Tabela cost_daily + populacao incremental

**Backend — novas tabelas em `db/`:**

```sql
CREATE TABLE IF NOT EXISTS cost_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  operation   TEXT NOT NULL,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  cost_usd    REAL NOT NULL DEFAULT 0,
  calls       INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date, agent_id, operation)
);

CREATE INDEX idx_cost_daily_date ON cost_daily(date);
CREATE INDEX idx_cost_daily_agent ON cost_daily(agent_id);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scope       TEXT NOT NULL,
  threshold   REAL NOT NULL,
  period      TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Populacao incremental** nos pontos onde `cost_usd` ja eh calculado:

| Ponto de integracao | Local no codigo | operation |
|---------------------|-----------------|-----------|
| Heartbeat concluido | `heartbeat/index.ts` (apos logHeartbeat) | `heartbeat` |
| Conversa concluida | `conversations/index.ts` (apos sendMessage completo) | `conversation` |
| Cron job concluido | `cron/index.ts` (apos execucao) | `cron` |

Usar `INSERT ... ON CONFLICT(date, agent_id, operation) DO UPDATE SET tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost_usd = cost_usd + ?, calls = calls + 1`.

### Feature F-050: Endpoints de custos + API module

**Novos endpoints em `routes/costs.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/costs/summary` | Resumo do periodo (`?from=`, `?to=`, `?agent_id=`) |
| GET | `/costs/trend` | Serie temporal (`?from=`, `?to=`, `?granularity=daily`, `?agent_id=`) |
| GET | `/budget-alerts` | Listar alertas |
| POST | `/budget-alerts` | Criar alerta (`{ scope, threshold, period }`) |
| PATCH | `/budget-alerts/:id` | Atualizar alerta |
| DELETE | `/budget-alerts/:id` | Remover alerta |

**GET `/costs/summary` response:**

```json
{
  "totalCostUsd": 12.45,
  "totalTokensIn": 234000,
  "totalTokensOut": 89000,
  "totalCalls": 456,
  "byAgent": [
    { "agentId": "system.main", "costUsd": 8.20, "tokensIn": 180000, "tokensOut": 65000, "calls": 320 }
  ],
  "byOperation": [
    { "operation": "heartbeat", "costUsd": 5.10, "calls": 280 }
  ]
}
```

**GET `/costs/trend` response:**

```json
{
  "points": [
    { "date": "2026-03-01", "costUsd": 1.20, "tokensIn": 30000, "tokensOut": 12000, "calls": 65 }
  ]
}
```

Ao inserir em `cost_daily`, verificar se algum `budget_alert` ativo foi excedido. Se sim, gerar notificacao com type `budget_exceeded` e severity `warning`.

**Hub — API module `api/costs.ts`:**

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

### Feature F-051: Pagina /costs com cards de resumo e filtros

**Nova rota** `routes/_authenticated/costs/index.tsx`:

**Filtros no topo (query params):**

| Filtro | Tipo | Opcoes |
|--------|------|--------|
| Periodo | Date range picker | Hoje, 7 dias, 30 dias, custom |
| Agente | Select | Todos / lista de agentes |

Query params: `?from=2026-03-01&to=2026-03-07&agent=system.main`

**Tres cards de resumo (components/costs/cost-summary-cards.tsx):**

| Card | Valor | Subtexto |
|------|-------|----------|
| Custo Total | `$12.45` | "no periodo selecionado" |
| Total de Chamadas | `456` | "heartbeat: 280, conversa: 150, cron: 26" |
| Tokens Consumidos | `323k` | "entrada: 234k, saida: 89k" |

**Navegacao:** Adicionar "Custos" (icone DollarSign) ao menu lateral. Atualizar card de custos do dashboard para linkar para `/costs`.

### Feature F-052: Graficos de custos (tendencia, por agente, por operacao)

**Tres graficos usando shadcn Chart (Recharts):**

| Grafico | Componente | Tipo | Dados |
|---------|------------|------|-------|
| Tendencia de custos | `components/costs/cost-trend-chart.tsx` | AreaChart | `cost_usd` por dia |
| Breakdown por agente | `components/costs/cost-by-agent-chart.tsx` | BarChart horizontal | `cost_usd` por `agent_id` |
| Breakdown por operacao | `components/costs/cost-by-operation-chart.tsx` | PieChart/donut | `cost_usd` por `operation` |

Layout desktop: grid. Layout mobile: stack vertical, graficos em largura total.

### Feature F-053: Alertas de orcamento (CRUD + notificacao automatica)

**components/costs/budget-alert-list.tsx + budget-alert-form.tsx:**

Lista de alertas com colunas:

| Coluna | Descricao |
|--------|-----------|
| Escopo | "Global" ou nome do agente |
| Limite | Valor em USD |
| Periodo | Diario / Semanal / Mensal |
| Status | Ativo/Inativo (toggle) |
| Acoes | Editar, Excluir |

Botao "Novo alerta" abre dialog com formulario (React Hook Form + Zod).

Quando alerta eh excedido, gera notificacao automatica (reutiliza sistema de notificacoes do PRP-12).

## Limites

- **NAO** implementar comparador de planos LLM — apenas breakdown de custos.
- **NAO** usar polling — atualizacao via invalidacao de queries apos mutacoes.
- **NAO** implementar filtragem por operacao (apenas por agente e periodo).
- **NAO** implementar export de dados de custos (futuro).

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-08** (Dashboard de Sistema) deve estar implementado — card de custos linka para `/costs`.
- **PRP-12** (Notificacoes) deve estar implementado — alerta excedido gera notificacao.

## Validacao

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
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-049 cost_daily + populacao | S-013 sec 2 | D-030, D-014 |
| F-050 Endpoints custos | S-013 sec 3 | G-030, G-014 |
| F-051 Pagina /costs + cards | S-013 sec 4.1-4.3 | D-030, G-030 |
| F-052 Graficos custos | S-013 sec 4.4 | D-031, G-030 |
| F-053 Budget alerts | S-013 sec 4.5 | G-030, G-014 |
