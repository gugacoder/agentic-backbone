# S-038 — Email Connector (IMAP/SMTP)

Conector de Email nativo com GUI no Hub: agente como inbox de email, respondendo automaticamente com personalidade e contexto do negócio. Completa o trio enterprise: Slack (Sprint 5) + Teams (Sprint 5) + Email.

**Resolve:** D-052 (conector de email ausente), G-053 (email connector nativo com GUI)
**Score de prioridade:** 8
**Referência:** S-030 (Sprint 5) definiu a spec inicial agrupada com Slack/Teams. Esta spec é focada apenas no Email e refina os detalhes de implementação.

---

## 1. Objetivo

- Implementar conector `email` seguindo o padrão `src/connectors/{slug}/` existente
- Polling IMAP para receber emails não lidos → criar sessões de conversa backbone
- Resposta automática via SMTP com threading correto (`In-Reply-To`, `References` headers)
- Channel-adapter para SSE: eventos de email são notificados no hub de eventos
- Configuração via GUI de adapters existente (sem código)
- Suporte a múltiplas contas de email por agente (múltiplos adapters)

---

## 2. Sem Schema DB Adicional

Sessions de email são gerenciadas pelo sistema de conversas existente. Estado de polling (último UID IMAP processado) armazenado em arquivo por adapter: `data/mcp-state/{adapterId}.json`.

### 2.1 Estado de polling (`data/email-state/{adapterId}.json`)

```json
{
  "adapterId": "email-suporte",
  "lastUid": 1042,
  "processedMessageIds": ["<msg-001@mail.example.com>"],
  "updatedAt": "2026-03-07T15:00:00Z"
}
```

---

## 3. Conector Email (`src/connectors/email/`)

### 3.1 Estrutura

```
src/connectors/email/
  index.ts             # ConnectorDef — registra schemas, tools, channel-adapter, client factory
  client.ts            # ImapFlow (recebimento) + Nodemailer (envio)
  schemas.ts           # Zod schema para ADAPTER.yaml
  channel-adapter.ts   # Polling IMAP → backbone conversation
  tools/
    send-reply.ts      # Tool: enviar resposta/novo email
    get-thread.ts      # Tool: buscar thread completa por Message-ID
    create-draft.ts    # Tool: criar rascunho (não envia automaticamente)
    index.ts
```

### 3.2 Schema ADAPTER.yaml

```yaml
connector: email
credential:
  imap_host: "imap.gmail.com"
  imap_port: 993
  imap_user: "Usuário do email"
  imap_pass: "${EMAIL_PASS}"
  smtp_host: "smtp.gmail.com"
  smtp_port: 587
  smtp_secure: false          # true para port 465 (SSL), false para STARTTLS
  smtp_user: "Usuário do email"
  smtp_pass: "${EMAIL_PASS}"
options:
  mailbox: "INBOX"
  poll_interval_seconds: 60
  mark_seen: true             # marcar como lido ao processar
  reply_prefix: "[Auto] "    # prefixo no Subject de resposta (vazio = sem prefixo)
  from_name: "Assistente IA" # nome exibido no remetente
  sender_whitelist: []        # vazio = aceitar de todos; lista = filtrar por remetente
  subject_filter: ""          # regex opcional para filtrar por assunto
  auto_reply: true            # false = apenas categoriza/notifica, sem responder
policy: readwrite
```

### 3.3 Fluxo de polling

1. Channel-adapter registrado no startup, polling iniciado para cada adapter `email` habilitado
2. A cada `poll_interval_seconds`: IMAP SEARCH `UNSEEN SINCE {lastDate}` no mailbox configurado
3. Para cada email não processado (verifica por Message-ID em `processedMessageIds`):
   a. Extrai: remetente, assunto, corpo texto/HTML, Message-ID, In-Reply-To, References
   b. Determina thread: se `In-Reply-To` existe, busca sessão existente por Message-ID; caso contrário, nova sessão
   c. Cria/continua sessão backbone com `channelType: "email"`, `userRef: remetente`
   d. Input para agente: prompt estruturado com cabeçalhos e corpo do email
   e. Se `auto_reply: true`: resposta do agente enviada via SMTP com threading correto
   f. Atualiza estado de polling (lastUid, processedMessageIds)
