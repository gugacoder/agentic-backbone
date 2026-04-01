# PRP-42 — Kill-switch e Circuit-breaker por Agente

Mecanismo de parada de emergência (kill-switch manual) e proteção automática (circuit-breaker) por agente. Permite interromper imediatamente todas as ações autônomas de um agente com um clique, e configurar limites automáticos que pausam o agente ao detectar padrões de falha ou excesso de ações.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Não há mecanismo de parada de emergência para agentes autônomos. Se um agente entra em loop de falhas ou executa ações indesejadas, a única opção é desabilitar manualmente via AGENT.yml (file I/O lento) ou reiniciar o backbone inteiro. Não existe rate limiting de ações (apenas de requests). Não há log de ações bloqueadas.

### Estado desejado

1. Tabelas `circuit_breaker_config` e `circuit_breaker_events` no SQLite
2. Módulo `src/circuit-breaker/` com CircuitBreakerManager (kill-switch, trip logic, monitor)
3. Integração com heartbeat, cron e webhooks — check `canExecute()` antes de cada execução autônoma
4. API REST para gerenciar circuit-breaker por agente
5. Eventos SSE para atualização em tempo real no Hub
6. Seção de circuit-breaker na página do agente + badges na lista de agentes

## Especificacao

### Feature F-144: Tabelas circuit_breaker + migração DB

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS circuit_breaker_config (
  agent_id              TEXT PRIMARY KEY,
  enabled               INTEGER NOT NULL DEFAULT 1,
  max_consecutive_fails INTEGER NOT NULL DEFAULT 5,
  error_rate_threshold  REAL NOT NULL DEFAULT 0.5,
  error_rate_window_min INTEGER NOT NULL DEFAULT 10,
  max_actions_per_hour  INTEGER NOT NULL DEFAULT 100,
  max_actions_per_day   INTEGER NOT NULL DEFAULT 1000,
  cooldown_min          INTEGER NOT NULL DEFAULT 30,
  auto_resume           INTEGER NOT NULL DEFAULT 0,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  trigger_reason  TEXT,
  context         TEXT,
  actor           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cb_events_agent ON circuit_breaker_events(agent_id);
CREATE INDEX idx_cb_events_created ON circuit_breaker_events(created_at);
CREATE INDEX idx_cb_events_type ON circuit_breaker_events(event_type);
```

Adicionar migração no startup do backbone.

### Feature F-145: CircuitBreakerManager — módulo src/circuit-breaker/

**Nova estrutura:**

```
src/circuit-breaker/
  index.ts              # CircuitBreakerManager: singleton, integra com AgentRegistry
  config.ts             # CRUD de circuit_breaker_config
  monitor.ts            # Conta falhas, calcula error rate, verifica limites de ações
  schemas.ts            # Zod schemas
```

**CircuitBreakerManager:**

```typescript
interface CircuitBreakerState {
  agentId: string
  killSwitch: boolean
  tripped: boolean
  trippedAt: string | null
  resumeAt: string | null
  consecutiveFails: number
  actionsThisHour: number
  actionsToday: number
}

class CircuitBreakerManager {
  canExecute(agentId: string): { allowed: boolean; reason?: string }
  recordOutcome(agentId: string, success: boolean): void
  activateKillSwitch(agentId: string, actorId: string): void
  deactivateKillSwitch(agentId: string, actorId: string): void
  getState(agentId: string): CircuitBreakerState
  getAllStates(): CircuitBreakerState[]
  resume(agentId: string, actorId: string): void
}
```

Lógica de trip: dispara quando `consecutiveFails >= max_consecutive_fails` OU `error_rate > threshold` na janela OU `actions >= max_per_hour/day`. Kill-switch mantido in-memory (AgentRegistry) para resposta <1s, persistido via events para recovery.

Ao disparar: registra evento, emite no EventBus (`circuit_breaker:tripped`), envia notificação push (PWA). Se `auto_resume: true`, agenda resume após `cooldown_min`.

### Feature F-146: API endpoints circuit-breaker

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/circuit-breaker` | Estado atual do circuit-breaker |
| PUT | `/agents/:id/circuit-breaker/config` | Atualizar configuração |
| POST | `/agents/:id/circuit-breaker/kill` | Ativar kill-switch |
| POST | `/agents/:id/circuit-breaker/resume` | Desativar kill-switch / resume |
| GET | `/agents/:id/circuit-breaker/events` | Histórico de eventos |
| GET | `/system/circuit-breaker` | Estado de todos os agentes |

**PUT `/agents/:id/circuit-breaker/config` — Request:**

```json
{
  "enabled": true,
  "maxConsecutiveFails": 5,
  "errorRateThreshold": 0.5,
  "errorRateWindowMin": 10,
  "maxActionsPerHour": 100,
  "maxActionsPerDay": 1000,
  "cooldownMin": 30,
  "autoResume": false
}
```

**GET `/agents/:id/circuit-breaker` — Response:**

```json
{
  "agentId": "system.main",
  "killSwitch": false,
  "tripped": false,
  "trippedAt": null,
  "resumeAt": null,
  "consecutiveFails": 2,
  "actionsThisHour": 14,
  "actionsToday": 87,
  "config": { "enabled": true, "maxConsecutiveFails": 5, "..." : "..." }
}
```

### Feature F-147: Integração com heartbeat, cron e webhooks

Inserir check `canExecute(agentId)` no início de cada execução autônoma:

- `heartbeat/scheduler.ts` — antes de chamar `runAgent()`
- `cron/scheduler.ts` — antes de executar job
- Handler de webhooks — antes de processar

Se `canExecute()` retorna `allowed: false`: bloqueia execução, registra evento `action_blocked` com contexto completo (qual ação seria executada, motivo).

Inserir `recordOutcome(agentId, success)` ao final de cada execução para alimentar contadores.

**Eventos SSE:**

| Evento | Canal | Payload |
|--------|-------|---------|
| `circuit_breaker:tripped` | `/system/events` | `{ agentId, reason, trippedAt }` |
| `circuit_breaker:resumed` | `/system/events` | `{ agentId, actor, resumedAt }` |
| `circuit_breaker:kill_switch` | `/system/events` | `{ agentId, active, actor }` |

### Feature F-148: Hub — seção circuit-breaker + badges na lista

**`/agents/:id` — Seção Circuit-breaker:**

- Botão kill-switch vermelho proeminente "Parar Agente" / "Reativar Agente" com confirmação
- Indicador visual de status: verde (operando), amarelo (circuit-breaker ativo), vermelho (kill-switch)
- Contadores em tempo real: falhas consecutivas, ações/hora, ações/dia (progress bars com threshold)
- Formulário de configuração editável
- Tabela das últimas 20 eventos com tipo, motivo, ator, timestamp

**`/agents` — Lista de agentes:**

- Badge de status do circuit-breaker: ícone de escudo (verde/amarelo/vermelho)
- Agentes com kill-switch ativo: destaque visual (borda vermelha ou badge "PARADO")

**Atualização via SSE:** conecta ao `/system/events`, atualiza sem refresh ao receber eventos `circuit_breaker:*`.

## Limites

- **NÃO** implementar circuit-breaker para modo conversation (apenas heartbeat, cron, webhooks)
- **NÃO** implementar circuit-breaker cross-agent (cada agente tem configuração independente)
- **NÃO** implementar alertas por email/SMS — apenas notificação push (PWA) existente

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestão de Agentes) deve estar implementado — nova seção na página do agente
- Rate limiting existente (Sprint 5, S-029) — complementa mas não substitui

