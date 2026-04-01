# AB Hub - Dashboard de Sistema

Home page do Hub com visao panoramica da saude da plataforma, atividade recente e indicadores operacionais.

---

## 1. Objetivo

- Criar a pagina inicial do Hub (rota `/`) com visao geral do sistema
- Cards de resumo: agentes ativos, heartbeats, conversas, cron jobs, jobs
- Atividade recente com timeline de eventos
- Indicadores de saude: heartbeats ok/erro, uptime, proximos cron jobs
- Resolver D-015 (sem dashboard), G-015 (visao panoramica), D-005 (fragmentacao de ferramentas)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Descricao | Dados relevantes |
|--------|------|-----------|------------------|
| GET | `/system/stats` | Stats gerais | `agents`, `channels`, `sessions`, `uptime`, `memoryUsage` |
| GET | `/system/heartbeat/stats` | Stats de heartbeat por agente | `totalExecutions`, `countByStatus`, `totalCostUsd`, `avgDurationMs` |
| GET | `/agents` | Lista de agentes | `enabled`, `heartbeat-enabled`, status |
| GET | `/cron/jobs` | Lista de cron jobs | `schedule`, `enabled`, proxima execucao |
| GET | `/cron/status` | Status do scheduler | estado geral |
| GET | `/jobs` | Lista de jobs ativos | `status`, `agentId`, `command` |
| GET | `/system/info` | Info do sistema | `version`, `nodeVersion`, `platform` |

### 2.1 Endpoint Novo Necessario

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/system/dashboard` | Agregacao otimizada para o dashboard |

**Response:**

```json
{
  "agents": {
    "total": 5,
    "enabled": 3,
    "heartbeatEnabled": 2
  },
  "heartbeats": {
    "today": {
      "total": 120,
      "ok": 110,
      "error": 8,
      "skipped": 2
    },
    "costToday": 0.42
  },
  "conversations": {
    "totalSessions": 35,
    "today": 4
  },
  "cronJobs": {
    "total": 8,
    "enabled": 6,
    "nextRuns": [
      { "agentId": "system.monitor", "slug": "check-health", "schedule": "*/30 * * * *", "nextRun": "2026-03-07T14:00:00Z" }
    ]
  },
  "jobs": {
    "running": 1,
    "completed": 12,
    "failed": 0
  },
  "recentActivity": [
    { "type": "heartbeat", "agentId": "system.main", "status": "ok", "ts": "2026-03-07T13:45:00Z", "preview": "Nada relevante no momento." },
    { "type": "cron", "agentId": "system.monitor", "slug": "daily-report", "status": "ok", "ts": "2026-03-07T09:00:00Z" },
    { "type": "conversation", "agentId": "system.main", "sessionId": "abc123", "ts": "2026-03-07T12:30:00Z" }
  ],
  "system": {
    "uptime": 86400,
    "version": "0.0.1"
  }
}
```

**Implementacao backend:** Novo handler em `routes/system.ts` que agrega dados de `heartbeat_log`, `sessions`, `cron_run_log`, `jobs` e registries de agentes. Query de `recentActivity` usa UNION de tabelas de log com ORDER BY ts DESC LIMIT 20. Filtro `today` usa `date(ts) = date('now')`.

---

## 3. Telas

### 3.1 Dashboard Home (`/`)

**Layout desktop:**

```
+---sidebar---+--------content------------------+
| Logo        | Dashboard                       |
| nav-items   |                                 |
|  >Dashboard | [Agentes] [Heartbeats] [Custos] |
|   Agentes   | [Conversas] [Cron Jobs] [Jobs]  |
|   Conversas |                                 |
|   ...       | Atividade Recente               |
|             | [timeline de eventos]           |
+-------------+---------------------------------+
```

**Layout mobile:**

```
+--------content------------------+
| Dashboard                       |
| [Agentes] [Heartbeats]         |
| [Custos]  [Conversas]          |
| [Cron Jobs] [Jobs]             |
|                                 |
| Atividade Recente               |
| [timeline de eventos]           |
+---bottom-nav-------------------+
```

### 3.2 Cards de Resumo

Seis cards em grid (3 colunas desktop, 2 colunas mobile):

| Card | Icone | Valor principal | Subtexto | Click navega para |
|------|-------|-----------------|----------|--------------------|
| Agentes | Bot | `3 ativos` | "de 5 cadastrados" | `/agents` |
| Heartbeats | Activity | `110 ok` | "8 erros hoje" | `/agents` (filtro heartbeat) |
| Custos | DollarSign | `$0.42` | "hoje" | (futuro: `/costs`) |
| Conversas | MessageSquare | `4 hoje` | "35 total" | `/conversations` |
| Cron Jobs | Calendar | `6 ativos` | "proximo: 14:00" | `/cron` |
| Jobs | Cpu | `1 rodando` | "12 concluidos" | (futuro: `/jobs`) |

- Cards com cor de status: verde (tudo ok), amarelo (atencao), vermelho (erros)
- Card de heartbeats fica amarelo se taxa de erro > 10%, vermelho se > 25%

### 3.3 Proximos Cron Jobs

Tabela compacta abaixo dos cards:

| Coluna | Descricao |
|--------|-----------|
| Agente | Badge com nome |
| Job | Slug do cron job |
| Proxima execucao | Timestamp relativo ("em 15 min") |

- Maximo 5 proximos jobs
- Link para `/cron` no rodape

### 3.4 Atividade Recente

Timeline vertical com eventos recentes (ultimas 24h):

| Elemento | Descricao |
|----------|-----------|
| Icone | Por tipo: Activity (heartbeat), Calendar (cron), MessageSquare (conversa) |
| Titulo | "Heartbeat de system.main", "Cron daily-report executado" |
| Status | Badge ok/erro |
| Hora | Timestamp relativo |
| Preview | Texto truncado (expandivel) |

- Maximo 20 eventos
- Filtro por tipo (heartbeat / cron / conversa)
- Atualiza via SSE (evento `heartbeat:status` invalida query do dashboard)

---

## 4. Componentes

### 4.1 DashboardPage

**Localizacao:** `routes/_authenticated/index.tsx`

- Substitui o redirect atual para `/agents`
- Usa `useQuery` com `dashboardQueryOptions()` para carregar dados
- SSE invalida `["dashboard"]` em eventos `heartbeat:status` e `job:status`

### 4.2 StatCard

**Localizacao:** `components/dashboard/stat-card.tsx`

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

### 4.3 ActivityTimeline

**Localizacao:** `components/dashboard/activity-timeline.tsx`

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

### 4.4 UpcomingCronJobs

**Localizacao:** `components/dashboard/upcoming-cron-jobs.tsx`

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

### 4.5 API Module

**Localizacao:** `api/dashboard.ts`

```typescript
export const dashboardQueryOptions = () =>
  queryOptions({
    queryKey: ["dashboard"],
    queryFn: () => request<DashboardData>("/system/dashboard"),
  });
