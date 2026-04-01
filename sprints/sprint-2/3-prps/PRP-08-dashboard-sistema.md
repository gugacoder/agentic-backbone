# PRP-08 — Dashboard de Sistema

Home page do Hub com visao panoramica da saude da plataforma, atividade recente e indicadores operacionais.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem scaffold completo (PRP-01), dashboard de agentes (PRP-02), chat (PRP-04), canais (PRP-05), memoria (PRP-06) e agendamento (PRP-07). A rota `/` faz redirect para `/agents`. O backbone expoe endpoints de stats (`/system/stats`, `/system/heartbeat/stats`, `/agents`, `/cron/jobs`, `/jobs`, `/system/info`), mas nao ha endpoint agregado para dashboard.

### Estado desejado

1. Endpoint `GET /system/dashboard` que agrega dados de todos os subsistemas
2. Pagina `/` com 6 cards de resumo (agentes, heartbeats, custos, conversas, cron jobs, jobs)
3. Tabela de proximos cron jobs
4. Timeline de atividade recente com filtro por tipo
5. Atualizacao real-time via SSE
6. "Dashboard" como primeiro item do menu lateral

## Especificacao

### Feature F-031: Endpoint /system/dashboard + API module

**Backend — novo handler em `routes/system.ts`:**

Endpoint `GET /system/dashboard` que agrega dados de `heartbeat_log`, `sessions`, `cron_run_log`, registries de agentes e jobs. Query de `recentActivity` usa UNION de tabelas de log com `ORDER BY ts DESC LIMIT 20`. Filtro `today` usa `date(ts) = date('now')`.

**Response shape:**

```json
{
  "agents": { "total": 5, "enabled": 3, "heartbeatEnabled": 2 },
  "heartbeats": {
    "today": { "total": 120, "ok": 110, "error": 8, "skipped": 2 },
    "costToday": 0.42
  },
  "conversations": { "totalSessions": 35, "today": 4 },
  "cronJobs": {
    "total": 8, "enabled": 6,
    "nextRuns": [{ "agentId": "system.monitor", "slug": "check-health", "schedule": "*/30 * * * *", "nextRun": "..." }]
  },
  "jobs": { "running": 1, "completed": 12, "failed": 0 },
  "recentActivity": [
    { "type": "heartbeat", "agentId": "system.main", "status": "ok", "ts": "...", "preview": "..." },
    { "type": "cron", "agentId": "system.monitor", "slug": "daily-report", "status": "ok", "ts": "..." },
    { "type": "conversation", "agentId": "system.main", "sessionId": "abc123", "ts": "..." }
  ],
  "system": { "uptime": 86400, "version": "0.0.1" }
}
```

**Hub — API module `api/dashboard.ts`:**

```typescript
export const dashboardQueryOptions = () =>
  queryOptions({
    queryKey: ["dashboard"],
    queryFn: () => request<DashboardData>("/system/dashboard"),
  });
```

### Feature F-032: DashboardPage com StatCards

**Substituir redirect** em `routes/_authenticated/index.tsx`:

- Rota `/` renderiza o dashboard (nao redireciona mais para `/agents`)
- Usa `useQuery` com `dashboardQueryOptions()`
- SSE invalida `["dashboard"]` em eventos `heartbeat:status` e `job:status`

**components/dashboard/stat-card.tsx — StatCard:**

```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: "ok" | "warning" | "error";
  href?: string;
}
```

- Usa shadcn Card
- Click navega via TanStack Router Link

**6 cards em grid (3 colunas desktop, 2 mobile):**

| Card | Icone | Valor principal | Subtexto | Click navega para |
|------|-------|-----------------|----------|--------------------|
| Agentes | Bot | `3 ativos` | "de 5 cadastrados" | `/agents` |
| Heartbeats | Activity | `110 ok` | "8 erros hoje" | `/agents` |
| Custos | DollarSign | `$0.42` | "hoje" | (futuro: `/costs`) |
| Conversas | MessageSquare | `4 hoje` | "35 total" | `/conversations` |
| Cron Jobs | Calendar | `6 ativos` | "proximo: 14:00" | `/cron` |
| Jobs | Cpu | `1 rodando` | "12 concluidos" | `/jobs` |

- Cards com cor de status: verde (tudo ok), amarelo (atencao), vermelho (erros)
- Card de heartbeats fica amarelo se taxa de erro > 10%, vermelho se > 25%

### Feature F-033: ActivityTimeline com filtros

**components/dashboard/activity-timeline.tsx:**

```typescript
interface ActivityEvent {
  type: "heartbeat" | "cron" | "conversation";
  agentId: string;
  status: string;
  ts: string;
  preview?: string;
  slug?: string;
  sessionId?: string;
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
}
```

- Timeline vertical com eventos recentes (ultimas 24h)
- Cada evento: icone por tipo (Activity, Calendar, MessageSquare), titulo, badge status, timestamp relativo, preview truncado (expandivel)
- Maximo 20 eventos
- Filtro por tipo (heartbeat / cron / conversa) — toggle group client-side
- Atualiza via SSE (evento `heartbeat:status` invalida query do dashboard)

### Feature F-034: UpcomingCronJobs + navegacao

**components/dashboard/upcoming-cron-jobs.tsx:**

```typescript
interface UpcomingCronJobsProps {
  jobs: Array<{
    agentId: string;
    slug: string;
    schedule: string;
    nextRun: string;
  }>;
}
```

- Tabela compacta: agente (badge), job slug, proxima execucao (timestamp relativo)
- Maximo 5 proximos jobs
- Link "Ver todos" navega para `/cron`

**Navegacao — adicionar "Dashboard" como primeiro item do menu:**

| Item | Icone | Rota |
|------|-------|------|
| Dashboard | LayoutDashboard | `/` |
| Agentes | Bot | `/agents` |
| ... | ... | ... |

## Limites

- **NAO** implementar dashboard de custos detalhado (card de custos eh apenas preview — detalhe em sprint futuro).
- **NAO** criar graficos/charts — apenas cards numericos e timeline. Graficos ficam para sprint futuro.
- **NAO** usar polling — toda atualizacao real-time vem do SSE.
- **NAO** implementar filtragem por periodo (24h fixo) — extensao futura.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.

## Validacao

- [ ] Rota `/` renderiza o dashboard (nao redireciona mais para `/agents`)
- [ ] Endpoint `GET /system/dashboard` retorna dados agregados
- [ ] 6 cards de resumo exibem dados corretos do backend
- [ ] Cards clicaveis navegam para a pagina correspondente
- [ ] Card de heartbeats muda cor conforme taxa de erro
- [ ] Timeline de atividade recente mostra ultimos 20 eventos
- [ ] Filtro por tipo de evento na timeline funciona
- [ ] Timeline atualiza automaticamente via SSE sem refresh
- [ ] Proximos cron jobs listados com horario relativo
- [ ] Dashboard responsivo: 3 colunas desktop, 2 mobile
- [ ] Menu lateral inclui "Dashboard" como primeiro item
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-031 Endpoint dashboard | S-008 sec 2.1 | D-015, G-015 |
| F-032 StatCards | S-008 sec 3.2 | D-005, G-003, D-014 |
| F-033 ActivityTimeline | S-008 sec 3.4 | D-001, G-008 |
| F-034 UpcomingCronJobs + nav | S-008 sec 3.3, 5 | D-007, G-009 |
