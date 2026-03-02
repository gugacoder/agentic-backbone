# OpenClaw Outbound System

## Overview

O outbound system gerencia toda comunicacao de saida do agente — mensagens enviadas para canais externos (WhatsApp, Discord, Telegram, Signal, Slack, iMessage, Matrix, MS Teams).

### Problema central

> Se no heartbeat o agente decidir tomar uma acao (mandar zap, enviar mensagem no Discord), como isso funciona?

A resposta: o agente usa a **message tool** — uma ferramenta universal de comunicacao disponivel em todos os modos de operacao (heartbeat, conversation, cron).

---

## Arquitetura: Duas Vias de Outbound

O OpenClaw tem dois caminhos de saida, independentes:

### 1. Delivery do Heartbeat (passivo)

O texto que o heartbeat retorna e entregue automaticamente no canal configurado em `heartbeat.target`. O agente nao controla isso — e pos-processamento.

```
LLM retorna texto
  → stripHeartbeatToken()
  → normalizeHeartbeatReply()
  → deliverOutboundPayloads(channel, to, payloads)
```

### 2. Message Tool (ativo)

O agente, **durante a execucao**, invoca a tool `message` para mandar mensagem para qualquer canal/destinatario. Isso acontece dentro do loop de tool-calling do LLM.

```
LLM invoca tool: message({
  action: "send",
  channel: "whatsapp",
  target: "5511999998888",
  message: "Oi Guga, lembrando que..."
})
  → runMessageAction()
  → resolveChannel() → resolveTarget()
  → executeSendAction()
  → deliverOutboundPayloads()
  → loadChannelOutboundAdapter("whatsapp")
  → whatsapp.sendText()
```

---

## Message Tool (`src/agents/tools/message-tool.ts`)

Tool unica e poliformica que cobre todas as acoes de messaging:

### Actions disponiveis

| Action | Descricao |
|---|---|
| `send` | Envia mensagem (texto, midia, botoes, cards) |
| `broadcast` | Envia para multiplos destinatarios |
| `poll` | Cria enquete |
| `reply` | Responde a mensagem especifica |
| `thread-reply` | Responde em thread |
| `react` | Adiciona reacao (emoji) |
| `delete` | Apaga mensagem |
| `pin` / `unpin` | Fixa/desfixa mensagem |
| `timeout` / `kick` / `ban` | Moderacao (Discord) |
| `sendWithEffect` | Envia com efeito visual (iMessage) |
| `sendAttachment` | Envia arquivo |
| `setPresence` | Muda status do bot (Discord) |

### Schema de parametros

```typescript
{
  action: "send" | "broadcast" | "poll" | ...,
  channel: "whatsapp" | "discord" | "telegram" | ...,  // opcional, infere do contexto
  target: "5511999998888",                               // destinatario
  message: "texto da mensagem",
  media: "https://...",                                   // URL ou path local
  replyTo: "message-id",                                 // reply a msg especifica
  threadId: "thread-id",                                 // thread
  silent: true,                                          // sem notificacao
  dryRun: true,                                          // simula sem enviar
  accountId: "account-1",                                // conta especifica
}
```

### Schema dinamico por canal

A tool adapta seu schema conforme o canal ativo:

- Discord: inclui `components` (buttons, selects, modals), presenca
- Telegram: inclui `buttons` (inline keyboard), `pollDurationSeconds`, `pollAnonymous`
- WhatsApp: normaliza whitespace no inicio das mensagens
- Signal: converte markdown para styled text chunks

---

## Outbound Delivery Pipeline

### `deliverOutboundPayloads()` (`src/infra/outbound/deliver.ts`)

Orquestrador central de entrega. Todas as saidas passam por aqui.

