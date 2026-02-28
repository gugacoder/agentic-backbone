# Channel Gateway

Design de como o Agentic Backbone se torna um participante de múltiplas plataformas de comunicação — WhatsApp, Discord, Slack — onde o chat SSE (Hub) é apenas um dos canais possíveis.

---

## Motivação

Hoje o agente entrega mensagens exclusivamente via SSE (event bus → Hub). O `deliverToChannel()` emite direto no barramento de eventos, e o Hub consome via EventSource. Isso funciona para o chat web, mas trava o agente em uma única plataforma.

O **Channel Gateway** transforma cada canal num ponto de entrega abstrato. O agente não precisa saber se está falando com o Hub, com o WhatsApp ou com o Discord — ele entrega para um canal, e o canal resolve o transporte.

---

## Terminologia

| Termo | Definição |
|---|---|
| **Channel** | Tubo de comunicação entre user e agent. Identificado pelo `CHANNEL.md`. |
| **Channel-adapter** | Abstração de transporte. Responsável por enviar (outbound) e receber (inbound) mensagens em uma plataforma específica. |
| **Registry** | Mapa runtime `slug → adapter instance`. Resolve qual adapter usar para cada canal. |
| **Inbound Router** | Pipeline que recebe mensagens externas (webhooks) e as injeta no fluxo de conversa do agent. |

---

## Três Tiers de Channel-Adapters

| Tier | Exemplo | Onde vive | Config extra | Quando usar |
|---|---|---|---|---|
| **built-in** | SSE | `apps/backbone/src/channel-adapters/sse.ts` | Nenhuma | Transporte core, sempre presente |
| **plug-in** | WhatsApp (Evolution) | `apps/backbone/src/modules/evolution/` | Instância Evolution | Módulo compilado com o backbone |
| **drop-in** | Discord, Telegram | `context/shared/channel-adapters/{slug}/` | API keys + `handler.mjs` | Extensão por convenção de filesystem |

### Filosofia

- **built-in**: zero config, faz parte do core. O SSE é o adapter padrão — todo `CHANNEL.md` sem `channel-adapter` explícito usa SSE.
- **plug-in**: módulos TypeScript compilados que registram adapters via `ModuleContext`. Têm acesso completo ao runtime.
- **drop-in**: arquivos `.mjs` descobertos por convenção. Seguem o mesmo padrão de connectors: discovery automática, factory + config, env check.

---

## Interface ChannelAdapter

```typescript
interface ChannelAdapterSendOptions {
  channelId: string;
  agentId: string;
  content: string;
  role?: "assistant" | "user" | "system";
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

interface InboundMessage {
  senderId: string;       // ID do remetente na plataforma
  content: string;        // Texto da mensagem
  ts: number;             // Timestamp Unix ms
  metadata?: Record<string, unknown>;
}

type InboundCallback = (channelId: string, message: InboundMessage) => void;

interface ChannelAdapter {
  /** Slug identificador (ex: "sse", "whatsapp", "discord") */
  readonly slug: string;

  /** Envia mensagem do agent para a plataforma */
  send(options: ChannelAdapterSendOptions): Promise<void>;

  /** Registra callback para mensagens entrantes (plataforma → agent) */
  onInbound?(callback: InboundCallback): void;

  /** Health check opcional */
  health?(): { status: "healthy" | "degraded" | "unhealthy"; details?: Record<string, unknown> };

  /** Cleanup de recursos (conexões, timers) */
  close?(): Promise<void>;
}
```

### Factory Pattern

Cada adapter é criado por uma factory que recebe config do canal e contexto do backbone:

```typescript
type ChannelAdapterFactory = (
  config: Record<string, unknown>,
  context: ChannelAdapterContext
) => ChannelAdapter | Promise<ChannelAdapter>;

interface ChannelAdapterContext {
  eventBus: BackboneEventBus;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;
}
```

- **SSE (built-in)**: factory hardcoded, não precisa de config.
- **WhatsApp (plug-in)**: factory registrada pelo Evolution module no `start()`.
- **Discord (drop-in)**: factory exportada por `handler.mjs`, config vem do `CHANNEL.md`.

---

## CHANNEL.md — Evolução do Frontmatter

### Campo `channel-adapter`

Novo campo opcional no frontmatter. Default implícito: `sse` quando ausente — **backward compatible**.

### Exemplos

**SSE (implícito — zero mudança em channels existentes)**

```yaml
---
slug: handerson
owner: handerson
type: personal
---

# Handerson

Canal pessoal do Handerson.
```

Sem `channel-adapter` declarado → resolve como `sse`. Comportamento idêntico ao atual.

