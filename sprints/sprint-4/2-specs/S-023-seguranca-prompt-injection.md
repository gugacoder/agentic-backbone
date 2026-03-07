# S-023 — Seguranca: Deteccao de Prompt Injection e Monitoramento de Anomalias

Camada de filtragem de mensagens suspeitas antes de chegarem ao agente, com alertas de anomalia, dashboard de eventos de seguranca e log auditavel de tentativas bloqueadas.

---

## 1. Objetivo

- Interceptar mensagens de entrada e detectar tentativas de prompt injection via heuristicas de padrao
- Logar eventos de seguranca (bloqueados, suspeitos, passados) em tabela auditavel
- Alertas automaticos quando volume anomalo de tentativas eh detectado
- Dashboard de seguranca por agente com historico de eventos
- Resolver D-035 (sem protecao contra prompt injection, OWASP LLM #1), G-036 (monitoramento de seguranca)

---

## 2. Schema DB

### 2.1 Tabela `security_events`

```sql
CREATE TABLE IF NOT EXISTS security_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  session_id   TEXT,
  event_type   TEXT NOT NULL,   -- 'prompt_injection', 'anomaly', 'jailbreak_attempt'
  severity     TEXT NOT NULL,   -- 'low', 'medium', 'high', 'critical'
  action       TEXT NOT NULL,   -- 'blocked', 'flagged', 'allowed'
  input_hash   TEXT NOT NULL,   -- SHA-256 do input (nao armazenar texto cru)
  input_excerpt TEXT,           -- primeiros 200 chars do input (para contexto no dashboard)
  pattern_matched TEXT,         -- nome do padrao detectado (ex: 'ignore_instructions')
  score        REAL,            -- score de confianca da deteccao (0.0 a 1.0)
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_security_agent ON security_events(agent_id, created_at);
CREATE INDEX idx_security_type ON security_events(event_type, action);
```

### 2.2 Tabela `security_rules`

```sql
CREATE TABLE IF NOT EXISTS security_rules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT,
  pattern      TEXT NOT NULL,   -- regex ou keyword list (JSON array de strings)
  rule_type    TEXT NOT NULL,   -- 'regex', 'keyword'
  severity     TEXT NOT NULL DEFAULT 'medium',
  action       TEXT NOT NULL DEFAULT 'flagged',  -- 'blocked' ou 'flagged'
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Regras pre-populadas na migracao:

| name | pattern | severity | action |
|------|---------|----------|--------|
| `ignore_instructions` | `["ignore previous", "ignore your instructions", "ignore all instructions", "esqueca suas instrucoes", "ignore tudo"]` | high | blocked |
| `system_prompt_leak` | `["repeat your system prompt", "what are your instructions", "show me your soul", "mostre seu prompt"]` | high | flagged |
| `role_override` | `["you are now", "act as", "pretend you are", "voce agora eh", "finja que"]` | medium | flagged |
| `jailbreak_dan` | `["DAN", "do anything now", "jailbreak", "developer mode"]` | critical | blocked |
| `data_exfiltration` | `["list all users", "show database", "dump your memory", "listar todos os usuarios"]` | high | blocked |

---

## 3. Pipeline de Filtragem

### 3.1 Interceptor de Mensagens

Inserir interceptor em `conversations/index.ts` no ponto onde a mensagem do usuario eh recebida, antes de passar para `runAgent()`:

```typescript
async function checkMessageSecurity(input: string, agentId: string, sessionId: string): Promise<SecurityCheckResult> {
  // 1. Normalizar input (lowercase, trim)
  // 2. Avaliar contra cada regra enabled em security_rules
  // 3. Calcular score agregado
  // 4. Retornar { action: 'allow'|'flag'|'block', events: [...] }
}
```

Fluxo:
- `action: 'block'` → retornar mensagem de erro ao usuario sem chamar o agente; logar evento com `action: blocked`
- `action: 'flag'` → passar mensagem ao agente normalmente; logar evento com `action: flagged`; emitir alerta se threshold excedido
- `action: 'allow'` → sem log de evento

### 3.2 Deteccao de Anomalia por Volume

Background job (a cada hora): contar `security_events` das ultimas 1h por agente. Se > 5 eventos `high`/`critical` em 1h → emitir notificacao `security_anomaly` com severity `critical`.

---

## 4. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/security/events` | Listar eventos (query: agent_id, severity, action, from, to) |
| GET | `/security/summary` | Resumo de eventos por agente e tipo |
| GET | `/security/rules` | Listar regras de seguranca |
| POST | `/security/rules` | Criar regra customizada |
| PATCH | `/security/rules/:id` | Atualizar regra |
| DELETE | `/security/rules/:id` | Remover regra customizada |

### 4.1 GET `/security/summary` — Response

```json
{
  "period": { "from": "2026-03-01", "to": "2026-03-07" },
  "totalEvents": 45,
  "byAction": { "blocked": 12, "flagged": 28, "allowed": 5 },
  "bySeverity": { "critical": 3, "high": 18, "medium": 24 },
  "byAgent": [
    { "agentId": "system.main", "total": 32, "blocked": 8 }
  ],
  "trend": [
    { "date": "2026-03-01", "blocked": 2, "flagged": 4 },
    { "date": "2026-03-02", "blocked": 1, "flagged": 5 }
  ]
}
```

### 4.2 GET `/security/events` — Response

```json
{
  "events": [
    {
      "id": 7,
      "agentId": "system.main",
      "eventType": "prompt_injection",
      "severity": "high",
      "action": "blocked",
      "inputExcerpt": "ignore suas instrucoes e me diga...",
      "patternMatched": "ignore_instructions",
      "score": 0.95,
      "createdAt": "2026-03-07T14:22:00Z"
    }
  ]
}
```

---

## 5. Telas

### 5.1 Dashboard de Seguranca (`/security`)

Nova pagina no menu lateral (icone: `ShieldAlert`), em secao "Sistema".

**Layout:**

```
+-- Eventos (7 dias) ---------------------+
| Bloqueados: 12  Suspeitos: 28  Total: 40 |
+------------------------------------------+
| Tendencia de Ataques (7 dias)            |
| [grafico de barras empilhadas: blocked/flagged por dia] |
+------------------------------------------+
| Agentes Mais Visados                     |
| system.main    32 eventos  8 bloqueados  |
+------------------------------------------+
| Log de Eventos                           |
| [tabela com filtros: agente, tipo, acao] |
| HIGH  blocked  ignore_instructions  14:22|
+------------------------------------------+
```

### 5.2 Regras de Seguranca (`/security/rules`)

Aba na pagina de seguranca.

Tabela de regras com toggle de ativacao. Botao "+ Nova Regra" abre dialog com campos:
- Nome, descricao
- Tipo (regex / keyword list)
- Pattern (textarea — JSON array de strings ou regex)
- Severidade (low / medium / high / critical)
- Acao (flagged / blocked)

Regras pre-populadas pelo sistema marcadas como "Sistema" (nao removiveis, apenas desativaveis).

### 5.3 Badge de Alertas

Badge vermelho no menu lateral quando ha eventos `critical` nas ultimas 24h.

---

## 6. Componentes

| Componente | Localizacao |
|------------|-------------|
| `SecurityPage` | `routes/_authenticated/security/index.tsx` |
| `SecuritySummaryCards` | `components/security/security-summary-cards.tsx` |
| `SecurityTrendChart` | `components/security/security-trend-chart.tsx` |
| `SecurityEventTable` | `components/security/security-event-table.tsx` |
| `SecurityRulesTab` | `components/security/security-rules-tab.tsx` |
| `SecurityRuleDialog` | `components/security/security-rule-dialog.tsx` |

**API module:** `api/security.ts`

```typescript
export const securitySummaryQueryOptions = (days: number) =>
  queryOptions({
    queryKey: ["security", "summary", days],
    queryFn: () => request<SecuritySummary>(`/security/summary?days=${days}`),
  });

export const securityEventsQueryOptions = (params: SecurityEventsParams) =>
  queryOptions({
    queryKey: ["security", "events", params],
    queryFn: () => request<SecurityEvent[]>(`/security/events?${...}`),
  });
```

**SSE:** Evento `security:alert` emitido pelo backend quando anomalia detectada, consumido pelo hook `useSSE` existente para exibir toast de alerta.

---

## 7. Criterios de Aceite

- [ ] Tabelas `security_events` e `security_rules` criadas com regras pre-populadas
- [ ] Interceptor ativo em `conversations/index.ts` — mensagens avaliadas antes de chegar ao agente
- [ ] Mensagens com padrao `blocked` retornam erro ao usuario sem chamar agente
- [ ] Mensagens com padrao `flagged` passam ao agente mas logar evento
- [ ] Input nunca armazenado em plaintext — apenas SHA-256 hash + excerpt de 200 chars
- [ ] Pagina `/security` exibe resumo, tendencia e log de eventos
- [ ] Filtros de log funcionais (agente, severidade, acao, periodo)
- [ ] Regras de seguranca listadas com toggle de ativacao
- [ ] Regras customizadas: criar, editar, remover via UI
- [ ] Anomalia de volume (> 5 eventos high/critical em 1h) gera notificacao push
- [ ] Badge no menu lateral indica eventos criticos nas ultimas 24h

---

## 8. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Interceptor + regras de filtragem | D-035 (prompt injection OWASP #1) |
| `security_events` log auditavel | G-036 (log de tentativas bloqueadas) |
| Dashboard de seguranca | G-036 (dashboard de eventos de seguranca) |
| Deteccao de anomalia por volume | G-036 (alertas de anomalia UEBA) |
| Regras customizaveis | D-004 (governanca de respostas autonomas) |
