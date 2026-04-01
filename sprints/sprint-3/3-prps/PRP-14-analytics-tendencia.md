# PRP-14 — Analytics de Tendencia

Painel de analytics com graficos de evolucao temporal, metricas agregadas por agente/periodo, deltas vs periodo anterior e ranking de agentes.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem dashboard de sistema (PRP-08) com atividade recente e stats basicos, mas sem graficos de tendencia, sem metricas historicas agregadas, sem comparacao temporal. O backbone registra heartbeats, conversas e cron em tabelas separadas, mas nao agrega metricas diarias.

### Estado desejado

1. Tabela `analytics_daily` com agregacao diaria de metricas por agente
2. Populacao incremental nos pontos de heartbeat, conversa e cron
3. Endpoints de analytics (overview com deltas, trend, ranking de agentes)
4. Pagina `/analytics` com cards de resumo (deltas), graficos de tendencia por metrica, e ranking de agentes
5. Filtros por periodo e agente em query params
6. Item "Analytics" no menu lateral

## Especificacao

### Feature F-054: Tabela analytics_daily + populacao incremental

**Backend — nova tabela em `db/`:**

```sql
CREATE TABLE IF NOT EXISTS analytics_daily (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  date                TEXT NOT NULL,
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
  avg_response_ms     REAL,
  UNIQUE(date, agent_id)
);

CREATE INDEX idx_analytics_daily_date ON analytics_daily(date);
CREATE INDEX idx_analytics_daily_agent ON analytics_daily(agent_id);
```

**Populacao incremental** nos mesmos pontos de integracao do heartbeat, conversa e cron (apos conclusao). Usar `INSERT ... ON CONFLICT DO UPDATE` para incrementar contadores.

Para `avg_response_ms`: manter soma e count internamente, calcular media no UPDATE.

### Feature F-055: Endpoints de analytics + API module

**Novos endpoints em `routes/analytics.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/analytics/overview` | Metricas agregadas do periodo (`?from=`, `?to=`, `?agent_id=`) |
| GET | `/analytics/trend` | Serie temporal (`?from=`, `?to=`, `?metric=`, `?agent_id=`) |
| GET | `/analytics/agents` | Ranking de agentes (`?from=`, `?to=`) |

**GET `/analytics/overview` response:**

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

Campo `comparison` compara com o periodo anterior de mesma duracao.

**GET `/analytics/trend` response** (metric: `heartbeats`, `conversations`, `errors`, `response_time`):

```json
{
  "metric": "heartbeats",
  "points": [
    { "date": "2026-03-01", "ok": 110, "error": 5, "skipped": 1 }
  ]
}
```

**GET `/analytics/agents` response:**

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

**Hub — API module `api/analytics.ts`:**

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

### Feature F-056: Pagina /analytics com cards de resumo e deltas

**Nova rota** `routes/_authenticated/analytics/index.tsx`:

**Filtros (query params):**

| Filtro | Tipo | Opcoes |
|--------|------|--------|
| Periodo | Date range | 7 dias, 30 dias, 90 dias, custom |
| Agente | Select | Todos / lista de agentes |

**Quatro cards de resumo (components/analytics/analytics-summary-cards.tsx):**

| Card | Valor | Delta | Descricao |
|------|-------|-------|-----------|
| Heartbeats | `790 ok` | `+5%` verde ou `-3%` vermelho | Taxa de erro no subtexto |
| Conversas | `28` | `+4` | Mensagens trocadas no subtexto |
| Taxa de Erro | `5%` | `-2pp` | Combinado heartbeat + cron |
| Tempo de Resposta | `2.3s` | `-150ms` | Media do periodo |

Seta para cima verde = melhoria, seta para baixo vermelha = piora. Logica invertida para erro e tempo (menos = melhor).

**Navegacao:** Adicionar "Analytics" (icone TrendingUp) ao menu lateral.

### Feature F-057: Graficos de tendencia (tabs por metrica)

**components/analytics/analytics-trend-chart.tsx:**

Tabs selecionando metrica:

| Tab | Grafico | Series |
|-----|---------|--------|
| Heartbeats | Stacked area (Recharts) | ok (verde), error (vermelho), skipped (cinza) |
| Conversas | Line chart | total conversas, mensagens |
| Erros | Bar chart | heartbeat errors + cron errors |
| Tempo de Resposta | Line chart com area | avg_response_ms |

Todos usando shadcn Chart (Recharts). Layout mobile: largura total, tabs com scroll horizontal.

### Feature F-058: Ranking de agentes (tabela comparativa)

**components/analytics/agent-ranking-table.tsx:**

Tabela comparativa ordenavel:

| Coluna | Descricao |
|--------|-----------|
| Agente | Nome/ID com badge |
| Heartbeats | Total no periodo |
| Taxa de Erro | % com badge de cor |
| Conversas | Total |
| Resp. Media | ms com indicador |
| Custo | USD (link para `/costs?agent=X`) |

Ordenavel por qualquer coluna. Link de custo navega para pagina de custos filtrada pelo agente.

## Limites

- **NAO** implementar anomaly detection automatica — apenas deltas visuais.
- **NAO** implementar export de graficos ou dados.
- **NAO** implementar comparacao entre agentes (grafico overlay) — apenas ranking em tabela.
- **NAO** usar polling — queries invalidadas por mutacoes e SSE.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-13** (Custos) — coluna `costUsd` no ranking de agentes vem de `cost_daily` (PRP-13). Se PRP-13 nao estiver pronto, omitir coluna de custo no ranking.

## Validacao

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
- [ ] Menu lateral inclui "Analytics" com link funcional
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-054 analytics_daily + populacao | S-014 sec 2 | D-031, D-022 |
| F-055 Endpoints analytics | S-014 sec 3 | G-021, G-031 |
| F-056 Pagina /analytics + cards | S-014 sec 4.1-4.3 | G-031, G-021 |
| F-057 Graficos tendencia | S-014 sec 4.4 | D-031, G-031 |
| F-058 Ranking agentes | S-014 sec 4.5 | D-022, G-021 |
