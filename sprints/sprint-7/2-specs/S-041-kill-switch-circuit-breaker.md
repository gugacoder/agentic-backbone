# S-041 — Kill-switch e Circuit-breaker por Agente

Mecanismo de parada de emergência (kill-switch manual) e proteção automática (circuit-breaker) por agente. Permite interromper imediatamente todas as ações autônomas de um agente com um clique, e configurar limites automáticos que pausam o agente ao detectar padrões de falha ou excesso de ações.

**Resolve:** D-062 (falha silenciosa sem kill-switch), G-062 (kill-switch + circuit-breaker)
**Score de prioridade:** 9
**Dependência:** Rate limiting existente (Sprint 5, S-029)

---

## 1. Objetivo

- Kill-switch manual por agente: botão que bloqueia imediatamente heartbeat, cron e webhooks do agente
- Circuit-breaker automático: configura thresholds (X falhas consecutivas ou Y% erro em N minutos → pausa automática + alerta)
- Teto de ações por hora/dia por agente (complementa rate limiting existente — limita execuções de tool calls, não apenas requests)
- Log de ações interrompidas com contexto completo (qual ação foi bloqueada, por quê, quando)
- Dashboard de status do circuit-breaker por agente
- Integração com sistema de notificações push (PWA) existente

---

## 2. Schema DB

### 2.1 Tabela `circuit_breaker_config`

```sql
CREATE TABLE IF NOT EXISTS circuit_breaker_config (
  agent_id              TEXT PRIMARY KEY,
  enabled               INTEGER NOT NULL DEFAULT 1,
  max_consecutive_fails INTEGER NOT NULL DEFAULT 5,
  error_rate_threshold  REAL NOT NULL DEFAULT 0.5,     -- 50%
  error_rate_window_min INTEGER NOT NULL DEFAULT 10,    -- janela de 10 minutos
  max_actions_per_hour  INTEGER NOT NULL DEFAULT 100,
  max_actions_per_day   INTEGER NOT NULL DEFAULT 1000,
  cooldown_min          INTEGER NOT NULL DEFAULT 30,    -- tempo de pausa automática
  auto_resume           INTEGER NOT NULL DEFAULT 0,     -- 1 = resume após cooldown
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 Tabela `circuit_breaker_events`

```sql
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id              TEXT PRIMARY KEY,                   -- uuid v4
  agent_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL,                      -- 'tripped' | 'resumed' | 'kill_switch_on' | 'kill_switch_off' | 'action_blocked'
  trigger_reason  TEXT,                               -- ex: 'consecutive_fails:5', 'error_rate:0.65', 'action_limit:hour', 'manual'
  context         TEXT,                               -- JSON: ação que disparou, estado no momento
  actor           TEXT,                               -- userId que acionou (null se automático)
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cb_events_agent ON circuit_breaker_events(agent_id);
CREATE INDEX idx_cb_events_created ON circuit_breaker_events(created_at);
CREATE INDEX idx_cb_events_type ON circuit_breaker_events(event_type);
```

### 2.3 Coluna em agente (in-memory via registry)

O campo `kill_switch` é mantido no AgentRegistry em memória (não persiste em AGENT.yml para evitar file I/O em operação de emergência). Estado persistido na tabela `circuit_breaker_events` para recovery após restart.

---

## 3. Módulo `src/circuit-breaker/`

### 3.1 Estrutura

```
src/circuit-breaker/
  index.ts              # CircuitBreakerManager: singleton, integra com AgentRegistry
  config.ts             # CRUD de circuit_breaker_config
  monitor.ts            # Conta falhas, calcula error rate, verifica limites de ações
  schemas.ts            # Zod schemas
```

### 3.2 CircuitBreakerManager

```typescript
interface CircuitBreakerState {
  agentId: string
  killSwitch: boolean           // manual kill
  tripped: boolean              // circuit-breaker automático ativo
  trippedAt: string | null
  resumeAt: string | null       // se auto_resume, quando retoma
  consecutiveFails: number
  actionsThisHour: number
  actionsToday: number
}

class CircuitBreakerManager {
  // Chamado ANTES de qualquer execução autônoma (heartbeat, cron, webhook)
  canExecute(agentId: string): { allowed: boolean; reason?: string }

  // Chamado APÓS cada execução
  recordOutcome(agentId: string, success: boolean): void

  // Kill-switch manual
  activateKillSwitch(agentId: string, actorId: string): void
  deactivateKillSwitch(agentId: string, actorId: string): void

  // Estado
  getState(agentId: string): CircuitBreakerState
  getAllStates(): CircuitBreakerState[]

