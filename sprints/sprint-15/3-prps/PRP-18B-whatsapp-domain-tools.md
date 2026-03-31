# PRP-18B — WhatsApp Domain Tools

Criar 4 domain tools que agrupam as 37 tools individuais do WhatsApp/Evolution em dominios logicos via `z.discriminatedUnion("action", [...])`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O connector Evolution tem 35 arquivos `whatsapp-*.ts` + 1 `evolution-api.ts` em `apps/backbone/src/connectors/evolution/tools/`. O `tools/index.ts` exporta todas individualmente via `createEvolutionTools(slugs)`.

### Estado desejado

4 arquivos de domain tools: messaging.ts (13 actions), groups.ts (11 actions), contacts.ts (7 actions), admin.ts (5 actions incluindo api_raw). Total de actions = 36.

### Dependencias

- **Nenhuma** — fase 1b da ordem de execucao, independente de S-080 e S-082

## Especificacao

### Pattern

Mesmo pattern de PRP-18A (discriminated union + dispatch), com diferenca:
- O campo comum eh `instance` (nao `adapter`) — mantem nomenclatura existente do connector Evolution
- Slugs vem como `[string, ...string[]]` (mesmo pattern do `createEvolutionTools` atual)

```typescript
export function createWhatsappMessagingTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_messaging: tool({
      description: "Envia mensagens via WhatsApp. Acoes: send_text, send_media, ...",
      parameters: paramsSchema.and(z.object({
        instance: z.enum(slugs).optional().describe("Instancia WhatsApp"),
      })),
      execute: async (args) => {
        const { connectorRegistry } = await import("../../index.js");
        const client = connectorRegistry.createClient(args.instance ?? slugs[0]);
        // dispatch por args.action
      },
    }),
  };
}
```

### Feature F-310: Domain tool `whatsapp_messaging` (messaging.ts)

**Spec:** S-081 secao 3.1

Criar `apps/backbone/src/connectors/evolution/tools/messaging.ts`.

**Tool name:** `whatsapp_messaging`
**Actions (13):** send_text, send_media, send_audio, send_location, send_contact, send_reaction, send_poll, send_sticker, send_list, send_buttons, delete_message, mark_as_read, send_presence

Parametros por action (copiar dos arquivos individuais):
- `send_text`: number, text, delay?, linkPreview?, mentionsEveryOne?, mentioned?
- `send_media`: number, mediatype (image|video|document), media (URL ou base64), caption?, fileName?
- `send_audio`: number, audio (URL ou base64)
- `send_location`: number, latitude, longitude, name?, address?
- `send_contact`: number, contact (nome + numero)
- `send_reaction`: number, key (messageId), reaction (emoji ou vazio para remover)
- `send_poll`: number, name, values (opcoes), selectableCount?
- `send_sticker`: number, sticker (URL ou base64)
- `send_list`: number, title, description, buttonText, footerText?, sections
- `send_buttons`: number, title, description?, buttons, footerText?
- `delete_message`: number, messageId, fromMe?
- `mark_as_read`: number, messageId
- `send_presence`: number, presence (composing|recording|paused)

### Feature F-311: Domain tool `whatsapp_groups` (groups.ts)

**Spec:** S-081 secao 3.2

Criar `apps/backbone/src/connectors/evolution/tools/groups.ts`.

**Tool name:** `whatsapp_groups`
**Actions (11):** create, list, info, participants, invite_code, send_invite, update_participant, update_setting, update_subject, update_description, leave

### Feature F-312: Domain tool `whatsapp_contacts` (contacts.ts)

**Spec:** S-081 secao 3.3

Criar `apps/backbone/src/connectors/evolution/tools/contacts.ts`.

**Tool name:** `whatsapp_contacts`
**Actions (7):** check_numbers, find_contacts, find_messages, find_chats, fetch_profile, block, archive_chat

### Feature F-313: Domain tool `whatsapp_admin` (admin.ts)

**Spec:** S-081 secao 3.4

Criar `apps/backbone/src/connectors/evolution/tools/admin.ts`.

**Tool name:** `whatsapp_admin`
**Actions (5):** connection_state, list_instances, list_labels, handle_label, api_raw

A action `api_raw` absorve a funcionalidade do `evolution-api.ts` (fallback generico para qualquer endpoint da Evolution API):
- Parametros: method (GET|POST|PUT|DELETE), endpoint (string), body? (objeto JSON)

## Limites

- **NAO** alterar os tool files individuais existentes — serao removidos no PRP-18F
- **NAO** alterar `evolution/tools/index.ts` — sera feito no PRP-18D
- **NAO** inventar schemas novos — copiar parametros Zod dos arquivos individuais
- **NAO** alterar `ConnectorDef.createTools()`

## Validacao

- [ ] 4 arquivos novos em `apps/backbone/src/connectors/evolution/tools/`: messaging.ts, groups.ts, contacts.ts, admin.ts
- [ ] Cada arquivo exporta factory function `createWhatsapp{Domain}Tool(slugs)` retornando `Record<string, any>`
- [ ] Total de actions nas 4 domain tools = 36 (35 whatsapp-*.ts + 1 evolution-api.ts)
- [ ] `whatsapp_api_raw` migrado para action `api_raw` dentro de `whatsapp_admin`
- [ ] Schemas Zod identicos aos dos arquivos individuais
- [ ] TypeScript compila sem erros nos novos arquivos

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-310 whatsapp_messaging | S-081 | D-002, D-011 |
| F-311 whatsapp_groups | S-081 | D-002, D-011 |
| F-312 whatsapp_contacts | S-081 | D-002, D-011 |
| F-313 whatsapp_admin | S-081 | D-002, D-011 |
