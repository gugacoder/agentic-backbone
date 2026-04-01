# PRP 17 — Unified Persistence: Conversas Ricas em um Unico Arquivo

Unificar as duas camadas de persistencia de conversas (backbone `PersistentMessage` + ai-sdk `ModelMessage`) em um unico `messages.jsonl` por sessao — preservando tool calls, display tools e reasoning no historico, com campo `_meta` para metadados do backbone estripado ao carregar pro modelo.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

Existem **duas persistencias separadas** para a mesma conversa:

| Camada | Path | Formato | Conteudo |
|---|---|---|---|
| Backbone | `context/agents/{agentId}/conversations/{sessionId}/messages.jsonl` | `PersistentMessage` — `{id, ts, role, content: string}` | Texto plano. Sem tool calls. |
| ai-sdk | `data/ai-sessions/{sdkSessionId}.jsonl` | `ModelMessage` do Vercel — `{role, content: Part[]}` | Rico: tool-call, tool-result, text parts. |

O frontend restaura historico do arquivo do backbone (texto plano). O ai-sdk restaura do proprio arquivo (rico) apenas para continuar a sessao do modelo. Resultado: ao recarregar uma conversa, toda a experiencia rica desaparece.

O mapeamento entre as duas camadas usa `sdk_session_id` na tabela SQLite `sessions`, gerando complexidade adicional (dois UUIDs por conversa).

### Problema / Motivacao

1. **Historico pobre** — ao recarregar o chat, tool calls, display tools e reasoning desaparecem. O usuario ve texto plano.
2. **Dados duplicados** — a mesma conversa grava em dois locais com formatos diferentes.
3. **Mapeamento fragil** — `sdkSessionId` no SQLite mapeia backbone sessionId para ai-sdk sessionId. Invalidacao por hash de system prompt adiciona complexidade.
4. **PRP 13 assumiu** que "o Vercel AI SDK ja persiste o historico completo" — mas esse historico esta fora de `context/` e ninguem no frontend o consulta.

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Arquivos por conversa | 2 (`context/.../messages.jsonl` + `data/ai-sessions/{id}.jsonl`) | 1 (`context/.../messages.jsonl`) |
| Formato | `PersistentMessage` (pobre) + `ModelMessage` (rico, separado) | `ModelMessage` + `_meta` (rico, unificado) |
| Tool calls no historico | Perdidos ao recarregar | Preservados |
| Display tools no historico | Perdidos ao recarregar | Preservados |
| Mapeamento sdkSessionId | SQLite `sessions.sdk_session_id` | Eliminado |
| `data/ai-sessions/` | Diretorio ativo | Obsoleto (pode ser removido) |

### Dependencias

- **PRP 13 (Rich Stream)** — ja implementado. Eventos `tool-call` e `tool-result` ja fluem no stream.
- **PRP 14 (Rich Content)** — ja implementado. Display tools ja emitem conteudo estruturado.

---

## Especificacao

### 1. Campo `_meta` — Metadados do backbone

Cada mensagem no `messages.jsonl` unificado segue o formato `ModelMessage` do Vercel AI SDK com um campo adicional `_meta`:

```typescript
interface MessageWithMeta {
  // Campos ModelMessage (Vercel AI SDK)
  role: "system" | "user" | "assistant" | "tool";
  content: string | Part[];  // string ou array de parts (text, tool-call, tool-result)
  providerOptions?: Record<string, Record<string, unknown>>;

  // Campo exclusivo backbone — estripado antes de enviar ao modelo
  _meta?: {
    id?: string;       // ID unico da mensagem (msg_{timestamp}_{hex})
    ts: string;        // ISO timestamp
    userId?: string;   // quem enviou (para user messages)
    metadata?: Record<string, unknown>;  // dados extras (operator, agentId delegado, etc.)
  };
}
```

O `_meta` usa prefixo `_` seguindo a convencao de campo interno (mesmo padrao de `_display: true` nos display tools).

