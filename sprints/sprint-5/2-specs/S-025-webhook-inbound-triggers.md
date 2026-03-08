# S-025 — Webhook Inbound Triggers

Endpoint HTTP publico por agente para receber eventos externos e disparar execucao do agente imediatamente, desacoplando o backbone de schedules fixos.

**Resolve:** D-043 (agentes so reagem a schedule), G-044 (webhook inbound triggers)
**Score de prioridade:** 9

---

## 1. Objetivo

- Expor endpoint publico `/webhooks/:agentId/:webhookId` para receber HTTP POST de sistemas externos (Zendesk, Stripe, GitHub, HubSpot, etc.)
- Ao receber payload, disparar execucao do agente com contexto do evento injetado
- Suporte a autenticacao HMAC-SHA256 para validacao de origem
- Configuracao de webhooks via GUI no Hub (listar, criar, revogar)
- Historico de eventos recebidos com status de processamento

---

## 2. Schema DB

### 2.1 Tabela `webhooks`

```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY,               -- uuid v4
  agent_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  secret      TEXT NOT NULL,                  -- HMAC secret (armazenado cifrado)
  enabled     INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  filters     TEXT,                           -- JSON: { "event_type": "payment.succeeded" }
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_webhooks_agent ON webhooks(agent_id);
```

### 2.2 Tabela `webhook_events`

```sql
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,              -- uuid v4
  webhook_id   TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  agent_id     TEXT NOT NULL,
  received_at  TEXT NOT NULL DEFAULT (datetime('now')),
  headers      TEXT NOT NULL,                -- JSON dos headers HTTP
  payload      TEXT NOT NULL,                -- JSON do body
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | done | failed | rejected
  error        TEXT,
  processed_at TEXT
);

CREATE INDEX idx_webhook_events_webhook ON webhook_events(webhook_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
```

---

## 3. API Endpoints

### Endpoints de gestao (autenticados via JWT)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/webhooks` | Listar webhooks do agente |
| POST | `/agents/:agentId/webhooks` | Criar webhook |
| PATCH | `/agents/:agentId/webhooks/:webhookId` | Atualizar webhook (nome, filtros, enabled) |
| DELETE | `/agents/:agentId/webhooks/:webhookId` | Revogar webhook |
| GET | `/agents/:agentId/webhooks/:webhookId/events` | Historico de eventos |

### Endpoint publico (sem JWT, validado por HMAC)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/webhooks/:agentId/:webhookId` | Receber evento externo |

### 3.1 POST `/agents/:agentId/webhooks` — Criar webhook

**Request:**
```json
{
  "name": "Stripe Pagamentos",
  "description": "Recebe eventos de pagamento processado",
  "filters": { "event_type": "payment_intent.succeeded" }
}
```

**Response 201:**
```json
{
  "id": "wh_abc123",
  "agentId": "system.main",
  "name": "Stripe Pagamentos",
  "secret": "whsec_...",
  "url": "https://myserver.com/webhooks/system.main/wh_abc123",
  "enabled": true,
  "createdAt": "2026-03-07T10:00:00Z"
}
```

> O `secret` so e retornado na criacao. Nao pode ser recuperado depois.

### 3.2 POST `/webhooks/:agentId/:webhookId` — Receber evento

**Headers esperados:**
- `X-Signature-256: sha256=<hmac>` — assinatura HMAC do body com o secret
- `X-Event-Type: payment_intent.succeeded` (opcional, usado em filtros)

**Validacao:**
1. Webhook existe e `enabled = 1`
2. Signature HMAC valida (timing-safe comparison)
3. Filtro de `event_type` passa (se configurado)

**Response 200:** `{ "eventId": "evt_xyz" }`
**Response 401:** signature invalida
**Response 404:** webhook nao encontrado
**Response 422:** filtro nao passou

**Comportamento pos-recepcao:**
- Registra evento em `webhook_events` com status `pending`
- Dispara execucao assincrona do agente em modo `webhook` (similar a `conversation`)
- Prompt injetado ao agente: `<webhook_event>{ payload JSON }}</webhook_event>`
- Atualiza status para `done` ou `failed` ao concluir

---

## 4. Telas (Hub)

### 4.1 `/agents/:id/webhooks`

- Lista de webhooks configurados (nome, URL, enabled toggle, data de criacao)
- Botao "Criar webhook"
- Coluna "Ultimo evento" com status (check verde / X vermelho)
- Botao "Ver historico" por webhook

### 4.2 Modal "Criar Webhook"

- Campo: Nome
- Campo: Descricao (opcional)
- Campo: Filtro de event_type (opcional, texto livre)
- Apos criacao: exibe URL + secret com botao "Copiar" e aviso "Este secret nao sera exibido novamente"

### 4.3 `/agents/:id/webhooks/:webhookId/events`

- Tabela: Data, Event Type (do header), Status (badge colorido), Payload preview (expandivel), Error
- Paginacao (50 por pagina)
- Botao "Reprocessar" para eventos com status `failed`

---

## 5. Criterios de Aceite

- [ ] POST para endpoint publico com HMAC valido dispara execucao do agente em < 2s
- [ ] POST com HMAC invalido retorna 401 (sem log de processamento)
- [ ] Webhook desabilitado (`enabled=false`) retorna 404
- [ ] Filtro de event_type recusando payload retorna 422 sem executar agente
- [ ] Historico de eventos exibe status correto (done/failed) apos processamento
- [ ] Secret nao aparece em nenhuma listagem ou response apos a criacao
- [ ] GUI permite criar, editar (nome/filtros/enabled) e revogar webhooks
- [ ] URL do webhook e copiavel diretamente da GUI