**WhatsApp (plug-in)**

```yaml
---
slug: whatsapp-ops
owner: system
type: whatsapp
channel-adapter: whatsapp
agent: system.main
instance: evolution-main
target: "5511999999999"
---

# WhatsApp Ops

Canal operacional via WhatsApp. Mensagens do agent são entregues via Evolution API.
```

Campos extras do adapter (`instance`, `target`) vivem no frontmatter do próprio `CHANNEL.md`. O adapter lê o que precisa.

**Discord (drop-in)**

```yaml
---
slug: discord-dev
owner: system
type: discord
channel-adapter: discord
agent: system.main
guild-id: "123456789"
channel-id: "987654321"
bot-token-env: DISCORD_BOT_TOKEN
---

# Discord Dev

Canal do servidor Discord de desenvolvimento.
```

O campo `bot-token-env` segue a convenção `*-env` — aponta para o nome da variável de ambiente, nunca o valor direto.

---

## Fluxo Outbound (Agent → Plataforma)

Hoje `deliverToChannel()` emite direto no event bus:

```typescript
// Atual (system-channel.ts)
eventBus.emit("channel:message", { channelId, agentId, content, ... });
```

Com o Channel Gateway, `deliverToChannel()` passa a resolver o adapter do canal antes de entregar:

```
deliverToChannel(channelSlug, agentId, text)
  │
  ├─ resolve channel config (channel registry)
  │    → lê CHANNEL.md → extrai campo `channel-adapter` (default: "sse")
  │
  ├─ resolve adapter instance (channel-adapter registry)
  │    → channelAdapterRegistry.resolve(adapterSlug)
  │
  └─ adapter.send({ channelId, agentId, content })
       │
       ├── sse:       eventBus.emit("channel:message", ...)
       │              → SSE stream → Hub (sem mudança de comportamento)
       │
       ├── whatsapp:  POST {EVOLUTION_URL}/message/sendText/{instance}
       │              → Mensagem chega no WhatsApp do destinatário
       │
       └── discord:   POST https://discord.com/api/channels/{id}/messages
                      → Mensagem aparece no canal Discord
```

### `deliverToSystemChannel()` permanece inalterada

O System Channel é **sempre SSE**. Não passa pelo registry — emite direto no event bus. É o canal de observabilidade do backbone, por definição acessível apenas via Hub/SSE.

---

## Fluxo Inbound (Plataforma → Agent)

Mensagens externas chegam via webhook e precisam ser roteadas para o agent correto.

```
Webhook HTTP chega
  │
  ├── plug-in:  POST /modules/evolution/webhook
  │             → Evolution module processa e chama onInbound()
  │
  └── drop-in:  POST /channel-adapters/:slug/webhook
                → Rota genérica, despacha para o adapter registrado
  │
  ▼
adapter.onInbound(channelId, { senderId, content, ts })
  │
  ▼
Inbound Router
  │
  ├─ 1. Resolve channel → agent
  │    → Campo `agent` no CHANNEL.md (obrigatório para canais não-SSE)
  │
  ├─ 2. Resolve senderId → userId
  │    → Lookup em USER.md (campo de ID da plataforma)
  │    → Se não encontrar: cria ID sintético (ex: "whatsapp:5511999999999")
  │
  ├─ 3. Find or create session
  │    → Chave composta: (agentId, userId, channelId)
  │    → Permite manter conversas separadas por canal
  │
  └─ 4. Injeta no fluxo de conversa
       → conversations.sendMessage(userId, sessionId, text)
       → runAgent() → coleta resposta **completa**
       → deliverToChannel(channelId, agentId, response)
         → volta pelo mesmo canal de origem
```

### Nota: resposta completa vs streaming

O SSE faz streaming token-a-token via `streamSSE()`. Canais externos (WhatsApp, Discord) **coletam a resposta completa** antes de enviar. O adapter de plataforma não recebe stream — recebe o texto final.

Isso é intencional: APIs de mensageria não suportam streaming, e enviar mensagens parciais cria experiência ruim.

---

## Session Threading

### Problema

Hoje a tabela `sessions` identifica uma sessão por `(session_id, user_id, agent_id)`. Se o mesmo user conversa com o mesmo agent por canais diferentes (SSE + WhatsApp), as mensagens se misturam.

### Solução

Nova coluna `channel_id` na tabela sessions:

```sql
ALTER TABLE sessions ADD COLUMN channel_id TEXT DEFAULT NULL;
```

A chave lógica de sessão passa a ser a tupla `(agentId, userId, channelId)`. Isso permite:

- **Conversas separadas por canal**: o histórico do WhatsApp não se mistura com o do Hub.
- **Backward compatible**: channels SSE existentes continuam com `channel_id = NULL` (ou o slug do channel).

### Lookup de sessão

```typescript
function findOrCreateSession(agentId: string, userId: string, channelId: string): Session {
  // Busca sessão ativa para esta tupla
  const existing = db.prepare(`
    SELECT * FROM sessions
    WHERE agent_id = ? AND user_id = ? AND channel_id = ?
    ORDER BY updated_at DESC LIMIT 1
  `).get(agentId, userId, channelId);

  if (existing) return existing;

  // Cria nova sessão
  return createSession({ agentId, userId, channelId });
}
```

---

## "last-active" Delivery

### Conceito

O campo `delivery` no `AGENT.md` hoje aceita um channel slug fixo (ex: `system-channel`, `handerson`). Com o Channel Gateway, ganha um novo valor: `last-active`.

```yaml
---
id: handerson.tutor
owner: handerson
delivery: last-active
---
```

### Comportamento

Quando o heartbeat ou cron do agent precisa entregar uma mensagem:

1. Consulta a última sessão ativa deste agent com o owner: `SELECT channel_id FROM sessions WHERE agent_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1`
2. Se encontrar → entrega nesse canal.
3. Se não encontrar → fallback para `system-channel`.

### Caso de uso

O tutor do Handerson conversa com ele tanto no Hub (SSE) quanto no WhatsApp. Se o Handerson usou o WhatsApp por último, o heartbeat do tutor entrega a mensagem no WhatsApp. Se mudou para o Hub, entrega no Hub.

---

## Drop-in Convention

Drop-in adapters seguem a convenção de filesystem, análoga aos connectors:

```
context/shared/channel-adapters/{slug}/
  CHANNEL-ADAPTER.md     # Metadata (frontmatter YAML)
  handler.mjs            # Factory: export createChannelAdapter(config, context)
```

### CHANNEL-ADAPTER.md

```yaml
---
name: Discord
slug: discord
description: Entrega mensagens em canais Discord via Bot API
requires-env: DISCORD_BOT_TOKEN
---

# Discord Channel Adapter

Adapter para enviar e receber mensagens em servidores Discord.

## Configuração

O CHANNEL.md deve conter:
- `guild-id`: ID do servidor Discord
- `channel-id`: ID do canal de texto
- `bot-token-env`: Nome da env var com o token do bot
```

### handler.mjs

```javascript
// context/shared/channel-adapters/discord/handler.mjs

export function createChannelAdapter(config, context) {
  const token = context.env[config["bot-token-env"]];
  if (!token) throw new Error(`Env var ${config["bot-token-env"]} not set`);

  return {
    slug: "discord",

    async send({ channelId, content }) {
      const ch = config["channel-id"];
      await fetch(`https://discord.com/api/v10/channels/${ch}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
    },

    onInbound(callback) {
      // Discord Gateway (WebSocket) ou interaction webhook
      // Implementação específica do adapter
    },

    async close() {
      // Cleanup de conexões WebSocket, etc.
    },
  };
}
```

### Discovery

No startup, o backbone scanneia `context/shared/channel-adapters/*/CHANNEL-ADAPTER.md`:

1. Parseia frontmatter → extrai `slug`, `requires-env`.
2. Verifica env vars obrigatórias — se ausentes, loga warning e pula.
3. Importa `handler.mjs` → registra factory no channel-adapter registry.

---

## Plug-in Registration

### ModuleContext evolui

O `ModuleContext` ganha um método para registrar channel-adapters:

```typescript
export interface ModuleContext {
  eventBus: BackboneEventBus;
  dbPath: string;
  contextDir: string;
  log: (msg: string) => void;
  env: Record<string, string | undefined>;

  // Novo
  registerChannelAdapter(slug: string, factory: ChannelAdapterFactory): void;
}
```

### Evolution module registra "whatsapp"

```typescript
// modules/evolution/index.ts
export const evolutionModule: BackboneModule = {
  name: "evolution",

  async start(ctx: ModuleContext) {
    // ... setup existente (probe, state tracker, etc.)

    // Registra o channel-adapter "whatsapp"
    ctx.registerChannelAdapter("whatsapp", (config, adapterCtx) => {
      const instance = config.instance as string;
      const target = config.target as string;
      const baseUrl = ctx.env.EVOLUTION_URL;

      return {
        slug: "whatsapp",

        async send({ content }) {
          await fetch(`${baseUrl}/message/sendText/${instance}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: "..." },
            body: JSON.stringify({
              number: target,
              text: content,
            }),
          });
        },

        onInbound(callback) {
          // Webhook do Evolution chama callback quando mensagem chega
        },

        health() {
          // Consulta status da instância Evolution
          return { status: "healthy" };
        },
      };
    });
  },

  // ...
};
```

---

## Registry & Lifecycle

### Startup

```
Startup
  │
  ├─ 1. registerBuiltinAdapters()
  │     → Registra "sse" (built-in, sempre presente)
  │
  ├─ 2. discoverDropInAdapters()
  │     → Scanneia context/shared/channel-adapters/*/CHANNEL-ADAPTER.md
  │     → Verifica env vars (requires-env)
  │     → Importa handler.mjs → registra factory
  │     → Registra "discord", "telegram", etc.
  │
  └─ 3. startModules()
        → Evolution module.start(ctx)
        → ctx.registerChannelAdapter("whatsapp", factory)
