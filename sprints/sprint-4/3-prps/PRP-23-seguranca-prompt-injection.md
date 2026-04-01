# PRP-23 — Seguranca: Deteccao de Prompt Injection e Monitoramento

Camada de filtragem de mensagens suspeitas antes de chegarem ao agente, com regras pre-populadas, log auditavel de eventos, alertas automaticos por volume anomalo e dashboard de seguranca.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha nenhuma camada de seguranca entre a mensagem do usuario e o agente. Mensagens sao passadas diretamente para `runAgent()` sem qualquer filtragem. Nao ha tabelas de eventos de seguranca nem regras configuradas.

### Estado desejado

1. Tabelas `security_events` e `security_rules` com regras pre-populadas
2. Interceptor de mensagens em `conversations/index.ts`
3. Endpoints para log de eventos, summary e CRUD de regras
4. Background job para deteccao de anomalia por volume
5. Dashboard `/security` no Hub com resumo, tendencia e log

## Especificacao

### Feature F-091: Tabelas de seguranca + regras pre-populadas

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS security_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id      TEXT NOT NULL,
  session_id    TEXT,
  event_type    TEXT NOT NULL,
  severity      TEXT NOT NULL,
  action        TEXT NOT NULL,
  input_hash    TEXT NOT NULL,
  input_excerpt TEXT,
  pattern_matched TEXT,
  score         REAL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_security_agent ON security_events(agent_id, created_at);
CREATE INDEX idx_security_type ON security_events(event_type, action);

CREATE TABLE IF NOT EXISTS security_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  pattern     TEXT NOT NULL,
  rule_type   TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'medium',
  action      TEXT NOT NULL DEFAULT 'flagged',
  is_system   INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Regras pre-populadas na migracao** (`is_system = 1`):

| name | pattern (JSON array) | severity | action |
|------|----------------------|----------|--------|
| `ignore_instructions` | `["ignore previous", "ignore your instructions", "ignore all instructions", "esqueca suas instrucoes", "ignore tudo"]` | high | blocked |
| `system_prompt_leak` | `["repeat your system prompt", "what are your instructions", "show me your soul", "mostre seu prompt"]` | high | flagged |
| `role_override` | `["you are now", "act as", "pretend you are", "voce agora eh", "finja que"]` | medium | flagged |
| `jailbreak_dan` | `["DAN", "do anything now", "jailbreak", "developer mode"]` | critical | blocked |
| `data_exfiltration` | `["list all users", "show database", "dump your memory", "listar todos os usuarios"]` | high | blocked |

### Feature F-092: Interceptor de mensagens + deteccao de anomalia

**Funcao `checkMessageSecurity()`** em novo modulo `apps/backbone/src/security/filter.ts`:

```typescript
async function checkMessageSecurity(
  input: string,
  agentId: string,
  sessionId: string
): Promise<SecurityCheckResult>
```

Algoritmo:
1. Normalizar input (lowercase, trim)
2. Para cada `security_rules` com `enabled = 1`:
   - `rule_type = 'keyword'`: verificar se alguma string do JSON array esta no input normalizado
   - `rule_type = 'regex'`: testar regex contra input normalizado
3. Calcular score de confianca (1.0 se match exato de keyword, variavel se regex)
4. Determinar `action`: se qualquer regra matched com `action = 'blocked'` → bloquear; se alguma `action = 'flagged'` → flagrar; caso contrario → allow
5. Para eventos `blocked` e `flagged`: inserir em `security_events` com `input_hash = SHA-256(input)`, `input_excerpt = input.slice(0, 200)`, `pattern_matched = rule.name`, `score`

**Integracao em `conversations/index.ts`** — inserir antes de `runAgent()`:
- Se `action = 'block'`: retornar mensagem de erro ao usuario ("Mensagem nao permitida pelo sistema de seguranca.") sem chamar agente
- Se `action = 'flag'`: passar mensagem ao agente normalmente; logar evento
- Se `action = 'allow'`: sem log

**Background job de anomalia** — executar a cada hora:
- Contar `security_events` das ultimas 1h por agente com `severity IN ('high', 'critical')`
- Se > 5 eventos → emitir notificacao com `type = 'security_anomaly'`, `severity = 'critical'`
- Emitir evento SSE `security:alert` consumido pelo hook `useSSE` do Hub para exibir toast

### Feature F-093: Endpoints de API de seguranca

**Novos endpoints em `apps/backbone/src/routes/security.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/security/events` | Listar eventos (query: `agent_id`, `severity`, `action`, `from`, `to`, `limit`, `offset`) |
| GET | `/security/summary` | Resumo consolidado (query: `days`) |
| GET | `/security/rules` | Listar regras |
| POST | `/security/rules` | Criar regra customizada (`is_system = 0`) |
| PATCH | `/security/rules/:id` | Atualizar regra (customizada ou toggle `enabled` de sistema) |
| DELETE | `/security/rules/:id` | Remover regra (apenas `is_system = 0`) |

