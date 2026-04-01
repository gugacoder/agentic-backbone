# AB Hub - Notificacoes e Alertas

Sistema de notificacoes in-app e push (PWA) para eventos criticos dos agentes, com central de notificacoes no Hub.

---

## 1. Objetivo

- Notificar o usuario sobre falhas de heartbeat, erros de cron, conclusao/falha de jobs
- Central de notificacoes in-app com historico e filtros
- Push notifications via PWA service worker
- Resolver D-018 (falhas despercebidas), G-018 (notificacoes e alertas)

---

## 2. Schema DB

### 2.1 Nova Tabela: `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  type       TEXT NOT NULL,        -- 'heartbeat_error', 'cron_error', 'cron_ok', 'job_completed', 'job_failed', 'system'
  severity   TEXT NOT NULL,        -- 'info', 'warning', 'error'
  agent_id   TEXT,                 -- agente relacionado (nullable para system)
  title      TEXT NOT NULL,        -- titulo curto: "Heartbeat falhou"
  body       TEXT,                 -- detalhes: "Agente system.main falhou apos 3.2s: timeout"
  read       INTEGER NOT NULL DEFAULT 0,  -- 0=nao lida, 1=lida
  metadata   TEXT                  -- JSON com dados extras (job_id, cron_slug, etc.)
);

CREATE INDEX idx_notifications_ts ON notifications(ts DESC);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);
```

### 2.2 Nova Tabela: `push_subscriptions`

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint     TEXT NOT NULL UNIQUE,
  keys_p256dh  TEXT NOT NULL,
  keys_auth    TEXT NOT NULL,
  user_slug    TEXT,               -- usuario associado (nullable)
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. API Endpoints Novos

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/notifications` | Listar notificacoes (`?unread=true`, `?type=`, `?limit=`, `?offset=`) |
| GET | `/notifications/count` | Contagem de nao lidas: `{ unread: 5 }` |
| PATCH | `/notifications/:id/read` | Marcar como lida |
| POST | `/notifications/read-all` | Marcar todas como lidas |
| DELETE | `/notifications/:id` | Remover notificacao |
| POST | `/push/subscribe` | Registrar subscription push |
| DELETE | `/push/subscribe` | Remover subscription push |

### 3.1 GET `/notifications`

**Query params:**

| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `unread` | boolean | — | Filtrar apenas nao lidas |
| `type` | string | — | Filtrar por tipo (heartbeat_error, cron_error, etc.) |
| `limit` | number | 50 | Max resultados |
| `offset` | number | 0 | Paginacao |

**Response:**

```json
{
  "rows": [
    {
      "id": 1,
      "ts": "2026-03-07T14:00:00Z",
      "type": "heartbeat_error",
      "severity": "error",
      "agentId": "system.monitor",
      "title": "Heartbeat falhou",
      "body": "Agente system.monitor falhou apos 5.2s: timeout",
      "read": false,
      "metadata": {}
    }
  ],
  "total": 42
}
```

### 3.2 POST `/push/subscribe`

**Payload:**

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

### 3.3 Novo Evento SSE

Adicionar evento `notification:new` ao event bus do sistema:

```
event: notification:new
data: {"id": 1, "type": "heartbeat_error", "severity": "error", "title": "Heartbeat falhou", "agentId": "system.monitor"}
```

---

## 4. Backend: Gerador de Notificacoes

### 4.1 Pontos de Integracao

Inserir notificacoes nos pontos onde eventos criticos ocorrem:

| Evento | Local no Codigo | Tipo | Severidade |
|--------|-----------------|------|------------|
| Heartbeat falhou | `heartbeat/index.ts` (apos logHeartbeat com status error) | `heartbeat_error` | `error` |
| Cron job falhou | `cron/index.ts` (apos execucao com erro) | `cron_error` | `error` |
| Cron job ok | `cron/index.ts` (apos execucao com sucesso) | `cron_ok` | `info` |
| Job concluido | `jobs/engine.ts` (ao finalizar) | `job_completed` | `info` |
| Job falhou | `jobs/engine.ts` (ao falhar/timeout) | `job_failed` | `error` |

### 4.2 Push Notifications

**Dependencia:** `web-push` (npm)

**Configuracao:** Gerar VAPID keys e armazenar em `.env`:

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

**Logica:** Ao inserir notificacao com severity `error` ou `warning`, enviar push para todas as subscriptions registradas.

---

## 5. Telas

### 5.1 Bell Icon no Header

**Localizacao:** breadcrumb-bar ou header global

- Icone Bell (Lucide) no canto superior direito
- Badge com contagem de nao lidas (vermelho)
- Click abre popover com lista compacta
- Link "Ver todas" navega para `/notifications`

### 5.2 Popover de Notificacoes