## Validacao

- [ ] Botão kill-switch bloqueia imediatamente heartbeat, cron e webhooks do agente — efeito em <1s
- [ ] Kill-switch persiste após restart do backbone (recuperado de `circuit_breaker_events`)
- [ ] Circuit-breaker dispara ao atingir `max_consecutive_fails` e pausa o agente
- [ ] Circuit-breaker dispara ao atingir `error_rate_threshold` na janela configurada
- [ ] Limite de ações/hora e ações/dia bloqueia execuções excedentes
- [ ] Cada ação bloqueada registrada em `circuit_breaker_events` com contexto
- [ ] Notificação push enviada ao trip automático e ao kill-switch manual
- [ ] `auto_resume` retoma o agente após `cooldown_min` minutos
- [ ] API `/system/circuit-breaker` retorna estado de todos os agentes
- [ ] Hub exibe status em tempo real via SSE (sem polling)
- [ ] `npm run build` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-144 Tabelas circuit_breaker + migração | S-041 sec 2 | D-062 |
| F-145 CircuitBreakerManager | S-041 sec 3 | D-062, G-062 |
| F-146 API endpoints circuit-breaker | S-041 sec 4 | G-062 |
| F-147 Integração heartbeat/cron/webhooks + SSE | S-041 sec 3.3, 5 | D-062, G-062 |
| F-148 Hub circuit-breaker + badges | S-041 sec 6 | G-062 |
