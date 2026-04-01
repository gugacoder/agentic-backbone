# PRP-18C — Email Domain Tool

Criar 1 domain tool unificada que agrupa as 11 tools individuais do connector Email em 10 actions via `z.discriminatedUnion("action", [...])`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O connector Email tem 10 tool files individuais em `apps/backbone/src/connectors/email/tools/`: send.ts, search.ts, read.ts, download-attachment.ts, manage-flags.ts, move.ts, delete.ts, list-mailboxes.ts, draft-create.ts, draft-send.ts + index.ts.

### Estado desejado

1 arquivo `email.ts` com 10 actions cobrindo toda a funcionalidade. Decisao do TASK.md: usar 1 tool unificada (nao 2) — email nao tem volume suficiente para justificar separacao.

### Dependencias

- **Nenhuma** — fase 1c da ordem de execucao, independente de S-080 e S-081

## Especificacao

### Feature F-314: Domain tool `email` (email.ts)

**Spec:** S-082 secao 2.1

Criar `apps/backbone/src/connectors/email/tools/email.ts`.

**Tool name:** `email`
**Actions (10):** send, search, read, download_attachment, manage_flags, move, delete, list_mailboxes, draft_create, draft_send

```typescript
export function createEmailTool(slugs: [string, ...string[]]) {
  return {
    email: tool({
      description: "Gerencia email (IMAP/SMTP). Acoes: send, search, read, download_attachment, manage_flags, move, delete, list_mailboxes, draft_create, draft_send.",
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter de email"),
      })),
      execute: async (args) => { /* dispatch por action */ },
    }),
  };
}
```

Parametros por action (copiar dos arquivos individuais):
- `send`: to, subject, body, html?, cc?, bcc?, in_reply_to?, references?, attachments?
- `search`: query (IMAP search string), mailbox?, limit?
- `read`: uid (numero), mailbox?
- `download_attachment`: uid, mailbox?, part_id
- `manage_flags`: uid, mailbox?, flags (array), action (add|remove)
- `move`: uid, from_mailbox?, to_mailbox
- `delete`: uid, mailbox?
- `list_mailboxes`: (sem parametros adicionais)
- `draft_create`: to, subject, body, html?, cc?, bcc?
- `draft_send`: uid (UID do draft na mailbox Drafts)

**Acoes readonly:** send, move, delete, manage_flags, draft_create, draft_send

#### Regras

- Client creation: cada action cria o client IMAP/SMTP conforme pattern existente (parsear credential e options do adapter, importar `createEmailClient`)
- Policy check para acoes de escrita
- `formatError` no catch generico

## Limites

- **NAO** alterar os tool files individuais existentes — serao removidos no PRP-18F
- **NAO** alterar `email/tools/index.ts` — sera feito no PRP-18D
- **NAO** inventar schemas novos — copiar dos arquivos individuais

## Validacao

- [ ] Arquivo `apps/backbone/src/connectors/email/tools/email.ts` criado
- [ ] Exporta `createEmailTool(slugs)` retornando `Record<string, any>` com key `email`
- [ ] 10 actions cobrindo todas as funcionalidades dos 10 arquivos individuais
- [ ] Schemas Zod identicos aos dos arquivos individuais
- [ ] Policy check readonly para acoes de escrita
- [ ] TypeScript compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-314 email | S-082 | D-003, D-011, D-012 |
