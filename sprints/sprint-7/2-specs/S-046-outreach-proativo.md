# S-046 — Outreach Proativo por Agente

Capacidade de agentes iniciarem conversas com usuários/canais baseado em eventos ou condições configuradas. Transforma agentes de reativos em proativos — follow-up de leads, alertas de inatividade, notificações contextuais.

**Resolve:** D-067 (agente só reativo), G-067 (Outreach Proativo por Agente)
**Score de prioridade:** 8
**Dependência:** Canais existentes (WhatsApp, Slack, Teams, Email), Inbox Unificado (Sprint 5, S-024), Heartbeat existente

---

## 1. Objetivo

- Agente inicia conversa com destinatário específico baseado em trigger configurado
- Triggers suportados: webhook recebido com condição, schedule com condição de memória, mudança de status de job
- Destinatários: usuário cadastrado (canal preferido), canal WhatsApp (número), canal Slack/Teams (channel ID), canal Email
- Template de mensagem com variáveis do contexto do trigger
- Limite de frequência por destinatário (anti-spam)
- Histórico de outreach com status de entrega
- Integração com inbox unificado existente

---

## 2. Schema DB

### 2.1 Tabela `outreach_rules`

```sql
CREATE TABLE IF NOT EXISTS outreach_rules (
  id              TEXT PRIMARY KEY,                    -- uuid v4
  agent_id        TEXT NOT NULL,
  label           TEXT NOT NULL,                       -- nome descritivo
  enabled         INTEGER NOT NULL DEFAULT 1,
  trigger_type    TEXT NOT NULL,                       -- 'webhook' | 'schedule' | 'job_status'
  trigger_config  TEXT NOT NULL,                       -- JSON: condição específica por tipo
  recipient_type  TEXT NOT NULL,                       -- 'user' | 'whatsapp' | 'slack' | 'teams' | 'email'
  recipient_id    TEXT NOT NULL,                       -- user slug, phone number, channel ID, email
  message_template TEXT NOT NULL,                      -- template com {variables}
  cooldown_hours  INTEGER NOT NULL DEFAULT 24,         -- mínimo de horas entre envios ao mesmo destinatário
  max_per_day     INTEGER NOT NULL DEFAULT 3,          -- máximo de outreach por dia por regra
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_rules_agent ON outreach_rules(agent_id);
CREATE INDEX idx_outreach_rules_enabled ON outreach_rules(enabled);
```

### 2.2 Tabela `outreach_log`

```sql
CREATE TABLE IF NOT EXISTS outreach_log (
  id              TEXT PRIMARY KEY,                    -- uuid v4
  rule_id         TEXT NOT NULL REFERENCES outreach_rules(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  recipient_type  TEXT NOT NULL,
  recipient_id    TEXT NOT NULL,
  message         TEXT NOT NULL,                       -- mensagem final (template resolvido)
  status          TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'sent' | 'delivered' | 'failed' | 'throttled'
  error           TEXT,
  trigger_context TEXT,                                -- JSON: dados do trigger que disparou
  session_id      TEXT,                                -- sessão criada no inbox (se aplicável)
  sent_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_log_agent ON outreach_log(agent_id);
CREATE INDEX idx_outreach_log_rule ON outreach_log(rule_id);
CREATE INDEX idx_outreach_log_recipient ON outreach_log(recipient_id);
CREATE INDEX idx_outreach_log_created ON outreach_log(created_at);
```

---

## 3. Módulo `src/outreach/`

### 3.1 Estrutura

```
src/outreach/
  index.ts            # OutreachManager: inicialização, registro de listeners
  rules.ts            # CRUD de outreach_rules
  executor.ts         # Execução de outreach: resolve template, verifica throttle, envia
  triggers.ts         # Listeners para cada tipo de trigger
  schemas.ts          # Zod schemas
```

### 3.2 Trigger Types

#### Webhook (`trigger_type: 'webhook'`)

Dispara quando um webhook inbound (existente, S-025) é recebido e o payload atende a condição:

```json
{
  "webhookPath": "/webhook/crm-update",
  "condition": {
    "field": "payload.event",
    "operator": "equals",
    "value": "lead_inactive_30d"
  }
}
```

O OutreachManager se inscreve no EventBus em `webhook:received` e avalia a condição.

#### Schedule (`trigger_type: 'schedule'`)

Dispara em horário definido (cron expression) com condição opcional avaliada via memória do agente:

```json
{
  "schedule": "0 9 * * 1",
  "memoryCondition": "cliente com ticket aberto há mais de 24h"
}
```

Se `memoryCondition` está definida, o sistema faz uma busca semântica na memória do agente. Se encontrar resultados relevantes (score > threshold), dispara o outreach com os dados encontrados como contexto.

#### Job Status (`trigger_type: 'job_status'`)

Dispara quando um job supervisionado muda de status:

```json
{
  "jobNamePattern": "backup-*",
  "statusChange": "failed"
}
```

O OutreachManager se inscreve no EventBus em `job:status` e avalia o pattern.

### 3.3 Executor