```
deliverOutboundPayloads(params)
  │
  ├── 1. Write-ahead queue (enqueueDelivery)
  │      Persiste antes de enviar — crash recovery
  │
  ├── 2. Hook: message_sending
  │      Plugin hook que pode modificar ou cancelar a mensagem
  │
  ├── 3. Payload normalization
  │      - Chunk texto longo (por canal)
  │      - Normalizar WhatsApp (strip leading whitespace)
  │      - Signal: markdown → styled text chunks
  │
  ├── 4. Channel handler resolution
  │      loadChannelOutboundAdapter(channel) → createChannelHandler()
  │
  ├── 5. Delivery
  │      handler.sendText() / handler.sendMedia() / handler.sendPayload()
  │
  ├── 6. Hook: message_sent
  │      Notifica plugins que a mensagem foi enviada (ou falhou)
  │
  ├── 7. Session mirror
  │      appendAssistantMessageToSessionTranscript() — audit trail
  │
  └── 8. Queue ack/fail
         ackDelivery() ou failDelivery()
```

### Write-Ahead Delivery Queue (`delivery-queue.ts`)

```
enqueueDelivery(payload) → queueId
  ... envio ...
ackDelivery(queueId)     → remove da fila
failDelivery(queueId, reason) → marca como falha
```

Na inicializacao, mensagens nao-acked sao re-enviadas (crash recovery).

---

## Channel Outbound Adapter

Cada canal implementa um `ChannelOutboundAdapter`:

```typescript
type ChannelOutboundAdapter = {
  deliveryMode: "direct" | "gateway" | "hybrid";
  chunker?: (text: string, limit: number) => string[];
  chunkerMode?: "text" | "markdown";
  textChunkLimit?: number;
  resolveTarget?: (params) => { ok: true; to: string } | { ok: false; error: Error };
  sendText?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
  sendMedia?: (ctx: ChannelOutboundContext) => Promise<OutboundDeliveryResult>;
  sendPoll?: (ctx: ChannelPollContext) => Promise<ChannelPollResult>;
  sendPayload?: (ctx: ChannelOutboundPayloadContext) => Promise<OutboundDeliveryResult>;
};
```

### Delivery modes

| Mode | Descricao |
|---|---|
| `direct` | Envia direto via SDK/API do canal (Discord.js, Telegraf, etc.) |
| `gateway` | Envia via gateway WebSocket intermediario |
| `hybrid` | Tenta direct, fallback para gateway |

### Implementacoes existentes (`src/channels/plugins/outbound/`)

- `discord.ts` — Discord via discord.js
- `telegram.ts` — Telegram via Telegraf
- `whatsapp.ts` — WhatsApp via Evolution API
- `signal.ts` — Signal via signal-cli
- `slack.ts` — Slack via Bolt
- `imessage.ts` — iMessage via BlueBubbles
- `direct-text-media.ts` — base reutilizavel para canais simples

---

## Heartbeat e Outbound: Integracao

### Heartbeat Delivery Target

O heartbeat resolve pra onde entregar via `resolveHeartbeatDeliveryTarget()`:

```typescript
// Configuracao no agent
heartbeat: {
  target: "last"           // ultimo canal usado
  // ou: "whatsapp"        // canal fixo
  // ou: "none"            // sem delivery
  accountId: "account-1"   // conta especifica
}
```

### Channel Readiness Check

Antes de entregar, o heartbeat verifica se o canal esta pronto:

```typescript
type ChannelHeartbeatAdapter = {
  checkReady?: (params) => Promise<{ ok: boolean; reason: string }>;
  resolveRecipients?: (params) => { recipients: string[]; source: string };
};
```

Exemplos de `reason` quando nao esta pronto:
- WhatsApp desconectado
- Bot Discord offline
- Signal sem sessao ativa

### Fluxo completo do heartbeat com outbound

```
Timer fires
  │
  ├── Guard checks (enabled, active-hours, queue vazia, HEARTBEAT.md nao vazio)
  │
  ├── Preflight (events pendentes, cron events)
  │
  ├── Resolve delivery target (canal + destinatario)
  │
  ├── Resolve visibility (showOk, showAlerts, useIndicator)
  │
  ├── getReplyFromConfig() — chama LLM com TODAS as tools
  │     │
  │     └── LLM pode invocar tool "message" aqui ← ACAO PROATIVA
  │
  ├── Normalize reply (strip HEARTBEAT_OK, dedup 24h)
  │
  ├── checkReady() — canal pronto?
  │
  └── deliverOutboundPayloads() — entrega no canal configurado
```

---

## Message Action Runner (`src/infra/outbound/message-action-runner.ts`)

