# S-070 — Registrar no Workspace + Instalar Deps

Registrar `@agentic-backbone/ai-chat` no npm workspace raiz e instalar todas as dependências.

**Resolve:** AC-015 (pacote não está no npm workspace)
**Score de prioridade:** 7
**Dependência:** S-056 (scaffold com package.json)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Garantir que `apps/packages/ai-chat` está coberto pelo array `workspaces` do `package.json` raiz
- Executar `npm install` para resolver todas as dependências declaradas no pacote
- Verificar que imports cross-workspace funcionam (`apps/hub` e `apps/chat` podem importar `@agentic-backbone/ai-chat`)

---

## 2. Alterações

### 2.1 Verificar: `package.json` raiz — array `workspaces`

O glob `"apps/packages/*"` já existe no workspace raiz. Confirmar que `apps/packages/ai-chat` é resolvido por ele. Se não (ex: por causa do glob `apps/packages/gitlab/v4`), adicionar explicitamente.

### 2.2 Executar: `npm install`

Instalar dependências do novo pacote. Verificar que `node_modules/@agentic-backbone/ai-chat` é um symlink para `apps/packages/ai-chat`.

### 2.3 Verificar: imports cross-workspace

Criar teste rápido (pode ser removido depois):
```typescript
// apps/hub/src/_test-ai-chat-import.ts (temporário)
import { Chat } from "@agentic-backbone/ai-chat";
```

Se o typecheck passar, o workspace está configurado corretamente.

### 2.4 Adicionar ao `apps/hub/package.json` e `apps/chat/package.json`

```json
"dependencies": {
  "@agentic-backbone/ai-chat": "*"
}
```

---

## 3. Regras de Implementação

- **Não alterar versões de deps existentes** — apenas adicionar o novo pacote
- **Glob vs explícito** — preferir que o glob cubra, adicionar explicitamente só se necessário
- **Remover arquivo de teste** após validação

---

## 4. Critérios de Aceite

- [ ] `npm ls @agentic-backbone/ai-chat` mostra o pacote resolvido no workspace
- [ ] `node_modules/@agentic-backbone/ai-chat` é symlink para `apps/packages/ai-chat`
- [ ] `apps/hub` pode importar `@agentic-backbone/ai-chat` sem erro de resolução
- [ ] `apps/chat` pode importar `@agentic-backbone/ai-chat` sem erro de resolução
- [ ] `npm install` completa sem erros
