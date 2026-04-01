# S-099 — ai-chat: `enableRichContent` no useBackboneChat

Adicionar opção `enableRichContent` ao hook `useBackboneChat` para que o ai-chat envie `?rich=true` automaticamente ao backbone, ativando display tools e prompt de rich content.

**Resolve:** D-009 (useBackboneChat enableRichContent)
**Score de prioridade:** 7
**Dependência:** Nenhuma — pode rodar em paralelo com S-095, S-096, S-097
**PRP:** 23 — Rich Response: Display Domain Tools + Ativação por Cliente

---

## 1. Objetivo

O hook `useBackboneChat` constrói a URL de API como:
```
${endpoint}/api/v1/ai/conversations/${sessionId}/messages?format=datastream
```

Para ativar rich content, o ai-chat precisa enviar `&rich=true` nesta URL. A opção `enableRichContent` (default `true`) controla isso. Consumidores que não suportam rich content passam `enableRichContent: false`.

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/hooks/useBackboneChat.ts`

#### 2.1.1 Interface `UseBackboneChatOptions`

Adicionar campo:

**Antes:**
```typescript
export interface UseBackboneChatOptions {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Message[];
}
```

**Depois:**
```typescript
export interface UseBackboneChatOptions {
  endpoint: string;
  token: string;
  sessionId: string;
  initialMessages?: Message[];
  /** Habilita rich content (display tools). Default: true */
  enableRichContent?: boolean;
}
```

#### 2.1.2 Construção da URL

Na construção da URL do `useChat` (linha ~32):

**Antes:**
```typescript
api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream`,
```

**Depois:**
```typescript
api: `${options.endpoint}/api/v1/ai/conversations/${options.sessionId}/messages?format=datastream${options.enableRichContent !== false ? "&rich=true" : ""}`,
```

A lógica `!== false` garante que o default é `true` — se o campo não for passado (undefined), rich content é habilitado.

---

## 3. Regras de Implementação

- Default é `true` — rich content habilitado por padrão no ai-chat
- A URL só recebe `&rich=true` quando o flag é `true` ou `undefined` — quando `false`, o param não é enviado
- NÃO adicionar lógica de ativação em outros hooks (useSSE, etc.) — apenas `useBackboneChat` é o caller
- NÃO alterar o `buildAttachmentUrl` — ele não precisa do param `rich`

---

## 4. Critérios de Aceite

- [ ] `UseBackboneChatOptions` tem campo `enableRichContent?: boolean`
- [ ] URL inclui `&rich=true` quando `enableRichContent` é `true` ou `undefined`
- [ ] URL NÃO inclui `&rich=true` quando `enableRichContent` é `false`
- [ ] Nenhum caller existente de `useBackboneChat` quebra (campo é opcional, default true)
- [ ] Build do ai-chat compila sem erros
