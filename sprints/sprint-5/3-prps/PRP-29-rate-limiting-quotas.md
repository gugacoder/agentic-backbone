# PRP-29 — Rate Limiting e Quotas por Agente

Sistema de limites de consumo configuravel por agente: tokens por hora, heartbeats por dia, timeout de tool call. Enforcement automatico em `runAgent()`, auto-pausa com evento SSE e dashboard de consumo.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha controle de consumo de tokens ou heartbeats por agente. Um agente pode consumir recursos ilimitados, causando custos explosivos. Nao ha tabelas de quotas no SQLite. O `runAgent()` nao verifica limites antes de executar.

### Estado desejado

1. Tabelas `agent_quotas` e `agent_quota_usage` no SQLite
2. Leitura de quotas do frontmatter do AGENT.md como fonte primaria
3. Enforcement em `runAgent()`: bloquear execucao ao exceder limites
4. Auto-pausa do agente (`enabled: false`) com evento SSE `agent:quota-exceeded`
5. Endpoints de gestao de quotas e aba "Quotas" no Hub

## Especificacao

### Feature F-112: Tabelas de quotas + migracao DB + leitura de frontmatter

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS agent_quotas (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id             TEXT NOT NULL UNIQUE,
  max_tokens_per_hour  INTEGER,
  max_heartbeats_day   INTEGER,
  max_tool_timeout_ms  INTEGER DEFAULT 30000,
  max_tokens_per_run   INTEGER,
  pause_on_exceed      INTEGER NOT NULL DEFAULT 1,
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_quota_usage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  window_type  TEXT NOT NULL,
  window_start TEXT NOT NULL,
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  heartbeats   INTEGER NOT NULL DEFAULT 0,
  tool_calls   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_quota_usage_agent_window ON agent_quota_usage(agent_id, window_type, window_start);
```

Adicionar migracao no startup do backbone.

**Leitura de frontmatter do AGENT.md:**

Estender o parser de agentes para reconhecer campo `quotas`:

```yaml
quotas:
  max_tokens_per_hour: 50000
  max_heartbeats_day: 48
  max_tool_timeout_ms: 30000
  pause_on_exceed: true
```

`agent_quotas` (DB) serve como override via GUI — se entrada existir no DB, prevalece sobre frontmatter.

Criar modulo `src/quotas/quota-manager.ts` com:
- `getQuotas(agentId)`: carrega config (frontmatter fallback para DB)
- `getUsage(agentId, windowType, windowStart)`: consulta `agent_quota_usage`
- `recordUsage(agentId, tokensIn, tokensOut, mode)`: atualiza janelas horaria e diaria
- `checkExceeded(agentId, mode)`: retorna `{ exceeded: boolean, reason? }`

### Feature F-113: Enforcement em runAgent() + tool timeout

**Antes de cada execucao de agente (`runAgent()`):**

```
1. checkExceeded(agentId, mode)
2. Se exceeded E pause_on_exceed:
   - Escrever enabled: false no AGENT.md via filesystem
   - Emitir evento SSE: { type: "agent:quota-exceeded", agentId, quota, value }
   - Retornar sem executar (com log)
3. Se exceeded E !pause_on_exceed:
   - Logar aviso, continuar execucao
4. Se heartbeat E heartbeats >= max_heartbeats_day: skip silencioso
5. Ao concluir: chamar recordUsage() com tokens da resposta
```

**Tool call timeout:**

- Aplicar `AbortSignal.timeout(max_tool_timeout_ms)` em cada tool call
- Se timeout: tool retorna `{ error: "timeout", ms: N }` sem abortar o agente
- Registrar ocorrencia em `agent_quota_usage.tool_calls`

**Evento SSE:**

Adicionar tipo `agent:quota-exceeded` ao event bus do backbone:
```typescript
{ type: "agent:quota-exceeded", agentId: string, quota: string, value: number }
```

### Feature F-114: Endpoints de gestao de quotas

**Novas rotas em `apps/backbone/src/routes/quotas.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/quota` | Configuracao + consumo atual das janelas |
| PUT | `/agents/:agentId/quota` | Atualizar configuracao de quotas |
| DELETE | `/agents/:agentId/quota` | Remover quotas customizadas (volta ao frontmatter/default) |
| POST | `/agents/:agentId/quota/reset` | Resetar consumo da janela atual |

**GET response:**
```json
{
  "agentId": "system.main",
  "config": { "maxTokensPerHour": 50000, "maxHeartbeatsDay": 48, "maxToolTimeoutMs": 30000, "pauseOnExceed": true },
  "usage": {
    "hourly": { "windowStart": "...", "tokensUsed": 12340, "pctUsed": 24.7 },
    "daily": { "windowStart": "...", "heartbeats": 18, "pctUsed": 37.5 }
  },
  "status": "active"
}
```

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/quotas.ts`:**

```typescript
export const quotaQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["quota", agentId],
    queryFn: () => request<AgentQuota>(`/agents/${agentId}/quota`),
  });
```

### Feature F-115: Telas Hub — aba Quotas e widget no dashboard

**Nova aba "Quotas"** na pagina do agente (`/agents/:id`) com rota `routes/_authenticated/agents/$agentId/quotas.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `QuotasTab` | `routes/_authenticated/agents/$agentId/quotas.tsx` |
| `QuotaGauge` | `components/quotas/quota-gauge.tsx` |
| `QuotaConfigForm` | `components/quotas/quota-config-form.tsx` |

**QuotasTab:**
- 2 gauges circulares: Tokens/hora (tokensUsed/maxTokensPerHour), Heartbeats/dia
- Badge de status: "Ativo" (verde) / "Pausado por quota" (vermelho)
- Tabela de configuracao editavel inline: max_tokens_per_hour, max_heartbeats_day, max_tool_timeout_ms, pause_on_exceed (toggle)
- Botao "Salvar configuracao" (PUT)
- Botao "Resetar janela atual" com dialog de confirmacao (POST /reset)

**Widget no `/dashboard`:**
- Lista de agentes com consumo > 80% de qualquer quota (amarelo) ou pausados por quota (vermelho)
- Link direto para aba de quotas de cada agente

**Notificacao SSE no Hub:**
- Toast de alerta quando evento `agent:quota-exceeded` recebido via SSE
- Toast inclui: nome do agente, qual quota foi atingida, link para pagina do agente

## Limites

- **NAO** implementar quotas globais (por operador/instancia) — apenas por agente
- **NAO** implementar historico de janelas antigas (apenas janela atual)
- **NAO** implementar notificacao por email ao exceder quota

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba adicionada
- Event bus SSE deve estar funcionando

## Validacao

- [ ] Agente com `max_tokens_per_hour` configurado e pausado automaticamente ao exceder
- [ ] Heartbeat e bloqueado quando `max_heartbeats_day` atingido
- [ ] Tool call abortado por timeout apos `max_tool_timeout_ms` ms
- [ ] Consumo de tokens atualizado na janela correta ao final de cada execucao
- [ ] GUI exibe consumo vs. quota com gauges
- [ ] Botao de reset manual zera consumo da janela atual
- [ ] Evento SSE `agent:quota-exceeded` emitido quando agente e pausado
- [ ] Quotas configuradas no AGENT.md frontmatter sao respeitadas sem entrada no DB
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-112 Tabelas + migracao + frontmatter | S-029 sec 2 | D-049 |
| F-113 Enforcement em runAgent + timeout | S-029 sec 3 | D-049, G-050 |
| F-114 Endpoints de gestao de quotas | S-029 sec 4 | G-050 |
| F-115 Telas Hub quotas + widget dashboard | S-029 sec 5 | G-050 |