Router central que despacha acoes da message tool:

```typescript
runMessageAction(input: RunMessageActionParams): Promise<MessageActionRunResult>
```

### Fluxo

```
runMessageAction(input)
  │
  ├── Parse action, target, channel
  │
  ├── Resolve channel (from params or context)
  │
  ├── Resolve account binding (agent → channel account)
  │
  ├── Resolve target (name → id via ChannelResolverAdapter)
  │
  ├── Enforce cross-context policy (anti-spoofing)
  │
  ├── Dispatch by action type:
  │     ├── "send"      → handleSendAction() → executeSendAction()
  │     ├── "broadcast"  → handleBroadcastAction() (loop over targets × channels)
  │     ├── "poll"       → handlePollAction() → executePollAction()
  │     └── other        → handlePluginAction() → dispatchChannelMessageAction()
  │
  └── Return MessageActionRunResult
```

### Cross-Context Policy (`outbound-policy.ts`)

Seguranca para prevenir spoofing quando o agente manda msg de um contexto pra outro:

- Detecta se a mensagem cruza contextos (ex: heartbeat → DM de usuario)
- Pode adicionar decoracao identificando a origem
- Pode bloquear a acao se a policy nao permite

---

## Outbound Session (`outbound-session.ts`)

Quando o agente envia uma mensagem proativa (via tool), o sistema cria/resolve uma sessao de outbound:

```typescript
resolveOutboundSessionRoute({
  cfg, channel, agentId, accountId, target, resolvedTarget, replyToId, threadId
}) → { sessionKey }

ensureOutboundSessionEntry({
  cfg, agentId, channel, accountId, route
})
```

Isso garante que:
1. A mensagem e registrada numa sessao (audit trail)
2. Respostas do destinatario voltam pra mesma sessao
3. O historico de conversa fica coerente

---

## Pontos-Chave de Design

1. **Tool, nao pos-processamento** — O agente envia mensagens invocando uma tool durante execucao, nao retornando texto que e processado depois.

2. **Canal-agnostico** — A message tool abstrai o canal. O agente diz "manda pro fulano" e o sistema resolve o canal e o adapter.

3. **Write-ahead queue** — Mensagens persistidas antes do envio. Crash recovery automatico.

4. **Readiness check** — O sistema verifica se o canal esta pronto antes de tentar enviar.

5. **Cross-context safety** — Policy que previne spoofing e marca mensagens que cruzam contextos.

6. **Session binding** — Mensagens proativas criam sessoes para manter coerencia no historico.

7. **Deduplicacao** — Heartbeat suprime mensagens identicas dentro de 24h.

8. **Hooks** — `message_sending` (pre-envio, pode cancelar) e `message_sent` (pos-envio, audit).

---

## Arquivos Relevantes

| Arquivo | Proposito |
|---|---|
| `src/agents/tools/message-tool.ts` | Definicao da tool "message" |
| `src/infra/outbound/deliver.ts` | Pipeline de entrega |
| `src/infra/outbound/delivery-queue.ts` | Write-ahead queue |
| `src/infra/outbound/message-action-runner.ts` | Router de acoes |
| `src/infra/outbound/agent-delivery.ts` | Resolucao de delivery plan |
| `src/infra/outbound/outbound-policy.ts` | Cross-context policy |
| `src/infra/outbound/outbound-session.ts` | Session binding |
| `src/infra/outbound/session-context.ts` | Contexto de sessao outbound |
| `src/infra/outbound/targets.ts` | Resolucao de target para heartbeat |
| `src/infra/heartbeat-runner.ts` | Heartbeat com integracao outbound |
| `src/channels/plugins/outbound/load.ts` | Loader de outbound adapter |
| `src/channels/plugins/outbound/whatsapp.ts` | WhatsApp outbound |
| `src/channels/plugins/outbound/discord.ts` | Discord outbound |
| `src/channels/plugins/outbound/telegram.ts` | Telegram outbound |
| `src/channels/plugins/outbound/signal.ts` | Signal outbound |
| `src/channels/plugins/outbound/slack.ts` | Slack outbound |
| `src/channels/plugins/types.adapters.ts` | Tipos de adapter (ChannelOutboundAdapter, etc.) |
