# S-030 — Conectores Enterprise: Slack, Microsoft Teams e Email

Novos conectores nativos para canais enterprise: Slack (bot em workspaces), Microsoft Teams (incoming webhook) e Email (IMAP/SMTP). Configuracao via GUI de adapters existente.

**Resolve:** D-050 (sem canais enterprise), G-051 (Slack, Teams e Email nativos)
**Score de prioridade:** 7

---

## 1. Objetivo

- Implementar 3 conectores seguindo o padrao `src/connectors/{slug}/`
- Agente como bot de Slack respondendo a mentions e DMs
- Agente respondendo a mensagens em canais do Teams via webhook
- Agente triando e respondendo emails via IMAP/SMTP
- Configuracao sem codigo via GUI de adapters ja existente

---

## 2. Conector Slack (`src/connectors/slack/`)

### 2.1 Estrutura

```
src/connectors/slack/
  index.ts
  client.ts          # Slack Web API (via @slack/web-api)
  schemas.ts
  channel-adapter.ts # Events API: app_mention + message.im → conversa backbone
  routes.ts          # POST /connectors/slack/:adapterId/events (Slack Events API)
  tools/
    send-message.ts  # Tool: postar mensagem em canal ou DM
    index.ts
```

### 2.2 Schema ADAPTER.yaml

```yaml
connector: slack
credential:
  bot_token: "${SLACK_BOT_TOKEN}"       # xoxb-... (OAuth Bot Token)
  signing_secret: "${SLACK_SIGN_SECRET}" # validacao de requests da Slack
  app_token: "${SLACK_APP_TOKEN}"        # xapp-... (para Socket Mode, opcional)
options:
  listen_events:
    - app_mention     # quando o bot e mencionado em canais
    - message_im      # DMs diretas ao bot
  channel_whitelist: []  # lista de channel IDs permitidos (vazio = todos)
policy: readwrite
```

### 2.3 Fluxo de eventos

1. Slack envia POST para `/connectors/slack/:adapterId/events`
2. Backbone valida `X-Slack-Signature` com `signing_secret`
3. Se `type=url_verification`: responde com `challenge`
4. Se `type=event_callback`: extrai mensagem, cria/continua sessao por `user + channel`
5. Agente executa e resposta e postada via `chat.postMessage`

### 2.4 Tool `send_slack_message`

```typescript
// Input
{ channel: string, text: string, thread_ts?: string }
// Output
{ ok: boolean, ts: string }
```

---

## 3. Conector Microsoft Teams (`src/connectors/teams/`)

### 3.1 Estrutura

```
src/connectors/teams/
  index.ts
  client.ts          # HTTP client para Incoming Webhook URL
  schemas.ts
  channel-adapter.ts # Recebe via Power Automate webhook
  routes.ts          # POST /connectors/teams/:adapterId/events
  tools/
    send-message.ts  # Tool: postar mensagem via incoming webhook
    index.ts
```

### 3.2 Schema ADAPTER.yaml

```yaml
connector: teams
credential:
  incoming_webhook_url: "${TEAMS_WEBHOOK_URL}"  # URL do Incoming Webhook do Teams
  bot_endpoint_secret: "${TEAMS_SECRET}"         # validar payload inbound
options:
  adaptive_cards: false  # usar Adaptive Cards ou texto simples
policy: readwrite
```

### 3.3 Modelo simplificado

Teams usa Incoming Webhooks para *envio* (sem autenticacao de app complexa). Para *recebimento*, o operador configura um Flow no Power Automate que envia HTTP POST para o backbone ao receber mensagem.

Formato de payload recebido do Power Automate:
```json
{
  "from": "usuario@empresa.com",
  "channel": "General",
  "text": "Ola, preciso de ajuda com o relatorio",
  "timestamp": "2026-03-07T15:00:00Z"
}
```

### 3.4 Tool `send_teams_message`

```typescript
// Input
{ text: string, title?: string }
// Output
{ ok: boolean }
```

---

## 4. Conector Email (`src/connectors/email/`)

### 4.1 Estrutura

```
src/connectors/email/
  index.ts
  client.ts          # nodemailer (SMTP envio) + imapflow (IMAP recebimento)
  schemas.ts
  channel-adapter.ts # Polling IMAP → conversa backbone
  tools/
    send-email.ts    # Tool: enviar email de resposta
    index.ts
```

### 4.2 Schema ADAPTER.yaml

```yaml
connector: email
credential:
  imap_host: "imap.gmail.com"
  imap_port: 993
  imap_user: "${EMAIL_USER}"
  imap_pass: "${EMAIL_PASS}"
  smtp_host: "smtp.gmail.com"
  smtp_port: 587
  smtp_user: "${EMAIL_USER}"
  smtp_pass: "${EMAIL_PASS}"
options:
  mailbox: "INBOX"
  poll_interval_seconds: 60   # frequencia de polling IMAP
  mark_seen: true             # marcar emails como lidos ao processar
  reply_prefix: "[Auto] "    # prefixo no Subject de resposta
policy: readwrite
```

### 4.3 Fluxo de polling

1. A cada `poll_interval_seconds`, backbone faz IMAP SEARCH para emails nao lidos
2. Para cada email: extrai remetente, assunto, corpo
3. Cria sessao de conversa identificada por `Message-ID` do email (thread)
4. Agente executa com corpo do email como input
5. Resposta enviada via SMTP como reply ao email original (In-Reply-To header)

### 4.4 Tool `send_email_reply`

```typescript
// Input
{ to: string, subject: string, body: string, inReplyTo?: string }
// Output
{ ok: boolean, messageId: string }
```

---

## 5. Telas (Hub)

Todos os 3 conectores aparecem na GUI de adapters ja existente (`/adapters`):

- Lista de conectores disponiveis inclui `slack`, `teams`, `email`
- Formulario de criacao preenchido com campos do schema
- Campos sensiveis (`bot_token`, `imap_pass`, etc.) mascarados apos salvar
- Para Slack: exibir URL do endpoint de eventos apos criacao
- Para Teams: exibir URL do endpoint e instrucoes de configuracao do Power Automate Flow
- Para Email: status de conexao IMAP (testar conectividade ao salvar)

---

## 6. Criterios de Aceite

**Slack:**
- [ ] Mention do bot em canal ou DM dispara execucao do agente
- [ ] Resposta do agente e postada no mesmo canal/thread via `chat.postMessage`
- [ ] Validacao de `X-Slack-Signature` rejeita requests invalidos com 401
- [ ] `url_verification` desafio respondido corretamente

**Teams:**
- [ ] Payload inbound do Power Automate cria sessao e dispara agente
- [ ] Tool `send_teams_message` envia para Incoming Webhook com sucesso

**Email:**
- [ ] Polling IMAP detecta emails nao lidos e cria sessao por thread
- [ ] Resposta do agente enviada via SMTP como reply com headers corretos (`In-Reply-To`)
- [ ] Emails marcados como lidos apos processamento (se `mark_seen: true`)

**Geral:**
- [ ] Os 3 conectores coexistem sem conflito com `evolution`, `whatsapp-cloud`, `twilio`
- [ ] Todos os campos sensiveis suportam interpolacao `${ENV_VAR}`
