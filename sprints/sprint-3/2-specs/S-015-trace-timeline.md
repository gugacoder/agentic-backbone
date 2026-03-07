# AB Hub - Trace Timeline

Visualizacao do raciocinio do agente com arvore de decisoes, tool calls, tokens por step e timeline de execucao.

---

## 1. Objetivo

- Expor tool calls, funcoes chamadas, tempo e tokens por step em heartbeats e conversas
- Timeline visual com arvore de decisoes expandivel
- Eliminar necessidade de ler spawn.jsonl no servidor para debugging
- Resolver D-032 (raciocinio opaco), D-020 (sem tool calls), G-032 (trace timeline), G-022 (transparencia raciocinio), D-009/G-008 (auditabilidade parcial)

---

## 2. Backend: Parsing de spawn.jsonl

### 2.1 Formato Existente

O backbone ja grava `spawn.jsonl` com output completo do agente (via Vercel AI SDK). Cada linha eh um JSON com eventos do tipo `AgentEvent`. Os dados de tool calls e raciocinio ja existem nos logs — falta estruturar e expor via API.

### 2.2 Estrutura de Trace

Parsear eventos do AI SDK para extrair:

```typescript
interface TraceStep {
  index: number;
  type: "text" | "tool_call" | "tool_result";
  timestamp: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  content?: string;          // texto gerado (truncado a 500 chars no listing)
  toolName?: string;         // nome da tool chamada
  toolInput?: unknown;       // argumentos (JSON)
  toolOutput?: unknown;      // resultado (JSON, truncado)
}

interface Trace {
  id: string;                // heartbeat log id ou session message id
  agentId: string;
  type: "heartbeat" | "conversation" | "cron";
  startedAt: string;
  durationMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  costUsd: number;
  steps: TraceStep[];
  model: string;
}
```

### 2.3 Servico de Trace

Novo modulo `src/traces/index.ts`:

- `getTrace(type, id)` — parseia spawn.jsonl ou messages.jsonl do heartbeat/conversa/cron especifico
- Para heartbeats: buscar em `heartbeat_log` por id, ler o output gravado
- Para conversas: buscar na session, ler mensagens com tool calls do AI SDK
- Para cron: buscar em `cron_run_log` por id, ler output