4. Evento emitido no EventBus: `channel:message` com `channelType: "email"`

### 3.4 Prompt injetado ao agente

```xml
<email_received>
  <from>João Silva &lt;joao@empresa.com&gt;</from>
  <subject>Dúvida sobre prazo de entrega</subject>
  <message_id>&lt;msg-001@mail.example.com&gt;</message_id>
  <body>
    Boa tarde, gostaria de saber o prazo estimado para...
  </body>
</email_received>
```

### 3.5 Tool `send_email_reply`

```typescript
// Input
{
  to: string,            // destinatário (obrigatório)
  subject: string,       // assunto (pre-populado com "Re: {original subject}")
  body: string,          // corpo em texto plano (HTML opcional)
  bodyHtml?: string,
  inReplyTo?: string,    // Message-ID do email original (para threading)
  references?: string,   // headers References completos
  cc?: string[]
}
// Output
{ ok: boolean, messageId: string }
```

### 3.6 Tool `get_email_thread`

```typescript
// Input
{ messageId: string }  // Message-ID do email raiz da thread
// Output
{
  messages: Array<{
    messageId: string,
    from: string,
    date: string,
    subject: string,
    body: string
  }>
}
```

### 3.7 Tool `create_email_draft`

```typescript
// Input
{ to: string, subject: string, body: string, inReplyTo?: string }
// Output
{ draftId: string }  // ID do rascunho no IMAP (sem envio)
```

---

## 4. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/adapters/email/:adapterId/test` | Testar conectividade IMAP e SMTP |
| GET | `/adapters/email/:adapterId/status` | Status do polling (última execução, emails processados) |

### 4.1 POST `/adapters/email/:adapterId/test`

**Response:**
```json
{
  "imap": { "ok": true, "latencyMs": 320, "mailbox": "INBOX", "unreadCount": 5 },
  "smtp": { "ok": true, "latencyMs": 180 }
}
```

### 4.2 GET `/adapters/email/:adapterId/status`

**Response:**
```json
{
  "adapterId": "email-suporte",
  "polling": true,
  "lastPollAt": "2026-03-07T15:00:00Z",
  "processedToday": 12,
  "lastError": null
}
```

---

## 5. Dependências

```json
{
  "imapflow": "^1.0.0",
  "nodemailer": "^6.0.0"
}
```

---

## 6. Telas (Hub)

### 6.1 `/adapters` — Criação de adapter Email

- Seção "Recebimento (IMAP)": host, porta, usuário, senha
- Seção "Envio (SMTP)": host, porta, STARTTLS toggle, usuário, senha
- Seção "Opções": mailbox, intervalo de polling, marcar como lido, prefixo de resposta, nome do remetente, auto-reply toggle
- Campo: whitelist de remetentes (lista de emails, um por linha)
- Campo: filtro de assunto (regex, opcional)
- Botão "Testar conexão" — chama `/adapters/email/:adapterId/test` e exibe resultado IMAP + SMTP
- Após criação: card de status com indicador de polling e contagem de emails processados hoje

### 6.2 `/agents/:id/channels` — Card Email

- Status: polling ativo/inativo
- Última execução de polling
- Emails processados (últimas 24h)
- Botão "Ver conversas de email" → filtra sessões por `channelType: email`

---

## 7. Critérios de Aceite

- [ ] Polling IMAP detecta emails não lidos e cria sessão backbone por thread (Message-ID)
- [ ] Email de thread existente continua a sessão backbone correspondente
- [ ] Resposta do agente enviada via SMTP com headers `In-Reply-To` e `References` corretos
- [ ] `mark_seen: true` marca email como lido no IMAP após processamento
- [ ] `sender_whitelist` filtra emails de remetentes não listados (sem criar sessão)
- [ ] `auto_reply: false` cria sessão e notifica via SSE, mas não envia resposta por email
- [ ] Tool `send_email_reply` envia email com threading correto
- [ ] Botão "Testar conexão" retorna status IMAP e SMTP separados com latência
- [ ] Múltiplos adapters de email coexistem sem conflito de polling
- [ ] Estado de polling persiste entre reinicializações do backbone (sem reprocessar emails já vistos)
- [ ] Campos sensíveis (senhas IMAP/SMTP) suportam `${ENV_VAR}` e são mascarados na GUI