```typescript
async function executeOutreach(rule: OutreachRule, triggerContext: Record<string, unknown>): Promise<void> {
  // 1. Verificar throttle: cooldown_hours e max_per_day
  const throttled = await checkThrottle(rule)
  if (throttled) {
    await logOutreach(rule, 'throttled', triggerContext)
    return
  }

  // 2. Resolver template: substituir {variables} com dados do triggerContext
  const message = resolveTemplate(rule.message_template, triggerContext)

  // 3. Enviar via canal apropriado
  const result = await sendToRecipient(rule.recipient_type, rule.recipient_id, rule.agent_id, message)

  // 4. Registrar no outreach_log
  await logOutreach(rule, result.status, triggerContext, result.sessionId, result.error)

  // 5. Emitir evento SSE
  eventBus.emit('outreach:sent', { ruleId: rule.id, agentId: rule.agent_id, status: result.status })
}
```

### 3.4 Envio por Canal

| Recipient Type | Como Envia |
|---------------|-----------|
| `user` | Busca canal preferido do usuário e envia por ele |
| `whatsapp` | Usa connector WhatsApp existente (Evolution/Cloud API) para enviar mensagem |
| `slack` | Usa connector Slack existente para enviar mensagem no channel/DM |
| `teams` | Usa connector Teams existente para enviar mensagem |
| `email` | Usa connector Email existente (S-038) para enviar email |

Cada envio cria uma sessão no inbox unificado para que respostas sejam rastreadas.

---

## 4. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/outreach/rules` | Listar regras de outreach do agente |
| POST | `/agents/:id/outreach/rules` | Criar regra de outreach |
| PUT | `/agents/:id/outreach/rules/:ruleId` | Atualizar regra |
| DELETE | `/agents/:id/outreach/rules/:ruleId` | Remover regra |
| POST | `/agents/:id/outreach/rules/:ruleId/test` | Testar regra (simula envio) |
| GET | `/agents/:id/outreach/log` | Histórico de outreach do agente |
| GET | `/agents/:id/outreach/stats` | Estatísticas de outreach |

### 4.1 POST `/agents/:id/outreach/rules`

**Request:**
```json
{
  "label": "Follow-up lead inativo",
  "triggerType": "webhook",
  "triggerConfig": {
    "webhookPath": "/webhook/crm-update",
    "condition": {
      "field": "payload.event",
      "operator": "equals",
      "value": "lead_inactive_30d"
    }
  },
  "recipientType": "whatsapp",
  "recipientId": "+5511999887766",
  "messageTemplate": "Olá! Notamos que faz um tempo desde nosso último contato. Posso ajudar com algo?",
  "cooldownHours": 48,
  "maxPerDay": 2
}
```

### 4.2 POST `/agents/:id/outreach/rules/:ruleId/test`

Simula o outreach sem enviar de fato. Retorna a mensagem resolvida e verifica se o throttle permitiria o envio.

**Response:**
```json
{
  "wouldSend": true,
  "resolvedMessage": "Olá! Notamos que faz um tempo desde nosso último contato. Posso ajudar com algo?",
  "recipientType": "whatsapp",
  "recipientId": "+5511999887766",
  "throttleStatus": {
    "withinCooldown": false,
    "sentToday": 1,
    "maxPerDay": 2
  }
}
```

### 4.3 GET `/agents/:id/outreach/stats`

**Response:**
```json
{
  "totalRules": 5,
  "activeRules": 4,
  "last30Days": {
    "sent": 87,
    "delivered": 82,
    "failed": 3,
    "throttled": 12
  },
  "byRecipientType": {
    "whatsapp": 45,
    "email": 30,
    "slack": 12
  }
}
```

---

## 5. Telas (Hub)

### 5.1 `/agents/:id/outreach` — Regras de Outreach

- **Lista de regras**: label, trigger type (badge), recipient (ícone do canal + ID), status (enabled/disabled), últimos 7 dias (sent/failed count)
- **Botão "Nova Regra"**: formulário com:
  - Label (texto livre)
  - Trigger type (select: Webhook, Schedule, Job Status)
  - Config do trigger (formulário dinâmico por tipo)
  - Recipient type (select com ícones: WhatsApp, Slack, Teams, Email, Usuário)
  - Recipient ID (campo com autocomplete para usuários)
  - Message template (textarea com hint de variáveis disponíveis)
  - Cooldown (horas) e Max por dia (números)
- **Botão "Testar"** por regra: simula e mostra resultado
- **Toggle** enable/disable por regra

### 5.2 `/agents/:id/outreach/log` — Histórico

- **Tabela**: data/hora, regra, destinatário, mensagem (truncada), status (badge: sent/delivered/failed/throttled)
- **Filtros**: por regra, por status, por período
- **Click** na linha abre detalhes: mensagem completa, contexto do trigger, sessão criada (link para inbox)

### 5.3 `/agents/:id` — Badge de Outreach

- Se o agente tem regras ativas: badge "Outreach: X regras ativas" com ícone de megafone
- Ao lado do badge de heartbeat existente

---

## 6. Critérios de Aceite

- [ ] Regra de outreach com trigger webhook dispara ao receber webhook matching
- [ ] Regra com trigger schedule dispara no horário configurado
- [ ] Regra com trigger schedule + memoryCondition só dispara se memória tem resultado relevante
- [ ] Regra com trigger job_status dispara ao detectar mudança de status matching
- [ ] Mensagem enviada via canal correto (WhatsApp, Slack, Teams, Email)
- [ ] Sessão criada no inbox unificado para rastrear resposta do destinatário
- [ ] Throttle por cooldown respeitado: não envia dentro da janela de cooldown
- [ ] Throttle por max_per_day respeitado: não excede limite diário
- [ ] Outreach throttled registrado no log com status `throttled`
- [ ] Teste de regra simula sem enviar e mostra resultado esperado
- [ ] Histórico de outreach exibe status de entrega por envio