  // Resume após trip
  resume(agentId: string, actorId: string): void
}
```

### 3.3 Integração com Heartbeat, Cron e Webhooks

No início de cada execução autônoma, o sistema chama `canExecute(agentId)`. Se retornar `allowed: false`:
1. A execução é bloqueada
2. Um evento `action_blocked` é registrado em `circuit_breaker_events`
3. Log de contexto: qual ação seria executada, motivo do bloqueio

```typescript
// Em heartbeat/scheduler.ts, antes de chamar runAgent():
const check = circuitBreaker.canExecute(agentId)
if (!check.allowed) {
  logger.warn(`Agent ${agentId} blocked: ${check.reason}`)
  return // skip this tick
}
```

Mesma verificação em `cron/scheduler.ts` e no handler de webhooks.

### 3.4 Lógica de Trip

O circuit-breaker dispara (trip) quando qualquer condição é atingida:

1. **Falhas consecutivas:** `consecutiveFails >= max_consecutive_fails`
2. **Taxa de erro:** erros nos últimos `error_rate_window_min` minutos > `error_rate_threshold`
3. **Limite de ações/hora:** `actionsThisHour >= max_actions_per_hour`
4. **Limite de ações/dia:** `actionsToday >= max_actions_per_day`

Ao disparar:
- Registra evento `tripped` com `trigger_reason`
- Emite evento no EventBus: `circuit_breaker:tripped`
- Envia notificação push (PWA)
- Se `auto_resume: true`, agenda resume após `cooldown_min`

---

## 4. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/circuit-breaker` | Estado atual do circuit-breaker do agente |
| PUT | `/agents/:id/circuit-breaker/config` | Atualizar configuração do circuit-breaker |
| POST | `/agents/:id/circuit-breaker/kill` | Ativar kill-switch (parada imediata) |
| POST | `/agents/:id/circuit-breaker/resume` | Desativar kill-switch / resume após trip |
| GET | `/agents/:id/circuit-breaker/events` | Histórico de eventos do circuit-breaker |
| GET | `/system/circuit-breaker` | Estado de todos os agents (para fleet view) |

### 4.1 PUT `/agents/:id/circuit-breaker/config`

**Request:**
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

### 4.2 GET `/agents/:id/circuit-breaker`

**Response:**
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
  "config": {
    "enabled": true,
    "maxConsecutiveFails": 5,
    "errorRateThreshold": 0.5,
    "errorRateWindowMin": 10,
    "maxActionsPerHour": 100,
    "maxActionsPerDay": 1000,
    "cooldownMin": 30,
    "autoResume": false
  }
}
```

---

## 5. Eventos SSE

| Evento | Canal | Payload |
|--------|-------|---------|
| `circuit_breaker:tripped` | `/system/events` | `{ agentId, reason, trippedAt }` |
| `circuit_breaker:resumed` | `/system/events` | `{ agentId, actor, resumedAt }` |
| `circuit_breaker:kill_switch` | `/system/events` | `{ agentId, active, actor }` |

---

## 6. Telas (Hub)

### 6.1 `/agents/:id` — Seção Circuit-breaker

- **Kill-switch**: botão vermelho proeminente "Parar Agente" / "Reativar Agente" com confirmação
- **Status**: indicador visual (verde = operando, amarelo = circuit-breaker ativo, vermelho = kill-switch ativo)
- **Contadores em tempo real**: falhas consecutivas, ações/hora, ações/dia (progress bars com threshold marcado)
- **Configuração**: formulário editável com os campos de `circuit_breaker_config`
- **Histórico**: tabela das últimas 20 eventos com tipo, motivo, ator e timestamp

### 6.2 `/agents` — Lista de agentes

- Badge de status do circuit-breaker ao lado de cada agente: ícone de escudo (verde/amarelo/vermelho)
- Agentes com kill-switch ativo aparecem com destaque visual (borda vermelha ou badge "PARADO")

### 6.3 Notificação push

- Ao trip automático: "⚠ Agente {label} pausado automaticamente: {reason}"
- Ao kill-switch manual: "🛑 Agente {label} parado por {actor}"

---

## 7. Critérios de Aceite

- [ ] Botão kill-switch bloqueia imediatamente heartbeat, cron e webhooks do agente — efeito em <1s
- [ ] Kill-switch persiste após restart do backbone (recuperado de `circuit_breaker_events`)
- [ ] Circuit-breaker dispara ao atingir `max_consecutive_fails` e pausa o agente
- [ ] Circuit-breaker dispara ao atingir `error_rate_threshold` na janela configurada
- [ ] Limite de ações/hora e ações/dia bloqueia execuções excedentes
- [ ] Cada ação bloqueada é registrada em `circuit_breaker_events` com contexto
- [ ] Notificação push enviada ao trip automático e ao kill-switch manual
- [ ] `auto_resume` retoma o agente após `cooldown_min` minutos
- [ ] API `/system/circuit-breaker` retorna estado de todos os agentes
- [ ] Hub exibe status em tempo real via SSE (sem polling)
