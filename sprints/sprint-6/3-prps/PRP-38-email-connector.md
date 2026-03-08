# PRP-38 — Email Connector (IMAP/SMTP)

Conector de Email nativo com polling IMAP, resposta automatica via SMTP com threading correto e GUI de configuracao no Hub. Completa o trio enterprise: Slack (Sprint 5) + Teams (Sprint 5) + Email (Sprint 6).

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone possui connectors para Slack e Teams (Sprint 5) mas nenhum conector de email. Agentes nao conseguem receber nem responder emails. O padrao de connector ja esta estabelecido em `src/connectors/{slug}/` com client factory, schemas Zod, tools e channel-adapter.

### Estado desejado

1. Connector `email` em `src/connectors/email/` seguindo o padrao existente
2. Polling IMAP para receber emails nao lidos → criar sessoes de conversa backbone por thread
3. Resposta automatica via SMTP com threading correto (headers `In-Reply-To`, `References`)
4. Tools para o agente: `send_email_reply`, `get_email_thread`, `create_email_draft`
5. GUI de configuracao no Hub na pagina de adapters

## Especificacao

### Feature F-133: Connector Email — IMAP/SMTP + Channel-Adapter + Polling

**Estrutura em `src/connectors/email/`:**

```
src/connectors/email/
  index.ts             # ConnectorDef — registra schemas, tools, channel-adapter, client factory
  client.ts            # ImapFlow (recebimento) + Nodemailer (envio)
  schemas.ts           # Zod schema para ADAPTER.yaml
  channel-adapter.ts   # Polling IMAP → backbone conversation
  tools/
    send-reply.ts      # Tool: enviar resposta/novo email
    get-thread.ts      # Tool: buscar thread completa por Message-ID
    create-draft.ts    # Tool: criar rascunho (nao envia automaticamente)
    index.ts
```

**Schema ADAPTER.yaml:**

```yaml
connector: email
credential:
  imap_host: "imap.gmail.com"
  imap_port: 993
  imap_user: "${EMAIL_USER}"
  imap_pass: "${EMAIL_PASS}"
  smtp_host: "smtp.gmail.com"
  smtp_port: 587
  smtp_secure: false
  smtp_user: "${EMAIL_USER}"
  smtp_pass: "${EMAIL_PASS}"
options:
  mailbox: "INBOX"
  poll_interval_seconds: 60
  mark_seen: true
  reply_prefix: "[Auto] "
  from_name: "Assistente IA"
  sender_whitelist: []       # vazio = aceitar de todos
  subject_filter: ""         # regex opcional
  auto_reply: true
policy: readwrite
```

**Estado de polling** em `data/email-state/{adapterId}.json`:

```json
{
  "adapterId": "email-suporte",
  "lastUid": 1042,
  "processedMessageIds": ["<msg-001@mail.example.com>"],
  "updatedAt": "2026-03-07T15:00:00Z"
}
```

**Fluxo de polling (channel-adapter):**

1. Channel-adapter registrado no startup, polling iniciado para cada adapter `email` habilitado
2. A cada `poll_interval_seconds`: IMAP SEARCH `UNSEEN` no mailbox configurado
3. Para cada email nao processado (verificado por Message-ID):
   a. Extrai: remetente, assunto, corpo, Message-ID, In-Reply-To, References
   b. Determina thread: se `In-Reply-To` existe, busca sessao existente; caso contrario, nova sessao
   c. Cria/continua sessao backbone com `channelType: "email"`, `userRef: remetente`
   d. Prompt estruturado enviado ao agente com cabecalhos e corpo em XML
   e. Se `auto_reply: true`: resposta do agente enviada via SMTP com threading correto
   f. Atualiza estado de polling (lastUid, processedMessageIds)
4. Evento emitido no EventBus: `channel:message` com `channelType: "email"`

**Prompt injetado ao agente:**

```xml
<email_received>
  <from>Joao Silva &lt;joao@empresa.com&gt;</from>
  <subject>Duvida sobre prazo</subject>
  <message_id>&lt;msg-001@mail.example.com&gt;</message_id>
  <body>Boa tarde, gostaria de saber...</body>
</email_received>
```

**Dependencias de pacote:**

