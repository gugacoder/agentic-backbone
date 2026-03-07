# PRP-30 — Conectores Enterprise: Slack, Microsoft Teams e Email

Tres novos conectores nativos para canais enterprise seguindo o padrao `src/connectors/{slug}/`: Slack (bot via Events API), Microsoft Teams (Incoming Webhook + Power Automate) e Email (IMAP/SMTP). Configuracao via GUI de adapters existente.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone suporta canais WhatsApp (Evolution, futuramente Cloud API), Twilio (voz) e canal SSE interno. Nao ha suporte a Slack, Teams nem Email. O padrao de conectores com ADAPTER.yaml, client, routes e channel-adapter ja esta estabelecido.

### Estado desejado

1. Conector `slack` em `src/connectors/slack/` — bot respondendo a mentions e DMs
2. Conector `teams` em `src/connectors/teams/` — recebimento via Power Automate, envio via Incoming Webhook
3. Conector `email` em `src/connectors/email/` — polling IMAP, resposta SMTP
4. Todos os 3 aparecem na GUI de adapters existente
5. Campos sensiveis mascarados, URLs de endpoint exibidas apos criacao

## Especificacao

### Feature F-116: Conector Slack

**Criar `src/connectors/slack/` com:**

```
src/connectors/slack/
  index.ts          # ConnectorDef
  client.ts         # Slack Web API via @slack/web-api
  schemas.ts        # Zod schemas para credential/options
  channel-adapter.ts
  routes.ts         # POST /connectors/slack/:adapterId/events
  tools/
    send-message.ts # Tool: send_slack_message
    index.ts
```

**`schemas.ts`:**
```typescript
credential: { bot_token, signing_secret, app_token? }
options: { listen_events: ["app_mention", "message_im"], channel_whitelist: [] }
```

**`routes.ts`** — POST `/connectors/slack/:adapterId/events`:
1. Validar `X-Slack-Signature` com `signing_secret` (HMAC-SHA256, timing-safe)
2. Se `type=url_verification`: responder com `{ challenge }`
3. Se `type=event_callback`:
   - Filtrar por `listen_events` e `channel_whitelist`
   - Extrair `user`, `channel`, `text`
   - Passar para channel-adapter

**`channel-adapter.ts`:** sessao identificada por `user + channel`; resposta via `client.chat.postMessage()`.

**Tool `send_slack_message`:**
```typescript
{ channel: string, text: string, thread_ts?: string } → { ok: boolean, ts: string }
```

Dependencia: `@slack/web-api`

### Feature F-117: Conector Microsoft Teams

**Criar `src/connectors/teams/` com:**

```
src/connectors/teams/
  index.ts
  client.ts          # HTTP client para Incoming Webhook URL
  schemas.ts
  channel-adapter.ts # Recebe payload do Power Automate
  routes.ts          # POST /connectors/teams/:adapterId/events
  tools/
    send-message.ts  # Tool: send_teams_message
    index.ts
```

**`schemas.ts`:**
```typescript
credential: { incoming_webhook_url, bot_endpoint_secret }
options: { adaptive_cards: false }
```

**`routes.ts`** — POST `/connectors/teams/:adapterId/events`:
- Validar `bot_endpoint_secret` no header ou query param
- Payload esperado (Power Automate):
  ```json
  { "from": "usuario@empresa.com", "channel": "General", "text": "...", "timestamp": "..." }
  ```
- Sessao identificada por `from` (email do usuario)

**Tool `send_teams_message`:**
```typescript
{ text: string, title?: string } → { ok: boolean }
```
Envia para `incoming_webhook_url` com payload JSON.

### Feature F-118: Conector Email (IMAP/SMTP)

**Criar `src/connectors/email/` com:**

```
src/connectors/email/
  index.ts
  client.ts          # nodemailer (SMTP) + imapflow (IMAP)
  schemas.ts
  channel-adapter.ts # Polling IMAP → conversa backbone
  tools/
    send-email.ts    # Tool: send_email_reply
    index.ts
```