**GET `/security/summary` response:**

```json
{
  "period": { "from": "2026-03-01", "to": "2026-03-07" },
  "totalEvents": 45,
  "byAction": { "blocked": 12, "flagged": 28 },
  "bySeverity": { "critical": 3, "high": 18, "medium": 24 },
  "byAgent": [{ "agentId": "system.main", "total": 32, "blocked": 8 }],
  "trend": [{ "date": "2026-03-01", "blocked": 2, "flagged": 4 }]
}
```

**Hub — `apps/hub/src/api/security.ts`:**

```typescript
export const securitySummaryQueryOptions = (days: number) =>
  queryOptions({
    queryKey: ["security", "summary", days],
    queryFn: () => request<SecuritySummary>(`/security/summary?days=${days}`),
  });

export const securityEventsQueryOptions = (params: SecurityEventsParams) =>
  queryOptions({
    queryKey: ["security", "events", params],
    queryFn: () => request<SecurityEventsResponse>(`/security/events?${new URLSearchParams(params)}`),
  });
```

### Feature F-094: Dashboard /security no Hub

**Nova rota** `routes/_authenticated/security/index.tsx`.

Item "Seguranca" (icone: `ShieldAlert`) no menu lateral em secao "Sistema".

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `SecurityPage` | `routes/_authenticated/security/index.tsx` |
| `SecuritySummaryCards` | `components/security/security-summary-cards.tsx` |
| `SecurityTrendChart` | `components/security/security-trend-chart.tsx` |
| `SecurityEventTable` | `components/security/security-event-table.tsx` |
| `SecurityRulesTab` | `components/security/security-rules-tab.tsx` |
| `SecurityRuleDialog` | `components/security/security-rule-dialog.tsx` |

**Layout (aba "Eventos"):**

```
+-- Cards de resumo (7 dias) ---------------------+
| Bloqueados: 12  Suspeitos: 28  Total: 40        |
+-------------------------------------------------+
| Tendencia de Ataques (barras empilhadas blocked/flagged) |
+-------------------------------------------------+
| Agentes Mais Visados                            |
| system.main    32 eventos  8 bloqueados         |
+-------------------------------------------------+
| Log de Eventos [filtros: agente, tipo, acao]    |
| HIGH  blocked  ignore_instructions  14:22       |
+-------------------------------------------------+
```

**Aba "Regras"** — `SecurityRulesTab`:
- Tabela de regras com toggle de `enabled`
- Regras `is_system = 1` marcadas como "Sistema" (nao removiveis, apenas toggle)
- Botao "+ Nova Regra" abre `SecurityRuleDialog` com campos: nome, descricao, tipo (regex/keyword), pattern (textarea), severidade, acao
- Regras customizadas: editar e remover

**Badge no menu lateral** — badge vermelho quando ha eventos `critical` nas ultimas 24h (calculado no summary).

Filtro de periodo no topo: 7 dias, 30 dias (query param `days`).

## Limites

- **NAO** implementar filtragem de respostas do agente (apenas entrada do usuario)
- **NAO** implementar machine learning para deteccao (apenas regex/keyword)
- **NAO** implementar integracao com SIEM externo (futuro)
- **NAO** armazenar texto cru de inputs (apenas SHA-256 hash + excerpt de 200 chars)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-04** (Chat de Conversas) deve estar implementado — interceptor no fluxo de mensagens

## Validacao

- [ ] Tabelas `security_events` e `security_rules` criadas com 5 regras pre-populadas (`is_system = 1`)
- [ ] Interceptor ativo em `conversations/index.ts` — mensagens avaliadas antes de chegar ao agente
- [ ] Mensagens com padrao `blocked` retornam erro sem chamar agente
- [ ] Mensagens com padrao `flagged` passam ao agente e logar evento
- [ ] Input nunca armazenado em plaintext — apenas SHA-256 hash + excerpt 200 chars
- [ ] Background job detecta anomalia de volume (> 5 high/critical em 1h) e gera notificacao
- [ ] SSE `security:alert` emitido pelo backend e toast exibido no Hub
- [ ] GET `/security/events` com filtros funcionais
- [ ] GET `/security/summary` retorna metricas consolidadas
- [ ] CRUD de regras customizadas funcional (sistema apenas toggle enabled)
- [ ] Pagina `/security` exibe cards, tendencia e log de eventos
- [ ] Aba "Regras" lista regras com toggle e criacao/edicao/remocao de customizadas
- [ ] Badge no menu lateral indica eventos criticos nas ultimas 24h
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-091 Tabelas + regras pre-populadas | S-023 sec 2 | D-035 |
| F-092 Interceptor + anomalia | S-023 sec 3 | D-035, G-036 |
| F-093 Endpoints de API | S-023 sec 4 | G-036 |
| F-094 Dashboard /security | S-023 sec 5 | G-036, D-004 |