### 2. session.ts — Path fixo e _meta handling

#### 2.1 Arquivo: `apps/packages/ai-sdk/src/session.ts`

Alterar `sessionPath` para usar nome fixo `messages.jsonl` (o diretorio ja contem o sessionId no path):

```typescript
function sessionPath(dir: string): string {
  return join(dir, "messages.jsonl");
}
```

Alterar `loadSession` — remover parametro `sessionId` (desnecessario), estripar `_meta` de cada mensagem:

```typescript
export async function loadSession(dir: string): Promise<ModelMessage[]> {
  try {
    const content = await readFile(sessionPath(dir), "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const { _meta, ...msg } = JSON.parse(line);
        return msg as ModelMessage;
      });
  } catch {
    return [];
  }
}
```

Alterar `saveSession` — remover parametro `sessionId`, adicionar `_meta.ts` automaticamente a mensagens que nao possuem:

```typescript
export async function saveSession(
  dir: string,
  messages: (ModelMessage & { _meta?: Record<string, unknown> })[]
): Promise<void> {
  const filePath = sessionPath(dir);
  await mkdir(dirname(filePath), { recursive: true });
  const ts = new Date().toISOString();
  const jsonl = messages
    .map((m) => {
      if (!(m as any)._meta) {
        return JSON.stringify({ ...m, _meta: { ts } });
      }
      return JSON.stringify(m);
    })
    .join("\n") + "\n";
  await writeFile(filePath, jsonl, "utf-8");
}
```

### 3. agent.ts — sessionDir direto e _meta na user message

#### 3.1 Arquivo: `apps/packages/ai-sdk/src/agent.ts`

Alterar carregamento de historico (linhas ~83-90). O `sessionDir` agora aponta diretamente para a pasta da conversa. Carregar se `sessionDir` estiver definido:

```typescript
const sessionDir = options.sessionDir ?? DEFAULT_SESSION_DIR;
const sessionId = options.sessionId ?? randomUUID();

let previousMessages: ModelMessage[] = [];
if (options.sessionDir) {
  previousMessages = await loadSession(sessionDir);
}
```

Construir user message com `_meta` (linhas ~93-96):

```typescript
const userMsg: any = { role: "user", content: prompt };
if (options.messageMeta) {
  userMsg._meta = { ts: new Date().toISOString(), ...options.messageMeta };
}
const messages: ModelMessage[] = [...previousMessages, userMsg];
```

Alterar persistencia apos resposta (linhas ~460-463). Adicionar `_meta` as mensagens de resposta do modelo:

```typescript
const responseMsgs = (response.messages as any[]).map((m) => ({
  ...m,
  _meta: { ts: new Date().toISOString() },
}));
await saveSession(sessionDir, [...messages, ...responseMsgs]);
```

**Nota**: `DEFAULT_SESSION_DIR` continua como fallback para uso standalone do ai-sdk (fora do backbone).

### 4. types.ts e schemas.ts — Novo campo messageMeta

#### 4.1 Arquivo: `apps/packages/ai-sdk/src/types.ts`

Adicionar a `AiAgentOptions`:

```typescript
export interface AiAgentOptions {
  // ...existentes...

  /** Metadados do backbone anexados como _meta na user message */
  messageMeta?: Record<string, unknown>;
}
```

#### 4.2 Arquivo: `apps/packages/ai-sdk/src/schemas.ts`

Adicionar ao `AgentRunOptionsSchema`:

```typescript
messageMeta: z.record(z.unknown()).optional(),
```

### 5. proxy.ts — Repassar messageMeta

#### 5.1 Arquivo: `apps/packages/ai-sdk/src/proxy.ts`

Incluir `messageMeta` ao montar options para `runAiAgent`:

```typescript
messageMeta: options.messageMeta,
```

### 6. agent/index.ts (backbone) — Aceitar sessionDir do caller