**Layout:** Lista compacta com maximo 5 notificacoes recentes.

| Elemento | Descricao |
|----------|-----------|
| Icone | Por severidade: AlertCircle (error=vermelho), AlertTriangle (warning=amarelo), Info (info=azul) |
| Titulo | `notification.title` |
| Agente | Badge com agentId |
| Hora | Timestamp relativo |
| Indicador | Bolinha azul se nao lida |

**Acoes:**
- Click na notificacao → marca como lida + navega para contexto (agente, job, cron)
- "Marcar todas como lidas" no rodape
- "Ver todas" navega para `/notifications`

### 5.3 Central de Notificacoes (`/notifications`)

**Rota nova.**

**Layout:** Lista com filtros.

**Filtros:**
- Por tipo: Todos / Heartbeat / Cron / Jobs / Sistema
- Por estado: Todas / Nao lidas
- Por agente (select)

**Lista:**

| Elemento | Descricao |
|----------|-----------|
| Icone + severidade | Cor semantica |
| Titulo | `notification.title` |
| Corpo | `notification.body` (expandivel) |
| Agente | Badge |
| Hora | Timestamp relativo |
| Acoes | Marcar lida, excluir |

- Paginacao (50 por pagina)
- Atualiza via SSE evento `notification:new`

### 5.4 Push Notification (PWA)

- No primeiro acesso, solicitar permissao de notificacoes
- Registrar service worker subscription via `POST /push/subscribe`
- Push notifications mostram titulo + corpo resumido
- Click na push notification abre o Hub na pagina relevante

---

## 6. Componentes

### 6.1 NotificationBell

**Localizacao:** `components/notifications/notification-bell.tsx`

```typescript
interface NotificationBellProps {
  unreadCount: number;
}
```

- Icone Bell com badge de contagem
- Popover com lista compacta

### 6.2 NotificationList

**Localizacao:** `components/notifications/notification-list.tsx`

```typescript
interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
  onDelete: (id: number) => void;
}
```

### 6.3 NotificationItem

**Localizacao:** `components/notifications/notification-item.tsx`

```typescript
interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;    // true no popover, false na pagina
  onMarkRead: () => void;
  onClick: () => void;
}
```

### 6.4 PushPermissionBanner

**Localizacao:** `components/notifications/push-permission-banner.tsx`

- Banner discreto (uma vez) pedindo permissao para notificacoes push
- Botoes: "Ativar notificacoes" / "Agora nao"
- Salva preferencia em localStorage

### 6.5 API Module

**Localizacao:** `api/notifications.ts`

```typescript
export const notificationsQueryOptions = (params?: { unread?: boolean; type?: string; limit?: number; offset?: number }) =>
  queryOptions({
    queryKey: ["notifications", params],
    queryFn: () => request<{ rows: Notification[]; total: number }>(`/notifications?${new URLSearchParams(...)}`),
  });

export const notificationCountQueryOptions = () =>
  queryOptions({
    queryKey: ["notifications", "count"],
    queryFn: () => request<{ unread: number }>("/notifications/count"),
  });
```

---

## 7. SSE Integration

Atualizar `useSSE` para tratar evento `notification:new`:

1. Invalidar `["notifications"]` e `["notifications", "count"]`
2. Incrementar badge no `NotificationBell` imediatamente (otimistic)
3. Opcionalmente: toast com sonner para notificacoes de severidade `error`

---

## 8. Criterios de Aceite

- [ ] Bell icon no header exibe contagem de nao lidas
- [ ] Click no bell abre popover com 5 notificacoes recentes
- [ ] Pagina `/notifications` lista todas as notificacoes com paginacao
- [ ] Filtros por tipo, estado e agente funcionam
- [ ] Marcar como lida (individual e "todas") funciona
- [ ] Excluir notificacao funciona
- [ ] Heartbeat com erro gera notificacao automaticamente
- [ ] Cron job com erro gera notificacao automaticamente
- [ ] Job finalizado/falho gera notificacao automaticamente
- [ ] SSE `notification:new` atualiza badge e lista sem refresh
- [ ] Push notification chega no navegador quando Hub esta fechado
- [ ] Click na push notification abre Hub na pagina relevante
- [ ] Banner de permissao push aparece uma vez e respeita escolha
- [ ] Tabela `notifications` criada no SQLite com indices

---

## 9. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| NotificationBell + Popover | D-018 (falhas despercebidas), G-018 (alertas) |
| Central de Notificacoes | D-018, G-018, G-008 (auditabilidade) |
| Push Notifications | D-018 (notificacao proativa), G-018 (push PWA) |
| Gerador de Notificacoes | D-018 (heartbeat/cron/jobs falhos) |
| SSE notification:new | D-001 (visibilidade real-time) |
