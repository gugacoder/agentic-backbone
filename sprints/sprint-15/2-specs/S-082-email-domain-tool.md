# S-082 — Email Domain Tool

Criar 1 domain tool unificada que agrupa as 11 tools individuais do connector Email em 10 actions via `z.discriminatedUnion("action", [...])`.

**Resolve:** D-003 (Email domain tool), D-012 (policy check readonly)
**Score de prioridade:** 8
**Dependencia:** Nenhuma — fase 1c da ordem de execução (paralela com S-080 e S-081)
**PRP:** 18 — Domain Tools: Agrupamento de Tools por Domínio

---

## 1. Objetivo

Consolidar 11 tools individuais de email em 1 domain tool `email` com 10 actions. Conforme decisão no TASK.md, usar 1 tool unificada (não 2) — email não tem volume suficiente para justificar separação.

---

## 2. Alteração — 1 Arquivo Novo

### 2.1 Arquivo: `apps/backbone/src/connectors/email/tools/email.ts` (NOVO)

**Tool name:** `email`
**Actions:** send, search, read, download_attachment, manage_flags, move, delete, list_mailboxes, draft_create, draft_send (10 actions)
**Substitui:** send.ts, search.ts, read.ts, download-attachment.ts, manage-flags.ts, move.ts, delete.ts, list-mailboxes.ts, draft-create.ts, draft-send.ts

```typescript
export function createEmailTool(slugs: [string, ...string[]]) {
  return {
    email: tool({
      description: "Gerencia email (IMAP/SMTP). Ações: send, search, read, download_attachment, manage_flags, move, delete, list_mailboxes, draft_create, draft_send.",
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter de email"),
      })),
      execute: async (args) => { /* dispatch por action */ },
    }),
  };
}
```

Parâmetros por action (copiar dos arquivos individuais):
- `send`: to, subject, body, html?, cc?, bcc?, in_reply_to?, references?, attachments?
- `search`: query (IMAP search string), mailbox?, limit?
- `read`: uid (número), mailbox?
- `download_attachment`: uid, mailbox?, part_id
- `manage_flags`: uid, mailbox?, flags (array), action (add|remove)
- `move`: uid, from_mailbox?, to_mailbox
- `delete`: uid, mailbox?
- `list_mailboxes`: (sem parâmetros adicionais)
- `draft_create`: to, subject, body, html?, cc?, bcc?
- `draft_send`: uid (UID do draft na mailbox Drafts)

---

## 3. Regras de Implementação

- **Copiar parâmetros Zod dos arquivos individuais** — mesmos campos, tipos, defaults
- **`adapter` é o campo comum** via `.and()` — opcional, default no primeiro slug
- **Client creation**: cada action precisa criar o client IMAP/SMTP conforme o pattern existente (parsear credential e options do adapter, importar `createEmailClient`)
- **Policy check**: ações de escrita (send, move, delete, manage_flags, draft_create, draft_send) devem verificar policy readonly
- **`formatError`** no catch genérico

---

## 4. Critérios de Aceite

- [ ] Arquivo `apps/backbone/src/connectors/email/tools/email.ts` criado
- [ ] Exporta `createEmailTool(slugs)` retornando `Record<string, any>` com key `email`
- [ ] 10 actions cobrindo todas as funcionalidades dos 10 arquivos individuais + 1 index
- [ ] Schemas Zod idênticos aos dos arquivos individuais
- [ ] Policy check readonly para ações de escrita
- [ ] TypeScript compila sem erros
