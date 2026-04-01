# S-081 — WhatsApp Domain Tools

Criar 4 domain tools que agrupam as 37 tools individuais do WhatsApp/Evolution em domínios lógicos via `z.discriminatedUnion("action", [...])`.

**Resolve:** D-002 (WhatsApp domain tools), D-012 (policy check readonly)
**Score de prioridade:** 9
**Dependencia:** Nenhuma — fase 1b da ordem de execução (paralela com S-080 e S-082)
**PRP:** 18 — Domain Tools: Agrupamento de Tools por Domínio

---

## 1. Objetivo

Reduzir 37 tools individuais do WhatsApp (connector Evolution) para 4 domain tools. Inclui migração do `evolution-api.ts` (fallback genérico) para action `api_raw` dentro de `whatsapp_admin`.

---

## 2. Pattern

Mesmo pattern de S-080 (discriminated union + dispatch), com diferença:
- O campo comum é `instance` (não `adapter`) — mantém nomenclatura existente do connector Evolution
- Slugs vêm como `[string, ...string[]]` (mesmo pattern do `createEvolutionTools` atual)

```typescript
export function createWhatsappMessagingTool(slugs: [string, ...string[]]) {
  return {
    whatsapp_messaging: tool({
      description: "Envia mensagens via WhatsApp. Ações: send_text, send_media, ...",
      parameters: paramsSchema.and(z.object({
        instance: z.enum(slugs).optional().describe("Instância WhatsApp"),
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

---

## 3. Alterações — 4 Arquivos Novos

### 3.1 Arquivo: `apps/backbone/src/connectors/evolution/tools/messaging.ts` (NOVO)

**Tool name:** `whatsapp_messaging`
**Actions:** send_text, send_media, send_audio, send_location, send_contact, send_reaction, send_poll, send_sticker, send_list, send_buttons, delete_message, mark_as_read, send_presence (13 actions)
**Substitui:** whatsapp-send-text.ts, whatsapp-send-media.ts, whatsapp-send-audio.ts, whatsapp-send-location.ts, whatsapp-send-contact.ts, whatsapp-send-reaction.ts, whatsapp-send-poll.ts, whatsapp-send-sticker.ts, whatsapp-send-list.ts, whatsapp-send-buttons.ts, whatsapp-delete-message.ts, whatsapp-mark-as-read.ts, whatsapp-send-presence.ts

Parâmetros por action (copiar dos arquivos individuais):
- `send_text`: number, text, delay?, linkPreview?, mentionsEveryOne?, mentioned?
- `send_media`: number, mediatype (image|video|document), media (URL ou base64), caption?, fileName?
- `send_audio`: number, audio (URL ou base64)
- `send_location`: number, latitude, longitude, name?, address?
- `send_contact`: number, contact (nome + número)
- `send_reaction`: number, key (messageId), reaction (emoji ou vazio para remover)
- `send_poll`: number, name, values (opções), selectableCount?
- `send_sticker`: number, sticker (URL ou base64)
- `send_list`: number, title, description, buttonText, footerText?, sections
- `send_buttons`: number, title, description?, buttons, footerText?
- `delete_message`: number, messageId, fromMe?
- `mark_as_read`: number, messageId
- `send_presence`: number, presence (composing|recording|paused)

### 3.2 Arquivo: `apps/backbone/src/connectors/evolution/tools/groups.ts` (NOVO)

**Tool name:** `whatsapp_groups`
**Actions:** create, list, info, participants, invite_code, send_invite, update_participant, update_setting, update_subject, update_description, leave (11 actions)
**Substitui:** whatsapp-create-group.ts, whatsapp-list-groups.ts, whatsapp-group-info.ts, whatsapp-group-participants.ts, whatsapp-group-invite-code.ts, whatsapp-send-group-invite.ts, whatsapp-update-group-participant.ts, whatsapp-update-group-setting.ts, whatsapp-update-group-subject.ts, whatsapp-update-group-description.ts, whatsapp-leave-group.ts

### 3.3 Arquivo: `apps/backbone/src/connectors/evolution/tools/contacts.ts` (NOVO)

**Tool name:** `whatsapp_contacts`
**Actions:** check_numbers, find_contacts, find_messages, find_chats, fetch_profile, block, archive_chat (7 actions)
**Substitui:** whatsapp-check-numbers.ts, whatsapp-find-contacts.ts, whatsapp-find-messages.ts, whatsapp-find-chats.ts, whatsapp-fetch-profile.ts, whatsapp-block.ts, whatsapp-archive-chat.ts

### 3.4 Arquivo: `apps/backbone/src/connectors/evolution/tools/admin.ts` (NOVO)

**Tool name:** `whatsapp_admin`
**Actions:** connection_state, list_instances, list_labels, handle_label, api_raw (5 actions)
**Substitui:** whatsapp-connection-state.ts, whatsapp-list-instances.ts, whatsapp-list-labels.ts, whatsapp-handle-label.ts, evolution-api.ts

A action `api_raw` absorve a funcionalidade do `evolution-api.ts` (fallback genérico para qualquer endpoint da Evolution API):
- Parâmetros: method (GET|POST|PUT|DELETE), endpoint (string), body? (objeto JSON)

---

## 4. Regras de Implementação

- **Copiar parâmetros Zod dos arquivos individuais existentes** — não inventar schemas
- **`instance` é o campo comum** (não `adapter`) — mantém nomenclatura do connector Evolution
- **`description` lista todas as ações** para orientar o modelo
- **Policy check**: o connector Evolution atualmente não tem policy readonly nos tools individuais. Se adapters tiverem policy readonly, ações de envio/escrita devem respeitar. Verificar se o `createEvolutionTools` atual já recebe policy
- **`formatError`** no catch genérico
- **Client creation**: usar `connectorRegistry.createClient(instance)` — mesmo pattern dos tools atuais

---

## 5. Critérios de Aceite

- [ ] 4 arquivos novos em `apps/backbone/src/connectors/evolution/tools/`: messaging.ts, groups.ts, contacts.ts, admin.ts
- [ ] Cada arquivo exporta factory function `createWhatsapp{Domain}Tool(slugs)` retornando `Record<string, any>`
- [ ] Total de actions nas 4 domain tools = 36 (35 whatsapp-*.ts + 1 evolution-api.ts)
- [ ] `whatsapp_api_raw` migrado para action `api_raw` dentro de `whatsapp_admin`
- [ ] Schemas Zod idênticos aos dos arquivos individuais
- [ ] TypeScript compila sem erros nos novos arquivos
