# S-027 — Conector WhatsApp Cloud API (Meta Oficial)

Novo conector nativo para WhatsApp via Meta Cloud API oficial, substituindo a Evolution API nao-oficial como opcao de canal de primeiro nivel, eliminando risco de banimento.

**Resolve:** D-041 (risco de banimento via Evolution), G-042 (WhatsApp Cloud API sem risco)
**Score de prioridade:** 9

---

## 1. Objetivo

- Implementar conector `whatsapp-cloud` usando a Meta Cloud API oficial (Graph API v19+)
- Receber mensagens via webhook oficial do Meta (verificacao com token + validacao de payload)
- Enviar mensagens de texto, template e interativas via API
- Configuracao via GUI no Hub (ADAPTER.yaml), sem codigo
- Coexistir com o conector `evolution` ja existente — operadores escolhem qual usar

---

## 2. Arquitetura

O conector segue o padrao de conectores existentes (`src/connectors/{slug}/`):

```
src/connectors/whatsapp-cloud/
  index.ts              # ConnectorDef — factory, schemas, tools, routes, channel-adapter
  client.ts             # WhatsAppCloudClient (Graph API v19+)
  schemas.ts            # Zod schemas para ADAPTER.yaml credential/options
  channel-adapter.ts    # Adaptador de canal (inbound → conversa backbone)
  routes.ts             # Rotas Hono: GET /verify + POST /events (webhook Meta)
  tools/
    send-text.ts        # Tool: enviar mensagem de texto
    send-template.ts    # Tool: enviar mensagem de template
    get-media.ts        # Tool: baixar midia recebida
    index.ts            # createWhatsAppCloudTools()
```

---

## 3. Schema ADAPTER.yaml

```yaml
connector: whatsapp-cloud
credential:
  access_token: "${WCLOUD_ACCESS_TOKEN}"   # token permanente de sistema (Graph API)
  phone_number_id: "${WCLOUD_PHONE_ID}"    # ID do numero de telefone (Meta Business)
  webhook_verify_token: "${WCLOUD_VERIFY}" # token de verificacao do webhook
  business_account_id: "${WCLOUD_BAID}"   # WABA ID
options:
  api_version: "v19.0"                    # versao da Graph API
  auto_reply_read: true                   # marcar mensagens como lidas ao receber
policy: readwrite
```

---

## 4. API de Integracao (Meta Graph API)

### 4.1 Webhook de verificacao — GET `/connectors/whatsapp-cloud/:adapterId/webhook`

Meta envia GET com `hub.mode=subscribe`, `hub.challenge` e `hub.verify_token`.
Rota responde com `hub.challenge` se o token bater.

### 4.2 Webhook de eventos — POST `/connectors/whatsapp-cloud/:adapterId/webhook`

Meta envia POST com payload de mensagens recebidas. Backbone:
1. Valida assinatura `X-Hub-Signature-256` com `app_secret`
2. Extrai mensagens do payload
3. Roteia para `channel-adapter` → cria/continua sessao de conversa → executa agente

**Estrutura de payload Meta (simplificada):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511999999999",
          "text": { "body": "Ola!" },
          "timestamp": "1709800000",
          "id": "wamid.xxx"
        }]
      }
    }]
  }]
}
```

### 4.3 Envio de mensagem de texto

```
POST https://graph.facebook.com/v19.0/{phone_number_id}/messages
Authorization: Bearer {access_token}

{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "Resposta do agente" }
}
```

### 4.4 Envio de template

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": { "code": "pt_BR" },
    "components": []
  }
}
```

---

## 5. Ferramentas do Conector (Tools)

| Tool | Descricao |
|------|-----------|
| `send_whatsapp_text` | Envia mensagem de texto para numero |
| `send_whatsapp_template` | Envia template aprovado pela Meta |
| `get_whatsapp_media` | Baixa URL de midia recebida (imagem, audio, documento) |

---

## 6. Telas (Hub)

### 6.1 GUI de Adapter (ja existente — `/adapters`)

- O conector `whatsapp-cloud` aparece na lista de conectores disponiveis
- Formulario de criacao preenchido com os campos do schema (credential + options)
- Campo `access_token` mascarado (nao exibido apos salvar)
- Campo `webhook_verify_token` com botao "Copiar URL do webhook"

### 6.2 URL do Webhook exibida na GUI

Apos configurar adapter, exibir:
```
Webhook URL: https://seudominio.com/connectors/whatsapp-cloud/{adapterId}/webhook
```
Com instrucao: "Configure esta URL no Meta Business Manager > WhatsApp > Configuracao do Webhook"

---

## 7. Criterios de Aceite

- [ ] GET de verificacao do webhook Meta responde `hub.challenge` corretamente
- [ ] POST de evento Meta com assinatura valida cria/continua sessao de conversa
- [ ] Mensagem do usuario e passada como input ao agente e a resposta e enviada via Graph API
- [ ] POST com assinatura invalida retorna 401 (sem processar)
- [ ] Tool `send_whatsapp_text` envia mensagem de texto com sucesso
- [ ] Tool `send_whatsapp_template` envia template aprovado
- [ ] Conector `whatsapp-cloud` coexiste com `evolution` sem conflito
- [ ] ADAPTER.yaml suporta interpolacao de `${ENV_VAR}` para todos os campos sensiveis
- [ ] GUI exibe a URL do webhook apos criacao do adapter