```

---

## 5. Navegacao

Adicionar "Dashboard" como primeiro item do menu, antes de "Agentes":

| Item | Icone | Rota | Visivel mobile |
|------|-------|------|----------------|
| Dashboard | LayoutDashboard | `/` | Sim |
| Agentes | Bot | `/agents` | Sim |
| ... | ... | ... | ... |

A rota `/` deixa de ser redirect para `/agents` e passa a renderizar o dashboard.

---

## 6. Criterios de Aceite

- [ ] Rota `/` renderiza o dashboard (nao redireciona mais para `/agents`)
- [ ] 6 cards de resumo exibem dados corretos do backend
- [ ] Cards clicaveis navegam para a pagina correspondente
- [ ] Timeline de atividade recente mostra ultimos 20 eventos
- [ ] Timeline atualiza automaticamente via SSE sem refresh
- [ ] Proximos cron jobs listados com horario relativo
- [ ] Dashboard responsivo: 3 colunas desktop, 2 mobile, 1 em telas muito pequenas
- [ ] Card de heartbeats muda cor conforme taxa de erro
- [ ] Endpoint `/system/dashboard` retorna dados agregados em < 100ms
- [ ] Menu lateral inclui "Dashboard" como primeiro item
- [ ] Filtro por tipo de evento na timeline funciona

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| DashboardPage | D-015 (sem visao geral), G-015 (visao panoramica) |
| StatCards | D-005 (fragmentacao — tudo num lugar), G-003 (controle centralizado) |
| ActivityTimeline | D-001 (visibilidade real-time), G-008 (auditabilidade) |
| UpcomingCronJobs | D-007 (agendamento), G-009 (calendario visual) |
| Card de Custos | D-014 (custos opacos) — preview, detalhe em spec futura |
