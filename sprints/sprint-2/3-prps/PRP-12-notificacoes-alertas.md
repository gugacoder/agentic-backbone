# PRP-12 — Notificacoes e Alertas

Sistema de notificacoes in-app e push (PWA) para eventos criticos dos agentes, com central de notificacoes no Hub.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub nao tem sistema de notificacoes. Eventos criticos (heartbeat falho, cron erro, job falho) sao registrados em log mas nao notificam o usuario. O backbone tem event bus SSE mas nao persiste notificacoes.

### Estado desejado

1. Tabelas `notifications` e `push_subscriptions` no SQLite
2. Endpoints CRUD de notificacoes + push subscribe
3. Gerador automatico de notificacoes nos pontos criticos do backend (heartbeat, cron, jobs)
4. Bell icon no header com badge de nao lidas + popover
5. Central de notificacoes em `/notifications` com filtros e paginacao
6. Push notifications via PWA service worker
7. Evento SSE `notification:new` para atualizacao real-time

## Especificacao

### Feature F-044: Schema DB + endpoints de notificacoes

**Backend — novas tabelas em `db/`:**

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL DEFAULT (datetime('now')),
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL,
  agent_id   TEXT,
  title      TEXT NOT NULL,
  body       TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  metadata   TEXT
);

CREATE INDEX idx_notifications_ts ON notifications(ts DESC);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint     TEXT NOT NULL UNIQUE,
  keys_p256dh  TEXT NOT NULL,
  keys_auth    TEXT NOT NULL,
  user_slug    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Novos endpoints em `routes/notifications.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/notifications` | Listar (`?unread=true`, `?type=`, `?limit=50`, `?offset=0`) |
| GET | `/notifications/count` | Contagem nao lidas: `{ unread: 5 }` |
| PATCH | `/notifications/:id/read` | Marcar como lida |
| POST | `/notifications/read-all` | Marcar todas como lidas |
| DELETE | `/notifications/:id` | Remover notificacao |
| POST | `/push/subscribe` | Registrar subscription push |
| DELETE | `/push/subscribe` | Remover subscription push |

**Novo evento SSE — `notification:new`:**

```
event: notification:new
data: {"id": 1, "type": "heartbeat_error", "severity": "error", "title": "Heartbeat falhou", "agentId": "system.monitor"}
```

### Feature F-045: Gerador de notificacoes no backend

Inserir notificacoes nos pontos onde eventos criticos ocorrem:

| Evento | Local no Codigo | Tipo | Severidade |
|--------|-----------------|------|------------|
| Heartbeat falhou | `heartbeat/index.ts` (apos logHeartbeat com status error) | `heartbeat_error` | `error` |
| Cron job falhou | `cron/index.ts` (apos execucao com erro) | `cron_error` | `error` |
| Cron job ok | `cron/index.ts` (apos execucao com sucesso) | `cron_ok` | `info` |
| Job concluido | `jobs/engine.ts` (ao finalizar) | `job_completed` | `info` |
| Job falhou | `jobs/engine.ts` (ao falhar/timeout) | `job_failed` | `error` |

Cada insercao:
1. INSERT na tabela `notifications`
2. Emitir evento SSE `notification:new`
3. Se severity `error` ou `warning`: enviar push para todas as subscriptions registradas

