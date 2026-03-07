# PRP-25 — Webhook Inbound Triggers

Endpoint HTTP publico por agente para receber eventos externos (Stripe, Zendesk, GitHub, etc.) e disparar execucao do agente imediatamente via HMAC-SHA256, com historico de eventos e GUI de gerenciamento.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone so reage a schedules fixos (heartbeat) e mensagens de usuario via conversa. Nao ha endpoint publico para receber eventos de sistemas externos. Nao ha tabelas de webhooks no SQLite.

### Estado desejado

1. Tabelas `webhooks` e `webhook_events` no SQLite
2. CRUD de webhooks por agente via API autenticada
3. Endpoint publico `/webhooks/:agentId/:webhookId` com validacao HMAC-SHA256
4. Execucao assincrona do agente ao receber evento valido
5. Aba "Webhooks" na pagina do agente no Hub com historico de eventos

## Especificacao

### Feature F-097: Tabelas de webhook + migracao DB

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  secret      TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  filters     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_webhooks_agent ON webhooks(agent_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,
  webhook_id   TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  agent_id     TEXT NOT NULL,
  received_at  TEXT NOT NULL DEFAULT (datetime('now')),
  headers      TEXT NOT NULL,
  payload      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  error        TEXT,
  processed_at TEXT
);
CREATE INDEX idx_webhook_events_webhook ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
```

Adicionar migracao no startup do backbone.

### Feature F-098: Endpoints CRUD de webhooks + endpoint publico com validacao HMAC

**Rotas autenticadas em `apps/backbone/src/routes/webhooks.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/webhooks` | Listar webhooks do agente |
| POST | `/agents/:agentId/webhooks` | Criar webhook (retorna secret apenas na criacao) |
| PATCH | `/agents/:agentId/webhooks/:webhookId` | Atualizar nome, filtros, enabled |
| DELETE | `/agents/:agentId/webhooks/:webhookId` | Revogar webhook |
| GET | `/agents/:agentId/webhooks/:webhookId/events` | Historico de eventos (50 por pagina) |

**Rota publica (sem JWT):**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/webhooks/:agentId/:webhookId` | Receber evento externo |

**Validacao do endpoint publico:**
1. Webhook existe e `enabled = 1`
2. `X-Signature-256: sha256=<hmac>` valida com timing-safe comparison
3. Filtro de `event_type` passa (header `X-Event-Type`, se configurado)
4. Retorna `{ eventId }` em 200, 401 para HMAC invalido, 404 para webhook nao encontrado, 422 se filtro falhar

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/webhooks.ts`:**

```typescript
export const webhooksQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["webhooks", agentId],
    queryFn: () => request<Webhook[]>(`/agents/${agentId}/webhooks`),
  });

export const webhookEventsQueryOptions = (agentId: string, webhookId: string) =>
  queryOptions({
    queryKey: ["webhook-events", agentId, webhookId],
    queryFn: () => request<WebhookEvent[]>(`/agents/${agentId}/webhooks/${webhookId}/events`),
  });
```

### Feature F-099: Execucao assincrona do agente ao receber evento

Apos registrar evento com status `pending`:

1. Disparar execucao assincrona do agente (sem bloquear response do webhook)
2. Prompt injetado: `<webhook_event>{payload JSON}</webhook_event>`
3. Modo de execucao: `webhook` (similar a `conversation`, sem SSE ao chamador)
4. Atualizar `webhook_events.status` para `done` ou `failed` ao concluir
5. Preencher `processed_at` e `error` (se falhou)

### Feature F-100: Telas Hub — webhooks e historico de eventos

**Nova aba "Webhooks"** na pagina do agente (`/agents/:id`) com rota `routes/_authenticated/agents/$agentId/webhooks.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `WebhooksTab` | `routes/_authenticated/agents/$agentId/webhooks.tsx` |
| `WebhookCard` | `components/webhooks/webhook-card.tsx` |
| `WebhookCreateDialog` | `components/webhooks/webhook-create-dialog.tsx` |
| `WebhookEventsTable` | `components/webhooks/webhook-events-table.tsx` |

**WebhookCard:** nome, URL do endpoint (copiavel), toggle enabled, data de criacao, ultimo evento (badge de status), botao "Ver historico", menu Editar/Revogar.

**WebhookCreateDialog:** campos Nome, Descricao (opcional), Filtro de event_type (opcional). Apos criacao: exibe URL + secret com botao "Copiar" e aviso "Este secret nao sera exibido novamente".

**WebhookEventsTable** (`/agents/:id/webhooks/:webhookId/events`): tabela Data, Event Type, Status (badge colorido), Payload preview (expandivel), Error. Paginacao 50/pagina. Botao "Reprocessar" para eventos `failed`.

## Limites

- **NAO** implementar retry automatico de eventos falhos (apenas botao manual)
- **NAO** implementar filas persistentes (webhook_events serve como historico, execucao e fire-and-forget)
- **NAO** suportar autenticacao por Basic Auth ou OAuth (apenas HMAC-SHA256)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba adicionada

## Validacao

- [ ] POST para endpoint publico com HMAC valido dispara execucao do agente em < 2s
- [ ] POST com HMAC invalido retorna 401 sem registrar evento
- [ ] Webhook `enabled=false` retorna 404
- [ ] Filtro de event_type recusando payload retorna 422 sem executar agente
- [ ] Historico exibe status correto (done/failed) apos processamento
- [ ] Secret nao aparece em nenhuma listagem ou response apos criacao
- [ ] GUI permite criar, editar (nome/filtros/enabled) e revogar webhooks
- [ ] URL do webhook e copiavel diretamente da GUI
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-097 Tabelas webhook + DB | S-025 sec 2 | D-043 |
| F-098 CRUD + endpoint publico HMAC | S-025 sec 3 | D-043, G-044 |
| F-099 Execucao assincrona do agente | S-025 sec 3.2 | G-044 |
| F-100 Telas Hub webhooks | S-025 sec 4 | G-044 |