#### 6.1 Arquivo: `apps/backbone/src/agent/index.ts`

Remover hardcode de `sessionDir`. Aceitar do caller:

```typescript
yield* runProxyAgent({
  model,
  apiKey,
  prompt,
  sessionId: options?.sessionId,
  sessionDir: options?.sessionDir,  // caller define; sem fallback para DATA_DIR
  messageMeta: options?.messageMeta,
  role,
  tools: options?.tools,
  // ...resto
});
```

Adicionar `sessionDir` e `messageMeta` ao tipo de `options` do `runAgent`.

### 7. conversations/index.ts — Fluxo principal unificado

#### 7.1 Arquivo: `apps/backbone/src/conversations/index.ts`

**7.1.1 Remover persistencia duplicada:**

- Remover `appendMessage` da user message (linha ~333). O ai-sdk grava a user message.
- Remover `appendMessage` da assistant message (linha ~504). O ai-sdk grava a resposta.
- Remover captura de `sdkSessionId` no evento `init` (linhas ~455-458).
- Remover leitura de `session.sdk_session_id` (linha ~423).

**7.1.2 Passar sessionDir e messageMeta ao agente:**

```typescript
const conversationDir = join(agentDir(agentId), "conversations", sessionId);

for await (const event of instrumentedRunAgent(effectiveAgentId, "chat", assembled.userMessage, {
  sessionDir: conversationDir,
  messageMeta: { id: generateMessageId(), userId },
  role: "conversation",
  tools: conversationTools,
  system: assembled.system,
})) {
```

**7.1.3 Casos out-of-band** — mensagens gravadas sem rodar o agente:

Takeover operator (linha ~295):
```typescript
appendModelMessage(agentId, sessionId, {
  role: "assistant",
  content: message,
  _meta: { ts: new Date().toISOString(), id: generateMessageId(), metadata: { operator: true, operatorSlug: userId } },
});
```

Takeover user externo (linha ~314):
```typescript
appendModelMessage(agentId, sessionId, {
  role: "user",
  content: message,
  _meta: { ts: new Date().toISOString(), id: generateMessageId(), userId },
});
```

Security blocked (linha ~351) — gravar user + assistant porque ai-sdk nao roda:
```typescript
appendModelMessage(agentId, sessionId, {
  role: "user",
  content: message,
  _meta: { ts: new Date().toISOString(), id: generateMessageId(), userId },
});
appendModelMessage(agentId, sessionId, {
  role: "assistant",
  content: errorMsg,
  _meta: { ts: new Date().toISOString(), id: generateMessageId() },
});
```

Quota exceeded (linha ~374) — mesmo padrao do security blocked.

**7.1.4 System hash invalidation** (linhas ~428-433):

Manter a logica de hash para detectar mudanca de system prompt. Em vez de limpar `sdkSessionId`, nao fazer nada — o modelo recebe o system prompt atualizado com o historico existente. A conversa continua normalmente.

Remover as prepared statements relacionadas a `sdk_session_id` (`setSdkSessionId`, `selectSystemHash` referentes a sdk_session_id).

### 8. persistence.ts — Novas funcoes

#### 8.1 Arquivo: `apps/backbone/src/conversations/persistence.ts`

Remover `PersistentMessage` interface e `appendMessage` funcao.

Adicionar `appendModelMessage`:

```typescript
export function appendModelMessage(
  agentId: string,
  sessionId: string,
  message: { role: string; content: string; _meta?: Record<string, unknown> }
): void {
  const dir = sessionDir(agentId, sessionId);
  mkdirSync(dir, { recursive: true });
  const line = JSON.stringify(message) + "\n";
  appendFileSync(join(dir, "messages.jsonl"), line);
}
```

Atualizar `readMessages` para retornar formato novo:

```typescript
export interface ModelMessageWithMeta {
  role: string;
  content: string | unknown[];  // string ou array de parts
  _meta?: {
    id?: string;
    ts?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };
}

export function readMessages(agentId: string, sessionId: string): ModelMessageWithMeta[] {
  const dir = sessionDir(agentId, sessionId);
  const filePath = join(dir, "messages.jsonl");
  try {
    const content = readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ModelMessageWithMeta);
  } catch {
    return [];
  }
}
```

### 9. routes/conversations.ts — GET /messages com formato rico

#### 9.1 Arquivo: `apps/backbone/src/routes/conversations.ts`

A rota `GET /conversations/:sessionId/messages` (linha ~78) retorna o formato novo diretamente. O frontend recebe `content` como array de parts (com tool-call, tool-result) e `_meta` com metadados.

Manter a logica de feedback attachment usando `_meta.id` como chave:

```typescript
const messages = readMessages(session.agent_id, sessionId);
const feedbackByMessageId = new Map(feedbackRows.map((r) => [r.message_id, ...]));

const messagesWithFeedback = messages.map((m) => {
  const id = m._meta?.id;
  if (id && feedbackByMessageId.has(id)) {
    return { ...m, feedback: feedbackByMessageId.get(id) };
  }
  return m;
});
```

A rota `GET /conversations/:sessionId/export` (linha ~257) extrai texto de `content` (se array, concatena parts do tipo `text`).

### 10. memory/flush.ts — Extrair texto de content rico

#### 10.1 Arquivo: `apps/backbone/src/memory/flush.ts`

A funcao `buildConversationContext` (linha ~39) le mensagens e monta contexto para extracao de memoria. Ajustar para extrair texto de content array:

```typescript
function extractText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  return (content as any[])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}
```

Filtrar mensagens com `role === "tool"` (contém tool-result, nao util para memoria).

---

## Limites

### NAO fazer

- NAO manter compatibilidade com formato antigo — projeto nao esta em producao
- NAO migrar conversas existentes — podem ser descartadas ou sobrescritas
- NAO alterar o formato de `SESSION.yml` — continua como esta
- NAO modificar o stream SSE/DataStream — este PRP trata apenas de persistencia
- NAO alterar o comportamento de heartbeat/cron — eles nao usam session persistence
- NAO criar schema de migracao para a coluna `sdk_session_id` no SQLite — pode ser ignorada

### Observacoes

- A pasta `data/ai-sessions/` se torna obsoleta apos esta mudanca. Pode ser removida manualmente.
- O campo `_meta` eh transparente ao modelo — nunca chega no LLM.
- O `generateMessageId()` existente em persistence.ts eh reutilizado para gerar IDs unicos.
- O `saveSession()` faz overwrite completo do arquivo a cada turno. Mensagens appended out-of-band (takeover, security, quota) sao preservadas porque `loadSession` le tudo antes do proximo turno.

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1a | `types.ts` + `schemas.ts`: adicionar `messageMeta` | nada |
| 1b | `session.ts`: nova `sessionPath`, `loadSession` com strip `_meta`, `saveSession` com add `_meta` | nada |
| 2 | `agent.ts`: usar novo `sessionDir`, anexar `_meta`, passar `messageMeta` | 1a, 1b |
| 3 | `proxy.ts`: repassar `messageMeta` | 1a |
| 4 | Build ai-sdk: `npm run build:packages` | 2, 3 |
| 5 | `agent/index.ts` (backbone): aceitar `sessionDir` e `messageMeta` | 4 |
| 6 | `persistence.ts`: `appendModelMessage` + `readMessages` atualizado | nada |
| 7 | `conversations/index.ts`: fluxo principal unificado | 5, 6 |
| 8 | `routes/conversations.ts`: GET /messages com formato rico | 6 |
| 9 | `memory/flush.ts`: extrair texto de content array | 6 |

Fases 1a e 1b sao paralelas. Fases 5 e 6 sao paralelas.
