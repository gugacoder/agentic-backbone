# S-029 — Rate Limiting e Quotas por Agente

Sistema de limites de consumo configuravel por agente: tokens por hora, heartbeats por dia, timeout de tool call. Dashboard de consumo vs. quota e pausa automatica ao atingir limite.

**Resolve:** D-049 (custos explosivos sem controle), G-050 (rate limiting e quotas)
**Score de prioridade:** 8

---

## 1. Objetivo

- Permitir configurar quotas individuais por agente (tokens/hora, heartbeats/dia, tool call timeout)
- Monitorar consumo em tempo real e comparar contra quotas
- Pausar automaticamente o agente ao atingir limite, com notificacao
- Dashboard de consumo vs. quota por agente
- Reset diario/horario automatico das quotas

---

## 2. Schema DB

### 2.1 Tabela `agent_quotas`

```sql
CREATE TABLE IF NOT EXISTS agent_quotas (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id             TEXT NOT NULL UNIQUE,
  max_tokens_per_hour  INTEGER,   -- null = sem limite
  max_heartbeats_day   INTEGER,   -- null = sem limite
  max_tool_timeout_ms  INTEGER DEFAULT 30000,
  max_tokens_per_run   INTEGER,   -- null = sem limite por execucao
  pause_on_exceed      INTEGER NOT NULL DEFAULT 1,  -- 1 = pausar, 0 = so alertar
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 Tabela `agent_quota_usage`

```sql
CREATE TABLE IF NOT EXISTS agent_quota_usage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  window_type  TEXT NOT NULL,   -- 'hourly' | 'daily'
  window_start TEXT NOT NULL,   -- ISO timestamp do inicio da janela
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  heartbeats   INTEGER NOT NULL DEFAULT 0,
  tool_calls   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_quota_usage_agent_window ON agent_quota_usage(agent_id, window_type, window_start);
```

### 2.3 Coluna adicional em tabela de agentes (filesystem-based)

Novo campo no AGENT.md frontmatter (alternativa a DB para configuracao):

```yaml
quotas:
  max_tokens_per_hour: 50000
  max_heartbeats_day: 48
  max_tool_timeout_ms: 30000
  pause_on_exceed: true
```

> Implementar leitura de quotas do AGENT.md frontmatter como fonte primaria; `agent_quotas` como override via GUI.

---

## 3. Logica de Enforcement

### 3.1 Antes de cada execucao de agente (`runAgent()`)

```
1. Carregar quotas do agente (frontmatter AGENT.md ou agent_quotas DB)
2. Consultar agent_quota_usage para janela atual (hora / dia)
3. Se tokens_used >= max_tokens_per_hour → pausa ou alerta
4. Se heartbeats >= max_heartbeats_day e modo = heartbeat → skip
5. Se passou: registrar inicio, executar agente
6. Ao concluir: atualizar tokens_used + heartbeats na janela
```

### 3.2 Durante execucao — tool call timeout

- `max_tool_timeout_ms` e aplicado como `AbortSignal.timeout()` em cada tool call
- Se timeout: tool retorna erro `{ error: "timeout", ms: N }` sem abortar o agente

### 3.3 Auto-pausa

Quando `pause_on_exceed = true` e quota excedida:
- Campo `enabled: false` e escrito no AGENT.md via filesystem
- Evento SSE emitido: `{ type: "agent:quota-exceeded", agentId, quota: "tokens_per_hour", value: N }`
- Notificacao push (PWA) se habilitado

---

## 4. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/quota` | Obter configuracao e consumo atual |
| PUT | `/agents/:agentId/quota` | Atualizar configuracao de quotas |
| DELETE | `/agents/:agentId/quota` | Remover quotas customizadas (volta ao default) |
| POST | `/agents/:agentId/quota/reset` | Resetar consumo da janela atual (manual) |

### 4.1 GET `/agents/:agentId/quota` — Response

```json
{
  "agentId": "system.main",
  "config": {
    "maxTokensPerHour": 50000,
    "maxHeartbeatsDay": 48,
    "maxToolTimeoutMs": 30000,
    "pauseOnExceed": true
  },
  "usage": {
    "hourly": {
      "windowStart": "2026-03-07T15:00:00Z",
      "tokensUsed": 12340,
      "pctUsed": 24.7
    },
    "daily": {
      "windowStart": "2026-03-07T00:00:00Z",
      "heartbeats": 18,
      "pctUsed": 37.5
    }
  },
  "status": "active"  -- "active" | "paused_quota"
}
```

---

## 5. Telas (Hub)

### 5.1 `/agents/:id` — Aba "Quotas"

- Cards de consumo: Tokens/hora (gauge circular), Heartbeats/dia (gauge)
- Tabela de configuracao editavel inline: max_tokens_per_hour, max_heartbeats_day, max_tool_timeout_ms, pause_on_exceed (toggle)
- Badge de status: "Ativo" (verde) / "Pausado por quota" (vermelho)
- Botao "Resetar janela atual" (com confirmacao)

### 5.2 `/dashboard` — Widget de alertas de quota

- Lista de agentes com consumo > 80% da quota (amarelo) ou pausados por quota (vermelho)
- Link direto para aba de quotas de cada agente

### 5.3 Notificacao SSE no Hub

- Toast de alerta quando agente e pausado por quota (`agent:quota-exceeded`)
- Toast inclui: nome do agente, qual quota foi atingida, link para pagina do agente

---

## 6. Criterios de Aceite

- [ ] Agente com `max_tokens_per_hour` configurado e pausado automaticamente ao exceder limite
- [ ] Heartbeat e bloqueado quando `max_heartbeats_day` for atingido
- [ ] Tool call e abortado por timeout apos `max_tool_timeout_ms` ms
- [ ] Consumo de tokens e atualizado na janela correta (horaria/diaria) ao final de cada execucao
- [ ] GUI exibe consumo vs. quota em tempo real (atualiza via SSE ou refetch apos execucao)
- [ ] Botao de reset manual zera consumo da janela atual
- [ ] Evento SSE `agent:quota-exceeded` e emitido quando agente e pausado
- [ ] Quotas configuradas no AGENT.md frontmatter sao respeitadas mesmo sem entrada no DB