```json
{ "imapflow": "^1.0.0", "nodemailer": "^6.0.0" }
```

### Feature F-134: Tools Email + API Endpoints de Status

**Tool `send_email_reply`:**

```typescript
// Input
{ to: string, subject: string, body: string, bodyHtml?: string,
  inReplyTo?: string, references?: string, cc?: string[] }
// Output
{ ok: boolean, messageId: string }
```

**Tool `get_email_thread`:**

```typescript
// Input
{ messageId: string }
// Output
{ messages: Array<{ messageId, from, date, subject, body }> }
```

**Tool `create_email_draft`:**

```typescript
// Input
{ to: string, subject: string, body: string, inReplyTo?: string }
// Output
{ draftId: string }
```

**Endpoints de status/teste:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/adapters/email/:adapterId/test` | Testar conectividade IMAP e SMTP |
| GET | `/adapters/email/:adapterId/status` | Status do polling (ultima execucao, emails processados) |

**POST `/adapters/email/:adapterId/test`:**

```json
{
  "imap": { "ok": true, "latencyMs": 320, "mailbox": "INBOX", "unreadCount": 5 },
  "smtp": { "ok": true, "latencyMs": 180 }
}
```

**GET `/adapters/email/:adapterId/status`:**

```json
{
  "adapterId": "email-suporte",
  "polling": true,
  "lastPollAt": "2026-03-07T15:00:00Z",
  "processedToday": 12,
  "lastError": null
}
```

### Feature F-135: Hub — Formulario de Adapter Email + Card de Status

**`/adapters` — Formulario de criacao para tipo "Email":**

- Secao "Recebimento (IMAP)": host, porta, usuario, senha
- Secao "Envio (SMTP)": host, porta, toggle STARTTLS, usuario, senha
- Secao "Opcoes": mailbox, intervalo de polling, toggle marcar como lido, prefixo de resposta, nome do remetente, toggle auto-reply
- Campo: whitelist de remetentes (lista de emails, um por linha)
- Campo: filtro de assunto (regex, opcional)
- Botao "Testar conexao" — chama `/adapters/email/:adapterId/test` e exibe resultado IMAP + SMTP separados com latencia
- Campos sensiveis (senhas) suportam `${ENV_VAR}` e sao mascarados na GUI (usando `utils/sensitive.ts` existente)
- Apos criacao: card de status com indicador de polling e contagem de emails processados hoje

**`/agents/:id/channels` — Card Email:**

- Status: polling ativo/inativo
- Ultima execucao de polling
- Emails processados (ultimas 24h)
- Botao "Ver conversas de email" → filtra sessoes por `channelType: email`

## Limites

- **NAO** implementar suporte a OAuth2 nesta versao (apenas user/pass ou app password)
- **NAO** implementar envio de anexos (apenas corpo texto/HTML)
- **NAO** implementar IMAP IDLE (usar polling por intervalo configurado)

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-12** (Sistema de Adapters) deve estar implementado — novo tipo de adapter
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova secao na pagina de canais

## Validacao

- [ ] Polling IMAP detecta emails nao lidos e cria sessao backbone por thread (Message-ID)
- [ ] Email de thread existente continua a sessao backbone correspondente
- [ ] Resposta do agente enviada via SMTP com headers `In-Reply-To` e `References` corretos
- [ ] `mark_seen: true` marca email como lido no IMAP apos processamento
- [ ] `sender_whitelist` filtra emails de remetentes nao listados (sem criar sessao)
- [ ] `auto_reply: false` cria sessao e notifica via SSE, mas nao envia resposta por email
- [ ] Tool `send_email_reply` envia email com threading correto
- [ ] Botao "Testar conexao" retorna status IMAP e SMTP separados com latencia
- [ ] Multiplos adapters de email coexistem sem conflito de polling
- [ ] Estado de polling persiste entre reinicializacoes do backbone (sem reprocessar emails ja vistos)
- [ ] Campos sensiveis suportam `${ENV_VAR}` e sao mascarados na GUI
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-133 Connector email + polling | S-038 sec 3 | D-052, G-053 |
| F-134 Tools email + API status | S-038 sec 3.5-4 | D-052, G-053 |
| F-135 Hub formulario + card status | S-038 sec 6 | G-053 |
