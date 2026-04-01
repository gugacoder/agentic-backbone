# PRP-47 — Outreach Proativo por Agente

Capacidade de agentes iniciarem conversas com usuários/canais baseado em eventos ou condições configuradas. Triggers: webhook, schedule com condição de memória, mudança de status de job. Throttle anti-spam e integração com inbox unificado.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Agentes são puramente reativos — respondem apenas quando recebem mensagem ou são acionados por heartbeat/cron genérico. Não há mecanismo para um agente iniciar conversa com um destinatário específico baseado em evento contextual. Não existe throttle de outreach nem log de mensagens proativas enviadas.

### Estado desejado

1. Tabelas `outreach_rules` e `outreach_log` no SQLite
2. Módulo `src/outreach/` com CRUD de regras, listeners de trigger, executor com throttle
3. API REST para gerenciar regras de outreach e consultar histórico
4. Integração com canais existentes (WhatsApp, Slack, Teams, Email) e inbox unificado
5. Página `/agents/:id/outreach` no Hub com regras, teste e histórico

## Especificacao

### Feature F-165: Tabelas outreach + migração DB

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS outreach_rules (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  label           TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  trigger_type    TEXT NOT NULL,
  trigger_config  TEXT NOT NULL,
  recipient_type  TEXT NOT NULL,
  recipient_id    TEXT NOT NULL,
  message_template TEXT NOT NULL,
  cooldown_hours  INTEGER NOT NULL DEFAULT 24,
  max_per_day     INTEGER NOT NULL DEFAULT 3,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_rules_agent ON outreach_rules(agent_id);
CREATE INDEX idx_outreach_rules_enabled ON outreach_rules(enabled);

CREATE TABLE IF NOT EXISTS outreach_log (
  id              TEXT PRIMARY KEY,
  rule_id         TEXT NOT NULL REFERENCES outreach_rules(id) ON DELETE CASCADE,
  agent_id        TEXT NOT NULL,
  recipient_type  TEXT NOT NULL,
  recipient_id    TEXT NOT NULL,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  error           TEXT,
  trigger_context TEXT,
  session_id      TEXT,
  sent_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_log_agent ON outreach_log(agent_id);
CREATE INDEX idx_outreach_log_rule ON outreach_log(rule_id);
CREATE INDEX idx_outreach_log_recipient ON outreach_log(recipient_id);
CREATE INDEX idx_outreach_log_created ON outreach_log(created_at);
```

Adicionar migração no startup do backbone.

### Feature F-166: OutreachManager — regras, triggers, executor

**Nova estrutura:**

```
src/outreach/
  index.ts            # OutreachManager: inicialização, registro de listeners
  rules.ts            # CRUD de outreach_rules
  executor.ts         # Execução: resolve template, verifica throttle, envia
  triggers.ts         # Listeners para cada tipo de trigger
  schemas.ts          # Zod schemas
```

**Trigger types:**

1. **Webhook (`trigger_type: 'webhook'`):** Dispara quando webhook inbound (existente, S-025) é recebido e payload atende condição configurada. OutreachManager se inscreve no EventBus em `webhook:received`.

```json
{
  "webhookPath": "/webhook/crm-update",
  "condition": { "field": "payload.event", "operator": "equals", "value": "lead_inactive_30d" }
}
```

2. **Schedule (`trigger_type: 'schedule'`):** Dispara em horário definido (cron expression) com condição opcional avaliada via busca semântica na memória do agente.

```json
{
  "schedule": "0 9 * * 1",
  "memoryCondition": "cliente com ticket aberto há mais de 24h"
}
```

Se `memoryCondition` está definida, faz busca semântica na memória. Se encontrar resultados relevantes (score > threshold), dispara o outreach com dados encontrados como contexto.

3. **Job Status (`trigger_type: 'job_status'`):** Dispara quando job supervisionado muda de status. OutreachManager se inscreve no EventBus em `job:status`.

```json
{ "jobNamePattern": "backup-*", "statusChange": "failed" }
```

**Executor:**

1. Verifica throttle: `cooldown_hours` e `max_per_day`
2. Resolve template: substitui `{variables}` com dados do trigger context
3. Envia via canal apropriado (WhatsApp/Slack/Teams/Email/canal preferido do usuário)
4. Registra no `outreach_log`
5. Emite evento SSE `outreach:sent`

Cada envio cria sessão no inbox unificado para que respostas sejam rastreadas.

**Envio por canal:**

| Recipient Type | Como Envia |
|---------------|-----------|
| `user` | Busca canal preferido do usuário e envia por ele |
| `whatsapp` | Connector WhatsApp existente (Evolution/Cloud API) |
| `slack` | Connector Slack existente |
| `teams` | Connector Teams existente |
| `email` | Connector Email existente (S-038) |

### Feature F-167: API endpoints outreach

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/outreach/rules` | Listar regras |
| POST | `/agents/:id/outreach/rules` | Criar regra |
| PUT | `/agents/:id/outreach/rules/:ruleId` | Atualizar regra |
| DELETE | `/agents/:id/outreach/rules/:ruleId` | Remover regra |
| POST | `/agents/:id/outreach/rules/:ruleId/test` | Testar regra (simula envio) |
| GET | `/agents/:id/outreach/log` | Histórico de outreach |
| GET | `/agents/:id/outreach/stats` | Estatísticas |

**POST `/agents/:id/outreach/rules` — Request:**

```json
{
  "label": "Follow-up lead inativo",
  "triggerType": "webhook",
  "triggerConfig": {
    "webhookPath": "/webhook/crm-update",
    "condition": { "field": "payload.event", "operator": "equals", "value": "lead_inactive_30d" }
  },
  "recipientType": "whatsapp",
  "recipientId": "+5511999887766",
  "messageTemplate": "Olá! Notamos que faz um tempo desde nosso último contato. Posso ajudar com algo?",
  "cooldownHours": 48,
  "maxPerDay": 2
}
```

**POST `/agents/:id/outreach/rules/:ruleId/test` — Response:**

```json
{
  "wouldSend": true,
  "resolvedMessage": "Olá! Notamos que faz um tempo desde nosso último contato.",
  "recipientType": "whatsapp",
  "recipientId": "+5511999887766",
  "throttleStatus": { "withinCooldown": false, "sentToday": 1, "maxPerDay": 2 }
}
```

**GET `/agents/:id/outreach/stats` — Response:**

```json
{
  "totalRules": 5,
  "activeRules": 4,
  "last30Days": { "sent": 87, "delivered": 82, "failed": 3, "throttled": 12 },
  "byRecipientType": { "whatsapp": 45, "email": 30, "slack": 12 }
}
```

### Feature F-168: Hub — página /agents/:id/outreach

**`/agents/:id/outreach` — Regras de Outreach:**

- Lista de regras: label, trigger type (badge), recipient (ícone do canal + ID), status (enabled/disabled), últimos 7 dias (sent/failed count)
- Botão "Nova Regra": formulário com label, trigger type (select), config dinâmica por tipo, recipient type (select com ícones), recipient ID, message template (textarea com hint de variáveis), cooldown e max por dia
- Botão "Testar" por regra: simula e mostra resultado
- Toggle enable/disable por regra

**`/agents/:id/outreach/log` — Histórico:**

- Tabela: data/hora, regra, destinatário, mensagem (truncada), status (badge: sent/delivered/failed/throttled)
- Filtros: por regra, por status, por período
- Click na linha abre detalhes: mensagem completa, contexto do trigger, sessão criada (link para inbox)

**`/agents/:id` — Badge de Outreach:**

- Se agente tem regras ativas: badge "Outreach: X regras ativas" com ícone de megafone
- Posicionado ao lado do badge de heartbeat existente

## Limites

- **NÃO** implementar outreach com conteúdo gerado por IA neste PRP (apenas templates estáticos com variáveis)
- **NÃO** implementar A/B testing de templates
- **NÃO** implementar analytics de conversão de outreach
- **NÃO** implementar filas de envio com retry (envio síncrono, falha registrada no log)

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestão de Agentes) deve estar implementado — nova página adicionada
- Canais existentes (WhatsApp, Slack, Teams, Email — Sprint 5/6) devem estar implementados
- Inbox Unificado (Sprint 5, S-024) deve estar implementado — sessão criada para cada outreach
- Webhooks Inbound (Sprint 5, S-025) devem estar implementados — trigger webhook
- Jobs (existente) devem estar implementados — trigger job_status

## Validacao

- [ ] Regra com trigger webhook dispara ao receber webhook matching
- [ ] Regra com trigger schedule dispara no horário configurado
- [ ] Regra com trigger schedule + memoryCondition só dispara se memória tem resultado relevante
- [ ] Regra com trigger job_status dispara ao detectar mudança de status matching
- [ ] Mensagem enviada via canal correto (WhatsApp, Slack, Teams, Email)
- [ ] Sessão criada no inbox unificado para rastrear resposta
- [ ] Throttle por cooldown respeitado
- [ ] Throttle por max_per_day respeitado
- [ ] Outreach throttled registrado no log com status `throttled`
- [ ] Teste de regra simula sem enviar e mostra resultado esperado
- [ ] Histórico de outreach exibe status de entrega por envio
- [ ] `npm run build` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-165 Tabelas outreach + migração | S-046 sec 2 | D-067 |
| F-166 OutreachManager (regras, triggers, executor) | S-046 sec 3 | D-067, G-067 |
| F-167 API endpoints outreach | S-046 sec 4 | G-067 |
| F-168 Hub outreach página + histórico | S-046 sec 5 | G-067 |