```

### Registry interno

```typescript
class ChannelAdapterRegistry {
  private factories = new Map<string, ChannelAdapterFactory>();
  private instances = new Map<string, ChannelAdapter>();

  /** Registra factory de adapter */
  register(slug: string, factory: ChannelAdapterFactory): void;

  /** Resolve adapter instance (lazy: cria na primeira chamada) */
  resolve(slug: string, config: Record<string, unknown>): Promise<ChannelAdapter>;

  /** Lista adapters registrados */
  list(): string[];

  /** Shutdown: close() em todas as instâncias */
  async shutdownAll(): Promise<void>;
}
```

### Shutdown

```
Shutdown
  │
  ├─ channelAdapterRegistry.shutdownAll()
  │   → Chama close() em cada adapter instanciado
  │   → Fecha conexões WebSocket, timers, etc.
  │
  └─ stopModules()
      → Evolution module.stop()
```

---

## Segurança

### Secrets via convenção `*-env`

Secrets nunca aparecem em plain text no `CHANNEL.md`. Campos sensíveis usam a convenção `*-env` que aponta para o nome da variável de ambiente:

```yaml
bot-token-env: DISCORD_BOT_TOKEN    # ← nome da env var, não o token
api-key-env: EVOLUTION_API_KEY      # ← idem
```

O adapter resolve em runtime: `context.env[config["bot-token-env"]]`.

### Webhook auth

Cada adapter é responsável por autenticar seus webhooks:

- **Evolution**: header `apikey` validado pelo módulo.
- **Discord**: validação de signature (Ed25519) conforme spec do Discord.
- **Drop-in genérico**: o `handler.mjs` implementa a validação que a plataforma exige.

O backbone não impõe um mecanismo de auth — cada plataforma tem o seu. O adapter deve rejeitar requests inválidos antes de chamar `onInbound()`.

### Inbound sanitization

Antes de injetar no `sendMessage()`, o Inbound Router:

1. Limita tamanho do `content` (cap configurável).
2. Strip de caracteres de controle e zero-width.
3. Escapa XML/HTML para evitar injeção no prompt.

---

## Disambiguação de Nomes

O projeto já usa "adapter" para database connectors. Este documento introduz "channel-adapter" como conceito separado.

| Conceito | Config file | Diretório | Módulo source |
|---|---|---|---|
| **Adapter** (DB/API) | `ADAPTER.yaml` | `context/*/adapters/{slug}/` | `apps/backbone/src/adapters/` |
| **Channel-adapter** | `CHANNEL-ADAPTER.md` | `context/shared/channel-adapters/{slug}/` | `apps/backbone/src/channel-adapters/` |

### Diferenças

- **Adapter (DB)**: conecta o agent a bancos de dados e APIs externas. Usado como *tool* — o agent executa queries/mutations. Config é YAML puro.
- **Channel-adapter**: conecta o agent a plataformas de mensageria. Usado como *transporte* — o agent envia e recebe mensagens. Config é Markdown com frontmatter.

Os dois não se sobrepõem. Um `ADAPTER.yaml` nunca será confundido com um `CHANNEL-ADAPTER.md`.

---

## Migration Path

Quatro fases incrementais, cada uma non-breaking:

### Fase 1 — Foundation

**Entregáveis**: tipos TypeScript, registry, SSE built-in, coluna `channel_id`.

- Definir `ChannelAdapter`, `ChannelAdapterFactory`, `ChannelAdapterContext`.
- Implementar `ChannelAdapterRegistry` com `register()`, `resolve()`, `list()`, `shutdownAll()`.
- Registrar SSE como adapter built-in (wrapper sobre o `eventBus.emit` atual).
- `ALTER TABLE sessions ADD COLUMN channel_id`.
- **Non-breaking**: todo código existente continua funcionando. SSE é default implícito.

### Fase 2 — Routing

**Entregáveis**: `deliverToChannel()` via registry, `last-active` delivery.

- `deliverToChannel()` passa a ler `channel-adapter` do `CHANNEL.md` e resolver via registry.
- Se campo ausente → SSE (backward compatible).
- Implementar `last-active` no campo `delivery` do `AGENT.md`.
- `deliverToSystemChannel()` permanece inalterada (atalho para SSE direto).
- **Non-breaking**: sem `channel-adapter` no frontmatter, comportamento idêntico.

### Fase 3 — WhatsApp

**Entregáveis**: Evolution module registra adapter, webhook inbound, Inbound Router.

- `ModuleContext` ganha `registerChannelAdapter()`.
- Evolution module registra factory "whatsapp" no `start()`.
- Implementar Inbound Router (resolve channel → agent → session → conversa).
- Webhook Evolution chama `onInbound()` → router → `sendMessage()` → `deliverToChannel()`.
- **Feature flag**: só ativo se `EVOLUTION_URL` estiver definida (já é assim hoje).

### Fase 4 — Drop-in

**Entregáveis**: discovery de drop-in adapters, Discord como referência.

- Implementar `discoverDropInAdapters()` — scan de `context/shared/channel-adapters/*/`.
- Parsear `CHANNEL-ADAPTER.md`, verificar `requires-env`, importar `handler.mjs`.
- Criar adapter Discord como implementação de referência.
- Rota genérica `POST /channel-adapters/:slug/webhook` para inbound drop-in.
- **Feature**: cada drop-in é independente. Ausência de env vars = adapter não carrega.

---

## Validação: Três Cenários Concretos

### Cenário 1 — SSE (backward compatible)

```yaml
# CHANNEL.md existente — sem mudança
slug: handerson
owner: handerson
type: personal
```

1. `deliverToChannel("handerson", "handerson.tutor", "Oi!")`.
2. Channel registry → `channel-adapter` ausente → default `"sse"`.
3. `channelAdapterRegistry.resolve("sse")` → SSE adapter.
4. `sseAdapter.send(...)` → `eventBus.emit("channel:message", ...)`.
5. Hub recebe via SSE. **Idêntico ao comportamento atual.**

### Cenário 2 — WhatsApp (plug-in)

```yaml
slug: whatsapp-ops
owner: system
type: whatsapp
channel-adapter: whatsapp
agent: system.main
instance: evolution-main
target: "5511999999999"
```

**Outbound**: Agent heartbeat → `deliverToChannel("whatsapp-ops", ...)` → resolve `whatsapp` → Evolution API POST → mensagem chega no WhatsApp.

**Inbound**: WhatsApp responde → webhook Evolution → `onInbound("whatsapp-ops", { senderId: "5511999999999", content: "ok" })` → Inbound Router → `sendMessage()` → `runAgent()` → resposta completa → `deliverToChannel("whatsapp-ops", ...)` → volta pro WhatsApp.

### Cenário 3 — Discord (drop-in)

```yaml
slug: discord-dev
owner: system
type: discord
channel-adapter: discord
agent: system.main
guild-id: "123456789"
channel-id: "987654321"
bot-token-env: DISCORD_BOT_TOKEN
```

**Outbound**: Agent → `deliverToChannel("discord-dev", ...)` → resolve `discord` → Discord API POST → mensagem no canal.

**Inbound**: Discord interaction webhook → `POST /channel-adapters/discord/webhook` → adapter valida signature → `onInbound("discord-dev", ...)` → Inbound Router → conversa → resposta → de volta ao Discord.

---

## Referências Internas

| Arquivo | Relevância |
|---|---|
| `apps/backbone/src/channels/system-channel.ts` | `deliverToChannel()` e `deliverToSystemChannel()` atuais |
| `apps/backbone/src/channels/registry.ts` | Channel registry (scan de `CHANNEL.md`) |
| `apps/backbone/src/events/index.ts` | Event bus e tipo `ChannelMessageEvent` |
| `apps/backbone/src/modules/types.ts` | `ModuleContext` e `BackboneModule` interfaces |
| `apps/backbone/src/modules/evolution/` | Evolution module (WhatsApp) |
| `apps/backbone/src/adapters/` | Adapter registry existente (DB/API — não confundir) |
| `apps/backbone/src/db/index.ts` | Schema da tabela `sessions` |
| `apps/backbone/src/heartbeat/index.ts` | Delivery logic no heartbeat |
| `context/shared/connectors/` | Padrão de discovery por convenção (referência para drop-in) |
| `docs/agentic-backbone/CONCEPT.md` | Conceito geral do backbone |
