# PRP-15 — Trace Timeline

Visualizacao do raciocinio do agente com timeline de steps, tool calls, tokens por step e duracao, acessivel via drawer a partir de heartbeats, conversas e cron.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone grava output completo do agente em `spawn.jsonl` (via Vercel AI SDK) e em historico de mensagens (sessions). Os dados de tool calls, tokens e raciocinio ja existem nos logs, mas nao ha API para acessa-los estruturados nem UI para visualiza-los. Debugging requer acesso ao servidor e leitura manual de JSONL.

### Estado desejado

1. Servico de trace que parseia spawn.jsonl / messages.jsonl sob demanda
2. Endpoint `GET /traces/:type/:id` retornando trace estruturado
3. Trace drawer (Sheet/Vaul) com timeline de steps, tokens, custo, duracao
4. Integracao com paginas existentes: heartbeat history, chat messages, cron history

## Especificacao

### Feature F-059: Servico de trace + parsing de spawn.jsonl

**Novo modulo `src/traces/index.ts`:**

```typescript
interface TraceStep {
  index: number;
  type: "text" | "tool_call" | "tool_result";
  timestamp: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
}

interface Trace {
  id: string;
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

Funcao `getTrace(type, id)`:

- Para heartbeats: buscar em `heartbeat_log` por id, ler output gravado, parsear eventos AI SDK
- Para conversas: buscar na session, ler mensagens com tool calls
- Para cron: buscar em `cron_run_log` por id, ler output

Parsing sob demanda (nao pre-indexado). Textos truncados a 500 chars no listing, completos quando expandidos.

### Feature F-060: Endpoint /traces/:type/:id

**Novo endpoint em `routes/traces.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/traces/:type/:id` | Trace completo de uma execucao |

Path params: `type` = `heartbeat` | `conversation` | `cron`, `id` = ID do registro.

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
    { "index": 0, "type": "text", "timestamp": "...", "durationMs": 800, "tokensIn": 800, "tokensOut": 150, "content": "Vou verificar..." },
    { "index": 1, "type": "tool_call", "timestamp": "...", "durationMs": 1200, "toolName": "mysql_query", "toolInput": { "query": "SELECT ..." } },
    { "index": 2, "type": "tool_result", "timestamp": "...", "durationMs": 50, "toolName": "mysql_query", "toolOutput": { "rows": [] } },
    { "index": 3, "type": "text", "timestamp": "...", "durationMs": 1000, "tokensOut": 300, "content": "Hoje tivemos 15..." }
  ]
}
```

**Hub — API module `api/traces.ts`:**

```typescript
export const traceQueryOptions = (type: string, id: string) =>
  queryOptions({
    queryKey: ["traces", type, id],
    queryFn: () => request<Trace>(`/traces/${type}/${id}`),
  });
```

### Feature F-061: TraceDrawer + TraceTimeline + TraceStepItem

**components/traces/trace-drawer.tsx:**

```typescript
interface TraceDrawerProps {
  type: "heartbeat" | "conversation" | "cron";
  id: string;
  open: boolean;
  onClose: () => void;
}
```

- Desktop: Sheet (right drawer, shadcn)
- Mobile: Vaul bottom drawer (full height)

**components/traces/trace-header.tsx:**

Resume: tipo + ID, agente, hora, duracao total, custo, modelo, tokens in/out.

**components/traces/trace-timeline.tsx:**

```typescript
interface TraceTimelineProps {
  steps: TraceStep[];
  totalDurationMs: number;
}
```

Timeline vertical com cada step:

| Tipo step | Icone | Conteudo |
|-----------|-------|----------|
| text | MessageSquare | Texto truncado (expandivel), duracao, tokens |
| tool_call | Wrench | Nome da tool, input expandivel (JSON formatado) |
| tool_result | CheckCircle/XCircle | Output expandivel (JSON formatado) |

Barra de duracao proporcional ao tempo de cada step vs total.

**components/traces/trace-step-item.tsx:**

```typescript
interface TraceStepItemProps {
  step: TraceStep;
  totalDurationMs: number;
}
```

- Click expande/colapsa conteudo
- JSON com formatacao legivel (usando `<pre>` com estilizacao)

### Feature F-062: Integracao com heartbeat, conversa e cron history

**Heartbeat history** (pagina do agente, aba heartbeat):
- Adicionar icone/botao "Trace" em cada entrada do historico
- Click abre TraceDrawer com `type=heartbeat&id=<log_id>`

**Conversation messages** (tela de chat):
- Adicionar icone discreto em mensagens do agente (hover)
- Click abre TraceDrawer com `type=conversation&id=<message_id>`

**Cron run history** (pagina de cron):
- Adicionar botao "Trace" em cada execucao do historico
- Click abre TraceDrawer com `type=cron&id=<run_id>`

## Limites

- **NAO** implementar pre-indexacao de traces — parsing sob demanda apenas.
- **NAO** implementar busca/filtro de traces — acesso individual via historico.
- **NAO** implementar replay visual animado — apenas timeline estatica.
- **NAO** criar pagina dedicada de traces — apenas drawer a partir de paginas existentes.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-04** (Chat) deve estar implementado — integracao com mensagens de conversa.
- **PRP-07** (Cron) deve estar implementado — integracao com historico de cron.

## Validacao

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
- [ ] `npm run build:hub` compila sem erros (backbone e hub)

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-059 Servico trace + parsing | S-015 sec 2 | D-032, D-020 |
| F-060 Endpoint /traces | S-015 sec 3 | G-032, G-022 |
| F-061 TraceDrawer + Timeline | S-015 sec 4-5 | G-032, G-022 |
| F-062 Integracao paginas | S-015 sec 4.4 | D-009, G-008 |