**`schemas.ts`:**
```typescript
credential: { imap_host, imap_port, imap_user, imap_pass, smtp_host, smtp_port, smtp_user, smtp_pass }
options: { mailbox: "INBOX", poll_interval_seconds: 60, mark_seen: true, reply_prefix: "[Auto] " }
```

**Polling IMAP (channel-adapter):**
1. Ao iniciar adapter: registrar intervalo de `poll_interval_seconds`
2. A cada tick: IMAP SEARCH para mensagens nao lidas em `mailbox`
3. Para cada email: extrair remetente, assunto, corpo
4. Sessao identificada por `Message-ID` do email (thread)
5. Agente executa; resposta enviada via SMTP com `In-Reply-To` e `References` headers
6. Se `mark_seen: true`: marcar email como lido

**Tool `send_email_reply`:**
```typescript
{ to: string, subject: string, body: string, inReplyTo?: string } → { ok: boolean, messageId: string }
```

Dependencias: `nodemailer`, `imapflow`

### Feature F-119: GUI Hub — conectores enterprise na lista de adapters

Os 3 conectores devem aparecer automaticamente na GUI de adapters existente (`/adapters`) quando registrados no registry de conectores.

**Por conector, adicionar ao componente de detalhe de adapter:**

**Slack:**
- Bloco informativo apos criacao:
  ```
  URL de Eventos: {backboneUrl}/connectors/slack/{adapterId}/events
  ```
  Instrucao: "Configure esta URL em App Settings > Event Subscriptions no Slack API"
- Botao "Copiar URL"

**Teams:**
- Bloco informativo:
  ```
  URL do Endpoint: {backboneUrl}/connectors/teams/{adapterId}/events
  ```
  Instrucao: "Use esta URL no Power Automate HTTP Action para enviar mensagens ao agente"

**Email:**
- Botao "Testar conectividade IMAP" ao salvar (tenta conexao IMAP e exibe sucesso/erro)
- Badge "IMAP Conectado" / "Erro de conexao" no card do adapter

**Mascaramento de campos sensiveis:** `bot_token`, `signing_secret`, `app_token`, `bot_endpoint_secret`, `imap_pass`, `smtp_pass` — usar `maskSensitiveFields` de `utils/sensitive.ts`.

## Limites

- **NAO** implementar Slack Socket Mode (apenas Events API via HTTP)
- **NAO** implementar busca de mensagens historicas de email (apenas inbox nao lido)
- **NAO** implementar Adaptive Cards para Teams (apenas texto simples)
- **NAO** implementar attachments de email (apenas corpo de texto)

## Dependencias

- **PRP-21** (GUI Adaptadores — sprint 4) deve estar implementado
- Dependencias npm: `@slack/web-api`, `nodemailer`, `imapflow`

## Validacao

**Slack:**
- [ ] Mention do bot em canal ou DM dispara execucao do agente
- [ ] Resposta postada no mesmo canal/thread via `chat.postMessage`
- [ ] `X-Slack-Signature` invalido retorna 401
- [ ] `url_verification` challenge respondido corretamente

**Teams:**
- [ ] Payload inbound do Power Automate cria sessao e dispara agente
- [ ] Tool `send_teams_message` envia para Incoming Webhook com sucesso

**Email:**
- [ ] Polling IMAP detecta emails nao lidos e cria sessao por thread
- [ ] Resposta enviada via SMTP como reply com headers `In-Reply-To` corretos
- [ ] Emails marcados como lidos apos processamento quando `mark_seen: true`

**Geral:**
- [ ] Os 3 conectores coexistem sem conflito com conectores existentes
- [ ] Todos os campos sensiveis suportam interpolacao `${ENV_VAR}`
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-116 Conector Slack | S-030 sec 2 | D-050, G-051 |
| F-117 Conector Teams | S-030 sec 3 | D-050, G-051 |
| F-118 Conector Email IMAP/SMTP | S-030 sec 4 | D-050, G-051 |
| F-119 GUI Hub conectores enterprise | S-030 sec 5 | G-051 |
