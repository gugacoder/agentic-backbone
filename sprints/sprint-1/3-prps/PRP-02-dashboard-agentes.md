# PRP-02 — Dashboard de Agentes

Painel centralizado com visao em tempo real de todos os agentes, status de heartbeat, metricas de uso e acoes rapidas.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem scaffold funcional (PRP-01): Vite, React 19, TanStack Router, shadcn/ui, API client, SSE hook, auth, layout. A pagina `/agents` existe como placeholder. O backbone expoe:

| Metodo | Rota | Retorno |
|--------|------|---------|
| GET | `/agents` | `Agent[]` |
| GET | `/agents/:id` | `Agent` |
| GET | `/agents/:id/heartbeat` | heartbeat config |
| GET | `/agents/:id/heartbeat/stats` | `HeartbeatStats` |
| POST | `/agents/:id/heartbeat/toggle` | toggle enabled |
| POST | `/agents/:id/heartbeat/trigger` | trigger manual |
| GET | `/agents/:id/heartbeat/history` | ultimos heartbeats |

SSE: evento `heartbeat:status` com `{ agentId, status, preview }`.

### Estado desejado

1. Pagina `/agents` com grid de cards mostrando todos os agentes com status ao vivo
2. Pagina `/agents/:id` com tabs e visao geral (metricas + timeline de heartbeat)
3. Acoes rapidas: toggle enabled, trigger heartbeat

## Especificacao

### Feature F-007: Lista de agentes + AgentCard

**Substituir placeholder** `routes/_authenticated/agents.tsx`:

- Fetch via `agentsQueryOptions()` (loader ou `useSuspenseQuery`)
- Fetch stats de cada agente via `agentStatsQueryOptions(id)` (em paralelo)
- Grid responsivo: 1 col mobile, 2 col tablet (md), 3 col desktop (lg)

**Barra de acoes da pagina (PageHeader):**
- Busca por nome (input com filtro client-side)
- Filtro: todos / ativos / inativos (toggle group ou select)
- Botao "Novo Agente" → navega para `/agents/new` (implementado no PRP-03)

**components/agents/agent-card.tsx — AgentCard:**

```typescript
interface AgentCardProps {
  agent: Agent;
  stats?: HeartbeatStats;
  heartbeatLive?: { status: string; preview?: string };
  onToggle: (id: string, enabled: boolean) => void;
}
```

| Campo | Fonte | Visual |
|-------|-------|--------|
| Nome (slug) | `agent.slug` | Titulo do card |
| Owner | `agent.owner` | Badge sutil (muted) |
| Status | `agent.enabled` | StatusBadge verde/cinza |
| Heartbeat | SSE `heartbeat:status` | Icone pulsante (CSS animation) quando ativo, estatico quando inativo |
| Ultima atividade | `stats.lastTimestamp` | Texto relativo ("ha 5 min") |
| Custo total | `stats.totalCostUsd` | Valor formatado |

- Card do shadcn com hover sutil (border highlight)
- Switch no canto superior direito para toggle enabled → `POST /agents/:id/heartbeat/toggle`
- Click no card → `navigate('/agents/$id', { params: { id } })`

**SSE integration:**
- `useSSE` no layout ja roda. Manter mapa `agentId → lastHeartbeat` em state local da pagina
- Evento `heartbeat:status` → atualiza o card do agente correspondente em tempo real
- Evento `registry:adapters` → invalida query `["agents"]`

### Feature F-008: Pagina de detalhe do agente + tabs

**routes/_authenticated/agents.$id.tsx:**

- Fetch via `agentQueryOptions(id)` no loader
- Layout com tabs horizontais (shadcn Tabs):

| Tab | Valor | Conteudo |
|-----|-------|----------|
| Visao Geral | `overview` | Metricas + timeline (esta feature) |
| Configuracao | `config` | Formularios (PRP-03) — placeholder por enquanto |
| Conversas | `conversations` | Lista filtrada (PRP-04) — placeholder |
| Memoria | `memory` | Status + busca (PRP-06) — placeholder |
| Agenda | `cron` | Jobs filtrados (PRP-07) — placeholder |

- Tab ativa controlada por search param `?tab=overview` (URL eh source of truth)
- Default: `overview`

