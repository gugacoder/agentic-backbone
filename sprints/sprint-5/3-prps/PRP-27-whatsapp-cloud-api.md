# PRP-27 — Conector WhatsApp Cloud API (Meta Oficial)

Novo conector nativo `whatsapp-cloud` usando a Meta Cloud API oficial (Graph API v19+), substituindo a Evolution API como opcao de canal de primeiro nivel, eliminando o risco de banimento.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone possui o conector `evolution` para WhatsApp, que usa uma API nao-oficial com risco de banimento da conta. Nao existe conector para a API oficial da Meta. O padrao de conectores (`src/connectors/{slug}/`) ja esta estabelecido com exemplos funcionais (mysql, postgres, evolution, twilio).

### Estado desejado

1. Conector `whatsapp-cloud` em `src/connectors/whatsapp-cloud/` seguindo o padrao existente
2. Webhook de verificacao (GET) e recepcao de eventos (POST) da Meta
3. Tools: `send_whatsapp_text`, `send_whatsapp_template`, `get_whatsapp_media`
4. Conector coexiste com `evolution` sem conflito
5. GUI de adapters exibe URL do webhook apos configuracao

## Especificacao

### Feature F-104: Estrutura do conector + client + schemas

**Criar `src/connectors/whatsapp-cloud/` com:**

```
src/connectors/whatsapp-cloud/
  index.ts        # ConnectorDef exportando factory, schemas, tools, routes, channel-adapter
  client.ts       # WhatsAppCloudClient — wrap do Graph API v19+
  schemas.ts      # Zod schemas para ADAPTER.yaml credential/options
```

**`schemas.ts`** — Zod schema do ADAPTER.yaml:

```typescript
export const WhatsAppCloudCredentialSchema = z.object({
  access_token: z.string(),
  phone_number_id: z.string(),
  webhook_verify_token: z.string(),
  business_account_id: z.string(),
  app_secret: z.string(),         // para validacao X-Hub-Signature-256
})

export const WhatsAppCloudOptionsSchema = z.object({
  api_version: z.string().default("v19.0"),
  auto_reply_read: z.boolean().default(true),
})
```

**`client.ts`** — metodos essenciais:
- `sendText(to: string, body: string): Promise<void>`
- `sendTemplate(to: string, templateName: string, languageCode: string): Promise<void>`
- `getMediaUrl(mediaId: string): Promise<string>`
- `markAsRead(messageId: string): Promise<void>`

Registrar conector no registry de conectores existente.

### Feature F-105: Routes (webhook Meta) + channel-adapter

**`routes.ts`** — Rotas Hono montadas pelo backbone:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/connectors/whatsapp-cloud/:adapterId/webhook` | Verificacao do webhook Meta (hub.challenge) |
| POST | `/connectors/whatsapp-cloud/:adapterId/webhook` | Recepcao de eventos da Meta |

**Validacao do POST:**
1. Verificar `X-Hub-Signature-256` com `app_secret` (timing-safe)
2. Retornar 401 se invalido
3. Extrair mensagens do payload Meta (formato `entry[].changes[].value.messages[]`)
4. Passar cada mensagem para o `channel-adapter`

**`channel-adapter.ts`** — segue o padrao do `evolution`:
- Entrada: mensagem do usuario (from, text.body, timestamp, id)
- Cria/continua sessao de conversa identificada por `from` (numero de telefone)
- Executa agente com o texto como input
- Envia resposta via `client.sendText()`
- Se `auto_reply_read: true`: chama `client.markAsRead()` ao receber mensagem

### Feature F-106: Tools do conector

**`tools/send-text.ts`** — `send_whatsapp_text`:
```typescript
// Input
{ to: string, body: string }
// Output
{ ok: boolean, messageId: string }
```

**`tools/send-template.ts`** — `send_whatsapp_template`:
```typescript
// Input
{ to: string, templateName: string, languageCode?: string }
// Output
{ ok: boolean, messageId: string }
```

**`tools/get-media.ts`** — `get_whatsapp_media`:
```typescript
// Input
{ mediaId: string }
// Output
{ url: string, mimeType: string }
```

**`tools/index.ts`** — exporta `createWhatsAppCloudTools(slugs: string[])`.

### Feature F-107: GUI Hub — URL do webhook na pagina de adapters

A GUI de adapters ja existente (`/adapters`) deve exibir, apos criacao do adapter `whatsapp-cloud`:

- Todos os campos do schema (credential + options) no formulario de configuracao
- Campos `access_token`, `app_secret` e `imap_pass` mascarados apos salvar (usando `maskSensitiveFields` de `utils/sensitive.ts`)
- **Bloco informativo** exibindo:
  ```
  Webhook URL: {backboneUrl}/connectors/whatsapp-cloud/{adapterId}/webhook
  ```
  Com instrucao: "Configure esta URL no Meta Business Manager > WhatsApp > Configuracao do Webhook"
  E botao "Copiar URL"

Nenhuma nova pagina necessaria — apenas adicionar o bloco informativo ao componente de detalhe de adapter existente quando `connector === "whatsapp-cloud"`.

## Limites

- **NAO** implementar envio de mensagens interativas (botoes, listas) neste PRP
- **NAO** migrar dados do conector `evolution` — operadores escolhem qual usar
- **NAO** implementar gestao de templates (aprovacao na Meta) — tool apenas envia templates ja aprovados

## Dependencias

- **PRP-12** (Sistema de Conectores / GUI Adapters — PRP-21 sprint 4) deve estar implementado
- Infra Docker do backbone deve estar rodando (para testar webhook)

## Validacao

- [ ] GET de verificacao responde `hub.challenge` corretamente quando `hub.verify_token` bater
- [ ] POST de evento Meta com `X-Hub-Signature-256` valida cria/continua sessao de conversa
- [ ] Mensagem do usuario e passada ao agente e resposta enviada via Graph API
- [ ] POST com assinatura invalida retorna 401 sem processar
- [ ] Tool `send_whatsapp_text` envia mensagem de texto com sucesso
- [ ] Tool `send_whatsapp_template` envia template aprovado
- [ ] Conector `whatsapp-cloud` coexiste com `evolution` sem conflito de rotas
- [ ] ADAPTER.yaml suporta interpolacao `${ENV_VAR}` em todos os campos sensiveis
- [ ] GUI exibe URL do webhook apos criacao do adapter
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-104 Estrutura + client + schemas | S-027 sec 2, 3 | D-041 |
| F-105 Routes + channel-adapter | S-027 sec 4.1-4.2 | D-041, G-042 |
| F-106 Tools send-text/template/media | S-027 sec 5 | G-042 |
| F-107 GUI Hub URL do webhook | S-027 sec 6 | G-042 |
