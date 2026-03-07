# AB Hub - Analytics de Tendencia

Painel de analytics com graficos de evolucao temporal, metricas agregadas por agente/periodo e deteccao de anomalias.

---

## 1. Objetivo

- Graficos de tendencia: conversas/dia, heartbeats ok/erro, tempo medio de resposta, tokens consumidos
- Filtros por agente, periodo e tipo de acao
- Deteccao automatica de anomalias (pico de erros, queda de atividade)
- Metricas de efetividade dos agentes ao longo do tempo
- Resolver D-031 (sem analytics de tendencia), D-022 (metricas de efetividade), G-031 (graficos tendencia), G-021 (analytics performance)

---

## 2. Schema DB

### 2.1 Nova Tabela: `analytics_daily`

Agregacao diaria de metricas operacionais por agente. Populada incrementalmente ou via job diario.

```sql
CREATE TABLE IF NOT EXISTS analytics_daily (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  date                TEXT NOT NULL,             -- 'YYYY-MM-DD'
  agent_id            TEXT NOT NULL,
  heartbeats_total    INTEGER NOT NULL DEFAULT 0,
  heartbeats_ok       INTEGER NOT NULL DEFAULT 0,
  heartbeats_error    INTEGER NOT NULL DEFAULT 0,
  heartbeats_skipped  INTEGER NOT NULL DEFAULT 0,
  conversations       INTEGER NOT NULL DEFAULT 0,
  messages_in         INTEGER NOT NULL DEFAULT 0,
  messages_out        INTEGER NOT NULL DEFAULT 0,
  cron_total          INTEGER NOT NULL DEFAULT 0,
  cron_ok             INTEGER NOT NULL DEFAULT 0,
  cron_error          INTEGER NOT NULL DEFAULT 0,
  avg_response_ms     REAL,                      -- tempo medio de resposta em ms
  UNIQUE(date, agent_id)
);

CREATE INDEX idx_analytics_daily_date ON analytics_daily(date);
CREATE INDEX idx_analytics_daily_agent ON analytics_daily(agent_id);
```

### 2.2 Populacao

Inserir/atualizar em `analytics_daily` nos mesmos pontos de integracao do heartbeat, conversa e cron (apos conclusao de cada operacao). Usar `INSERT ... ON CONFLICT DO UPDATE` para incrementar contadores.