O parsing acontece sob demanda (nao pre-indexado) — spawn.jsonl ja tem os dados, basta estruturar.

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/traces/:type/:id` | Obter trace completo de uma execucao |

### 3.1 GET `/traces/:type/:id`

**Path params:**

| Param | Tipo | Descricao |
|-------|------|-----------|
| `type` | string | `heartbeat`, `conversation`, `cron` |
| `id` | string | ID do heartbeat_log, session message ou cron_run_log |

**Response:**

```json
{
  "id": "42",
  "agentId": "system.main",
  "type": "heartbeat",
  "startedAt": "2026-03-07T14:00:00Z",
  "durationMs": 3200,
  "totalTokensIn": 1200,
  "totalTokensOut": 450,
  "costUsd": 0.0035,
  "model": "anthropic/claude-sonnet-4-6",
  "steps": [
    {
      "index": 0,
      "type": "text",
      "timestamp": "2026-03-07T14:00:00.100Z",
      "durationMs": 800,
      "tokensIn": 800,
      "tokensOut": 150,
      "content": "Vou verificar se ha novidades..."
    },
    {
      "index": 1,
      "type": "tool_call",
      "timestamp": "2026-03-07T14:00:00.900Z",
      "durationMs": 1200,
      "toolName": "mysql_query",
      "toolInput": { "query": "SELECT COUNT(*) FROM orders WHERE date = CURDATE()" }
    },
    {
      "index": 2,
      "type": "tool_result",
      "timestamp": "2026-03-07T14:00:02.100Z",
      "durationMs": 50,
      "toolName": "mysql_query",
      "toolOutput": { "rows": [{ "count": 15 }] }
    },
    {
      "index": 3,
      "type": "text",
      "timestamp": "2026-03-07T14:00:02.150Z",
      "durationMs": 1000,
      "tokensOut": 300,
      "content": "Hoje tivemos 15 pedidos novos..."
    }
  ]
}
```

---

## 4. Telas

### 4.1 Trace Drawer/Panel

O trace nao eh uma pagina separada — eh um drawer/panel que abre a partir de:

- **Historico de heartbeats** (pagina do agente, aba de heartbeats) — click em "Ver trace"
- **Historico de conversas** — click em mensagem do agente para ver trace
- **Historico de cron** — click em execucao para ver trace

### 4.2 Trace Timeline Layout

```
+------ Trace Drawer/Sheet ----------------+
| Trace — Heartbeat #42                    |
| system.main | 14:00:00 | 3.2s | $0.0035 |
| Model: claude-sonnet-4-6                 |
| Tokens: 1200 in / 450 out               |
|                                          |
| Timeline                                 |
| |-[text] Vou verificar se ha novid...    |
| |  800ms | 800 in / 150 out              |
| |                                        |
| |-[tool] mysql_query                     |
| |  1200ms                                |
| |  > SELECT COUNT(*) FROM orders...      |
| |  < { rows: [{ count: 15 }] }          |
| |                                        |
| |-[text] Hoje tivemos 15 pedidos...      |
|    1000ms | 300 out                      |
+------------------------------------------+
```

### 4.3 Elementos da Timeline

| Elemento | Descricao |
|----------|-----------|
| Header | Tipo + ID, agente, hora, duracao total, custo, modelo, tokens |
| Step text | Icone MessageSquare, conteudo truncado (expandivel), duracao, tokens |
| Step tool_call | Icone Wrench, nome da tool, input expandivel (JSON syntax highlight) |
| Step tool_result | Icone CheckCircle/XCircle, output expandivel (JSON syntax highlight) |
| Barra de duracao | Barra proporcional ao tempo de cada step |

### 4.4 Integracao com Paginas Existentes

**Heartbeat history** (ja existe na pagina do agente):
- Adicionar botao/icone "Trace" em cada entrada do historico
- Click abre o trace drawer com `type=heartbeat&id=<log_id>`

**Conversation messages:**
- Adicionar icone discreto em mensagens do agente (hover)
- Click abre trace drawer com `type=conversation&id=<message_id>`

**Cron run history:**
- Adicionar botao "Trace" em cada execucao do historico
- Click abre trace drawer com `type=cron&id=<run_id>`

---

## 5. Componentes

### 5.1 TraceDrawer

**Localizacao:** `components/traces/trace-drawer.tsx`

```typescript
interface TraceDrawerProps {
  type: "heartbeat" | "conversation" | "cron";
  id: string;
  open: boolean;
  onClose: () => void;
}
```

- Web: Sheet (right drawer)
- Mobile: Vaul bottom drawer (full height)

### 5.2 TraceTimeline

**Localizacao:** `components/traces/trace-timeline.tsx`

```typescript
interface TraceTimelineProps {
  steps: TraceStep[];
  totalDurationMs: number;
}
```

### 5.3 TraceStepItem

**Localizacao:** `components/traces/trace-step-item.tsx`

```typescript
interface TraceStepItemProps {
  step: TraceStep;
  totalDurationMs: number;  // para barra proporcional
}
```

- Expandir/colapsar conteudo com click
- JSON syntax highlight para tool input/output (usando `<pre>` com estilizacao)

### 5.4 TraceHeader

**Localizacao:** `components/traces/trace-header.tsx`

- Resume: tipo, agente, hora, duracao, tokens, custo, modelo

### 5.5 API Module

**Localizacao:** `api/traces.ts`

```typescript
export const traceQueryOptions = (type: string, id: string) =>
  queryOptions({
    queryKey: ["traces", type, id],
    queryFn: () => request<Trace>(`/traces/${type}/${id}`),
  });
```

---

## 6. Criterios de Aceite

- [ ] Endpoint `/traces/:type/:id` retorna trace estruturado de heartbeats
- [ ] Endpoint retorna trace de conversas (mensagens com tool calls)
- [ ] Endpoint retorna trace de cron jobs
- [ ] Trace drawer abre a partir do historico de heartbeats
- [ ] Trace drawer abre a partir de mensagens de conversa
- [ ] Trace drawer abre a partir do historico de cron
- [ ] Timeline mostra steps de texto com conteudo expandivel
- [ ] Timeline mostra tool calls com nome, input e output
- [ ] Barra de duracao proporcional visivel por step
- [ ] Header exibe resumo: tokens, custo, duracao, modelo
- [ ] JSON de tool input/output com formatacao legivel
- [ ] Responsivo: Sheet no desktop, Vaul drawer no mobile
- [ ] Trace carrega sob demanda (sem pre-indexacao)

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Trace parsing (spawn.jsonl) | D-032 (raciocinio opaco), D-020 (sem tool calls) |
| TraceDrawer + Timeline | G-032 (trace timeline visual), G-022 (transparencia) |
| TraceHeader (tokens/custo) | G-032 (tokens por step) |
| Integracao heartbeat/cron/conversa | D-009 (auditabilidade), G-008 (historico completo) |