**Push notifications — dependencia `web-push`:**
- VAPID keys em `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Envio asssincrono (nao bloqueia a operacao principal)

### Feature F-046: NotificationBell + popover no header

**components/notifications/notification-bell.tsx:**

```typescript
interface NotificationBellProps {
  unreadCount: number;
}
```

- Icone Bell (Lucide) no header/breadcrumb-bar
- Badge vermelho com contagem de nao lidas
- Click abre Popover (shadcn) com lista compacta (maximo 5 recentes)

**Cada item no popover:**
- Icone por severidade: AlertCircle (error=vermelho), AlertTriangle (warning=amarelo), Info (info=azul)
- Titulo, badge agente, timestamp relativo, bolinha azul se nao lida

**Acoes no popover:**
- Click na notificacao → marca como lida + navega para contexto (agente, job, cron)
- "Marcar todas como lidas" no rodape
- "Ver todas" → navega para `/notifications`

**SSE integration:**
- Evento `notification:new` → invalida `["notifications"]` e `["notifications", "count"]`
- Incrementar badge imediatamente (optimistic)
- Toast (sonner) para notificacoes de severidade `error`

**API module `api/notifications.ts`:**

```typescript
export const notificationsQueryOptions = (params?: { unread?: boolean; type?: string; limit?: number; offset?: number }) =>
  queryOptions({
    queryKey: ["notifications", params],
    queryFn: () => request<{ rows: Notification[]; total: number }>("/notifications", { params }),
  });

export const notificationCountQueryOptions = () =>
  queryOptions({
    queryKey: ["notifications", "count"],
    queryFn: () => request<{ unread: number }>("/notifications/count"),
  });
```

### Feature F-047: Central de notificacoes /notifications

**Nova rota** `routes/_authenticated/notifications.tsx`:

**Filtros:**
- Por tipo: Todos / Heartbeat / Cron / Jobs / Sistema (toggle group)
- Por estado: Todas / Nao lidas (toggle)
- Por agente (Select)

**Lista paginada (50 por pagina):**

| Elemento | Descricao |
|----------|-----------|
| Icone + severidade | Cor semantica |
| Titulo | `notification.title` |
| Corpo | `notification.body` (expandivel) |
| Agente | Badge |
| Hora | Timestamp relativo |
| Acoes | Marcar lida, excluir |

- Atualiza via SSE evento `notification:new`
- Paginacao via query params (`?offset=`, `?limit=`)
- Bulk action: "Marcar todas como lidas"

**components/notifications/notification-item.tsx:**

```typescript
interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;    // true no popover, false na pagina
  onMarkRead: () => void;
  onClick: () => void;
}
```

### Feature F-048: Push notifications PWA

**components/notifications/push-permission-banner.tsx:**

- Banner discreto (uma vez) pedindo permissao para notificacoes push
- Botoes: "Ativar notificacoes" / "Agora nao"
- Salva preferencia em localStorage

**Service worker integration:**
- Solicitar permissao de notificacoes no primeiro acesso
- `POST /push/subscribe` com subscription do service worker
- Push notifications mostram titulo + corpo resumido
- Click na push notification abre o Hub na pagina relevante (via `notification.metadata`)

**Configuracao backend:**
- Variaveis `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (opcionais — push desabilitado se ausentes)
- Se VAPID keys ausentes, banner nao aparece e push nao eh oferecido

## Limites

- **NAO** implementar preferencias granulares de notificacao por tipo (tudo ou nada por enquanto).
- **NAO** implementar notificacoes por email — apenas in-app e push PWA.
- **NAO** implementar retention policy automatica — limpeza manual pelo usuario.
- **NAO** implementar notificacoes de cron_ok no popover/push — apenas na central (volume alto).

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.

## Validacao

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
- [ ] Push notification chega no navegador quando Hub esta fechado (se VAPID configurado)
- [ ] Click na push notification abre Hub na pagina relevante
- [ ] Banner de permissao push aparece uma vez e respeita escolha
- [ ] Tabelas `notifications` e `push_subscriptions` criadas no SQLite
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-044 Schema + endpoints | S-012 sec 2-3 | D-018, G-018 |
| F-045 Gerador notificacoes | S-012 sec 4 | D-018 |
| F-046 Bell + popover | S-012 sec 5.1-5.2 | D-018, G-018 |
| F-047 Central notificacoes | S-012 sec 5.3 | D-018, G-008 |
| F-048 Push PWA | S-012 sec 5.4 | D-018, G-018 |