Para `avg_response_ms`: manter soma e count, calcular media no UPDATE.

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/analytics/overview` | Metricas agregadas do periodo |
| GET | `/analytics/trend` | Serie temporal para graficos |
| GET | `/analytics/agents` | Ranking de agentes por metricas |

### 3.1 GET `/analytics/overview`

**Query params:**

| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `from` | string | 7 dias atras | Data inicio |
| `to` | string | hoje | Data fim |
| `agent_id` | string | — | Filtrar por agente |

**Response:**

```json
{
  "heartbeats": { "total": 840, "ok": 790, "error": 42, "skipped": 8, "errorRate": 0.05 },
  "conversations": { "total": 28, "messagesIn": 156, "messagesOut": 142 },
  "cron": { "total": 56, "ok": 54, "error": 2, "errorRate": 0.036 },
  "avgResponseMs": 2340,
  "comparison": {
    "heartbeatErrorRateDelta": -0.02,
    "conversationsDelta": 4,
    "avgResponseMsDelta": -150
  }
}
```

O campo `comparison` compara com o periodo anterior de mesma duracao (ex: se filtro = 7 dias, compara com os 7 dias antes).

### 3.2 GET `/analytics/trend`

**Query params:**

| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `from` | string | 7 dias atras | Data inicio |
| `to` | string | hoje | Data fim |
| `metric` | string | `heartbeats` | `heartbeats`, `conversations`, `errors`, `response_time` |
| `agent_id` | string | — | Filtrar por agente |

**Response:**

```json
{
  "metric": "heartbeats",
  "points": [
    { "date": "2026-03-01", "ok": 110, "error": 5, "skipped": 1 },
    { "date": "2026-03-02", "ok": 115, "error": 8, "skipped": 0 }
  ]
}
```

### 3.3 GET `/analytics/agents`

Ranking de agentes por metricas no periodo. Response:

```json
{
  "agents": [
    {
      "agentId": "system.main",
      "heartbeats": 500,
      "errorRate": 0.03,
      "conversations": 20,
      "avgResponseMs": 1800,
      "costUsd": 8.20
    }
  ]
}
```

---

## 4. Telas

### 4.1 Pagina de Analytics (`/analytics`)

**Rota nova.**

**Layout desktop:**

```
+---sidebar---+--------content-------------------+
| ...         | Analytics                         |
| >Analytics  |                                   |
| ...         | [Periodo: ___] [Agente: ___]      |
|             |                                   |
|             | [Heartbeats] [Conversas] [Erros]   |
|             | [Resp. Media]  cards de resumo     |
|             |                                   |
|             | Tendencias                         |
|             | [tabs: Heartbeats|Conversas|Erros] |
|             | [grafico de area/linha]            |
|             |                                   |
|             | Ranking de Agentes                 |
|             | [tabela comparativa]               |
+-------------+-----------------------------------+
```

**Layout mobile:** Stack vertical, graficos em largura total. Tabs de metricas com scroll horizontal.

### 4.2 Filtros

| Filtro | Tipo | Opcoes |
|--------|------|--------|
| Periodo | Date range | 7 dias, 30 dias, 90 dias, custom |
| Agente | Select | Todos / lista de agentes |

Query params: `?from=2026-02-28&to=2026-03-07&agent=system.main`

### 4.3 Cards de Resumo

Quatro cards com indicador de variacao (delta vs periodo anterior):

| Card | Valor | Delta | Descricao |
|------|-------|-------|-----------|
| Heartbeats | `790 ok` | `+5%` verde ou `-3%` vermelho | Taxa de erro no subtexto |
| Conversas | `28` | `+4` | Mensagens trocadas no subtexto |
| Taxa de Erro | `5%` | `-2pp` | Combinado heartbeat + cron |
| Tempo de Resposta | `2.3s` | `-150ms` | Media do periodo |

Seta para cima verde = melhoria, seta para baixo vermelha = piora. Logica invertida para erro e tempo (menos = melhor).

### 4.4 Graficos de Tendencia

Tabs selecionando metrica:

| Tab | Grafico | Series |
|-----|---------|--------|
| Heartbeats | Stacked area | ok (verde), error (vermelho), skipped (cinza) |
| Conversas | Line chart | total conversas, mensagens |
| Erros | Bar chart | heartbeat errors + cron errors |
| Tempo de Resposta | Line chart | avg_response_ms com area |

Todos usando shadcn Chart (Recharts).

### 4.5 Ranking de Agentes

Tabela comparativa:

| Coluna | Descricao |
|--------|-----------|
| Agente | Nome/ID com badge |
| Heartbeats | Total no periodo |
| Taxa de Erro | % com badge de cor |
| Conversas | Total |
| Resp. Media | ms com indicador |
| Custo | USD (link para `/costs?agent=X`) |

Ordenavel por qualquer coluna.

---

## 5. Componentes

### 5.1 AnalyticsPage

**Localizacao:** `routes/_authenticated/analytics/index.tsx`

### 5.2 AnalyticsSummaryCards

**Localizacao:** `components/analytics/analytics-summary-cards.tsx`

```typescript
interface AnalyticsSummaryCardsProps {
  overview: AnalyticsOverview;
}
```

### 5.3 AnalyticsTrendChart

**Localizacao:** `components/analytics/analytics-trend-chart.tsx`

```typescript
interface AnalyticsTrendChartProps {
  metric: "heartbeats" | "conversations" | "errors" | "response_time";
  points: Array<Record<string, number | string>>;
}
```

### 5.4 AgentRankingTable

**Localizacao:** `components/analytics/agent-ranking-table.tsx`

### 5.5 API Module

**Localizacao:** `api/analytics.ts`

```typescript
export const analyticsOverviewQueryOptions = (params: { from: string; to: string; agentId?: string }) =>
  queryOptions({
    queryKey: ["analytics", "overview", params],
    queryFn: () => request<AnalyticsOverview>(`/analytics/overview?${...}`),
  });

export const analyticsTrendQueryOptions = (params: { from: string; to: string; metric: string; agentId?: string }) =>
  queryOptions({
    queryKey: ["analytics", "trend", params],
    queryFn: () => request<AnalyticsTrend>(`/analytics/trend?${...}`),
  });

export const analyticsAgentsQueryOptions = (params: { from: string; to: string }) =>
  queryOptions({
    queryKey: ["analytics", "agents", params],
    queryFn: () => request<AgentRanking>(`/analytics/agents?${...}`),
  });
```

---

## 6. Navegacao

Adicionar "Analytics" ao menu lateral:

| Item | Icone | Rota |
|------|-------|------|
| Analytics | TrendingUp | `/analytics` |

Posicionar junto com "Custos" em secao de analytics/observabilidade.

---

## 7. Criterios de Aceite

- [ ] Tabela `analytics_daily` criada e populada incrementalmente a cada operacao
- [ ] Rota `/analytics` renderiza pagina com filtros de periodo e agente
- [ ] Cards de resumo exibem metricas com deltas vs periodo anterior
- [ ] Grafico de heartbeats mostra stacked area (ok/error/skipped)
- [ ] Grafico de conversas mostra evolucao temporal
- [ ] Grafico de erros mostra barras agrupadas
- [ ] Grafico de tempo de resposta mostra linha com area
- [ ] Tabs alternam entre metricas sem reload
- [ ] Ranking de agentes exibe tabela ordenavel
- [ ] Filtros refletidos em query params
- [ ] Indicadores de variacao (delta) com cor semantica
- [ ] Responsivo: graficos em largura total no mobile

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| analytics_daily + populacao | D-031 (sem tendencia), D-022 (sem metricas efetividade) |
| AnalyticsSummaryCards | G-021 (metricas performance), G-031 (metricas agregadas) |
| AnalyticsTrendChart | D-031 (evolucao temporal), G-031 (graficos tendencia) |
| AgentRankingTable | D-022 (efetividade por agente), G-021 (filtros por agente) |
| Comparacao periodo anterior | D-031 (o agente melhora?), G-031 (anomaly detection) |