**Header do detalhe:**
- Breadcrumb: Agentes > {agent.slug}
- StatusBadge com enabled/disabled
- Botoes: Toggle heartbeat (switch), Trigger manual, Nova Conversa

### Feature F-009: Metricas de heartbeat

**components/agents/agent-metrics.tsx:**

```typescript
interface AgentMetricsProps {
  stats: HeartbeatStats;
}
```

- Grid de 4 cards numericos (shadcn Card):

| Metrica | Fonte | Formato |
|---------|-------|---------|
| Total execucoes | `stats.totalRuns` | Numero com separador de milhar |
| OK / Skipped / Erro | `stats.byStatus` | Tres badges em linha |
| Custo total | `stats.totalCostUsd` | USD com 4 decimais |
| Duracao media | `stats.avgDurationMs` | Segundos com 1 decimal |

- Fetch via `agentStatsQueryOptions(id)`
- SSE `heartbeat:status` invalida a query de stats

### Feature F-010: Timeline de heartbeat + acoes

**components/agents/heartbeat-timeline.tsx:**

```typescript
interface HeartbeatTimelineProps {
  entries: HeartbeatLogEntry[];
  loading?: boolean;
}
```

- Fetch via `GET /agents/:id/heartbeat/history` (criar `agentHeartbeatHistoryQueryOptions(id)` em `api/agents.ts`)
- Lista vertical com scroll interno (`ScrollArea` do shadcn)
- Cada entrada:

| Campo | Visual |
|-------|--------|
| Timestamp | Texto relativo ("ha 5 min") |
| Status | Badge cor semantica (ok=verde, skipped=amarelo, error=vermelho) |
| Duracao | Texto sutil |
| Preview | Texto truncado (max 2 linhas), expandivel com click |

- Ultimos 20 entries por default
- SSE `heartbeat:status` → prepend nova entry no topo da lista (otimistic)

**Acoes no detalhe:**
- Toggle heartbeat: switch que chama `POST /agents/:id/heartbeat/toggle`, invalida queries
- Trigger manual: botao que chama `POST /agents/:id/heartbeat/trigger`, mostra toast de confirmacao
- Nova Conversa: botao que cria sessao (`POST /conversations` com `{ agentId }`) e navega para `/conversations/:sessionId` (chat implementado no PRP-04)

## Limites

- **NAO** implementar conteudo das tabs Configuracao, Conversas, Memoria, Agenda — apenas placeholders com mensagem "Em breve". Conteudo eh responsabilidade dos PRPs 03, 04, 06, 07.
- **NAO** criar APIs novas no backbone — todas as APIs necessarias ja existem.
- **NAO** usar polling — toda atualizacao real-time vem do SSE.
- **NAO** implementar virtualizacao na timeline a menos que haja mais de 50 entries (manter simples).
- **NAO** implementar o formulario de criacao de agente (botao "Novo Agente" apenas navega — PRP-03 implementa).

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.

## Validacao

- [ ] Pagina `/agents` lista todos os agentes registrados no backbone
- [ ] Cards mostram status enabled/disabled com badge colorido
- [ ] Heartbeat ativo pulsa visualmente no card em tempo real (SSE)
- [ ] Toggle enabled/disabled atualiza backbone e UI sem reload
- [ ] Busca filtra agentes por nome em tempo real (client-side)
- [ ] Filtro ativo/inativo funciona
- [ ] Click no card navega para `/agents/:id`
- [ ] Tab Visao Geral exibe 4 cards de metricas
- [ ] Timeline mostra ultimos heartbeats com status e preview
- [ ] Trigger manual de heartbeat funciona e resultado aparece na timeline via SSE
- [ ] Tab ativa persiste na URL (`?tab=overview`)
- [ ] Layout responsivo: 1/2/3 colunas conforme breakpoint
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-007 Lista + AgentCard | S-002 sec 3.1 | D-001, G-003, D-005, D-012 |
| F-008 Detalhe + tabs | S-002 sec 3.2 | D-001, G-003 |
| F-009 Metricas | S-002 sec 4.3 | G-003, G-008 |
| F-010 Timeline + acoes | S-002 sec 4.2 | D-001, D-004, G-002 |
