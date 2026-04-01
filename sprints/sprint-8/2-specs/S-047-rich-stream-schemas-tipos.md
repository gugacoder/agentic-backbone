# S-047 — Rich Stream: Schemas e Tipos

Adicionar os 3 novos tipos de evento (`reasoning`, `tool-call`, `tool-result`) aos schemas Zod e tipos TypeScript do ai-sdk, além do campo `reasoning` em `AiAgentOptions` para ativação de extended thinking.

**Resolve:** RS-001 (AgentEventSchema sem novos tipos), RS-002 (AiAgentEvent sem novos tipos), RS-003 (AiAgentOptions sem campo reasoning)
**Score de prioridade:** 9
**Dependência:** Nenhuma — prerequisite de S-048 e S-049
**PRP:** 13 — Rich Stream

---

## 1. Objetivo

- Declarar `reasoning`, `tool-call` e `tool-result` no `AgentEventSchema` (Zod) para validação em boundaries públicas
- Declarar os mesmos 3 tipos no `AiAgentEvent` (TypeScript) para tipagem no generator
- Adicionar campo `reasoning?: boolean | { budgetTokens: number }` ao `AiAgentOptions` para controle opt-in de extended thinking por agente
- Garantir backward compatibility — clientes que só tratam `text`/`result` continuam funcionando

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/schemas.ts`

Adicionar 3 novos membros ao `AgentEventSchema` (discriminated union):

```typescript
// Novos — rich stream
z.object({
  type: z.literal("reasoning"),
  content: z.string(),
}),
z.object({
  type: z.literal("tool-call"),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
}),
z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
}),
```

Campos seguem exatamente os nomes do Vercel AI SDK `fullStream` para evitar mapeamento.

### 2.2 Arquivo: `apps/packages/ai-sdk/src/types.ts`

Adicionar ao type union `AiAgentEvent`:

```typescript
| { type: "reasoning"; content: string }
| { type: "tool-call"; toolCallId: string; toolName: string; args: Record<string, unknown> }
| { type: "tool-result"; toolCallId: string; toolName: string; result: unknown }
```

### 2.3 Arquivo: `apps/packages/ai-sdk/src/types.ts`

Adicionar campo ao `AiAgentOptions`:

```typescript
/** Habilita extended thinking/reasoning no stream. Default: false */
reasoning?: boolean | { budgetTokens: number };
```

Quando `true`, usa budget padrão (ex: 5000 tokens). Quando objeto, usa o `budgetTokens` especificado. Quando `false` ou omitido, reasoning não é ativado.

---

## 3. Regras de Implementação

- **Não alterar tipos existentes** — apenas adicionar novos membros às unions
- **Não alterar nenhum outro arquivo** — esta spec cobre apenas schemas e tipos
- Os nomes dos campos (`toolCallId`, `toolName`, `args`, `result`) devem ser idênticos aos do Vercel AI SDK para zero-mapping
- O campo `reasoning` em `AiAgentOptions` é opt-in — default é desativado

---

## 4. Critérios de Aceite

- [ ] `AgentEventSchema` aceita objetos com `type: "reasoning"`, `type: "tool-call"` e `type: "tool-result"` sem erro de validação Zod
- [ ] `AiAgentEvent` permite yield tipado de `{ type: "reasoning", content: "..." }` sem erro TypeScript
- [ ] `AiAgentEvent` permite yield tipado de `{ type: "tool-call", toolCallId, toolName, args }` sem erro TypeScript
- [ ] `AiAgentEvent` permite yield tipado de `{ type: "tool-result", toolCallId, toolName, result }` sem erro TypeScript
- [ ] `AiAgentOptions` aceita `reasoning: true`, `reasoning: { budgetTokens: 8000 }` e `reasoning: undefined` sem erro TypeScript
- [ ] Typecheck passa: `npm run build:packages` compila sem erros
- [ ] Clientes existentes que tratam apenas `text`/`result` continuam funcionando (backward compatible)
