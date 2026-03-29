# PRP — Ai: Tool Approval via needsApproval

Implementar suporte a `needsApproval` do Vercel AI SDK na ai-sdk, permitindo que tools sensíveis (Bash, Write, Edit) exijam aprovacao do consumidor antes de executar.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Todas as tools da ai-sdk executam imediatamente quando o modelo as chama. Nao ha mecanismo de aprovacao:

```typescript
// tools/bash.ts
export const bashTool = tool({
  description: "Executes a bash command...",
  parameters: z.object({ command: z.string(), timeout: z.number().optional() }),
  execute: async ({ command, timeout }) => {
    // executa direto — sem aprovacao
  },
});
```

O backbone tem dois modos de uso:

| Modo | Contexto | Aprovacao necessaria? |
|---|---|---|
| Heartbeat | Autonomo, sem humano | Nao — deve executar direto |
| Conversa | Interativo, humano presente | Sim — tools destrutivas devem pedir permissao |

Hoje nao ha como distinguir. O consumidor interativo (conversa) nao tem como interceptar tool calls antes da execucao.

O Vercel AI SDK v4 oferece `needsApproval` no `tool()`:

```typescript
tool({
  needsApproval: async (params) => true, // pausa e pede aprovacao
  execute: async (params) => { ... },     // executa so apos aprovacao
});
```

### Estado desejado

1. O consumidor passa `autoApprove: true` para bypass (heartbeat) ou `autoApprove: false` para exigir aprovacao (conversa)
2. Tools sensíveis (Bash, Write, Edit) consultam essa flag via `needsApproval`
3. Quando aprovacao eh necessaria, a ai-sdk emite evento `tool_approval` para o consumidor decidir
4. O consumidor responde via callback `onToolApproval`

## Especificacao

### 1. Nova opcao em AiAgentOptions

```typescript
// types.ts
export interface ToolApprovalRequest {
  /** Nome da tool */
  toolName: string;
  /** Parametros que o modelo quer passar */
  params: Record<string, unknown>;
}

export interface AiAgentOptions {
  // ...existentes...

  /** Se true, tools sensíveis executam sem pedir aprovacao. Default: true (backward compat). */
  autoApprove?: boolean;

  /** Callback invocado quando uma tool precisa de aprovacao. Retorna true para aprovar, false para rejeitar. */
  onToolApproval?: (request: ToolApprovalRequest) => Promise<boolean>;
}
```

O default de `autoApprove` eh `true` para nao quebrar consumidores existentes (heartbeat, testes).

### 2. Refatorar tools sensíveis para factories

As tres tools sensíveis passam de constantes para factories que recebem a flag:

```typescript
// tools/bash.ts
export function createBashTool(opts?: { autoApprove?: boolean }) {
  const shouldApprove = opts?.autoApprove === false;

  return tool({
    description: "Executes a bash command...",
    parameters: z.object({
      command: z.string().describe("The bash command to execute"),
      timeout: z.number().optional().describe("Timeout in milliseconds (max 600000)"),
    }),
    needsApproval: shouldApprove ? async () => true : undefined,
    execute: async ({ command, timeout }) => {
      // implementacao existente — nao muda
    },
  });
}

// Backward compat: export const para quem importa direto
export const bashTool = createBashTool();
```

Mesmo pattern para `write.ts` e `edit.ts`.

### 3. Tools que precisam de aprovacao

| Tool | Risco | needsApproval |
|---|---|---|
| **Bash** | Executa comandos arbitrarios | Sim |
| **Write** | Sobrescreve arquivos | Sim |
| **Edit** | Modifica arquivos | Sim |
| **MultiEdit** | Modifica multiplos arquivos | Sim |
| **ApplyPatch** | Aplica diffs | Sim |
| Read | Leitura apenas | Nao |
| Glob | Leitura apenas | Nao |
| Grep | Leitura apenas | Nao |
| ListDir | Leitura apenas | Nao |
| WebFetch | Leitura apenas | Nao |
| TodoWrite/Read | Interno | Nao |
| Diagnostics | Leitura apenas | Nao |

### 4. Montagem no agent.ts

```typescript
// agent.ts — na montagem de tools
const autoApprove = options.autoApprove ?? true; // default: bypass

const dangerousTools = {
  Bash: createBashTool({ autoApprove }),
  Write: createWriteTool({ autoApprove }),
  Edit: createEditTool({ autoApprove }),
  MultiEdit: createMultiEditTool({ autoApprove }),
  ApplyPatch: createApplyPatchTool({ autoApprove }),
};

let tools = { ...mcpTools, ...codingTools, ...dangerousTools };
```

### 5. Novo evento: tool_approval

```typescript
// types.ts
export type AiAgentEvent =
  | // ...existentes...
  | { type: "tool_approval"; toolName: string; params: Record<string, unknown>; approved: boolean };
```

Quando `needsApproval` retorna `true`, o Vercel AI SDK pausa a execucao. O `onToolApproval` callback eh chamado. O resultado eh emitido como evento para visibilidade.

### 6. Uso pelo consumidor

```typescript
// Heartbeat — autonomo
runAiAgent(prompt, {
  autoApprove: true, // default — tudo executa direto
});

// Conversa — interativo
runAiAgent(prompt, {
  autoApprove: false,
  onToolApproval: async ({ toolName, params }) => {
    // Perguntar ao usuario via chat/UI
    const answer = await askUserForApproval(toolName, params);
    return answer === "yes";
  },
});
```

## Limites

- **NAO** alterar a logica interna das tools (implementacao de Bash, Write, Edit) — apenas adicionar `needsApproval`
- **NAO** adicionar dependencias
- **NAO** quebrar backward compat — `autoApprove` default `true` garante que tudo funciona como antes
- **NAO** aplicar `needsApproval` em tools de leitura (Read, Glob, Grep)
- **NAO** bloquear execucao se `onToolApproval` nao for fornecido com `autoApprove: false` — nesse caso, aprovar automaticamente e emitir warning

## Validacao

- [ ] `runAiAgent()` sem `autoApprove` se comporta identicamente ao antes (tudo executa direto)
- [ ] `autoApprove: false` com `onToolApproval` pausa Bash/Write/Edit e chama o callback
- [ ] `onToolApproval` retornando `false` impede execucao da tool
- [ ] `onToolApproval` retornando `true` permite execucao normal
- [ ] Tools de leitura (Read, Glob, Grep) nunca pedem aprovacao
- [ ] Evento `tool_approval` emitido com resultado
- [ ] `autoApprove: false` sem `onToolApproval` aprova automaticamente com warning no console
- [ ] `npm run build --workspace=packages/ai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Novos tipos | `packages/ai-sdk/src/types.ts` |
| Factory Bash | `packages/ai-sdk/src/tools/bash.ts` |
| Factory Write | `packages/ai-sdk/src/tools/write.ts` |
| Factory Edit | `packages/ai-sdk/src/tools/edit.ts` |
| Factory MultiEdit | `packages/ai-sdk/src/tools/multi-edit.ts` |
| Factory ApplyPatch | `packages/ai-sdk/src/tools/apply-patch.ts` |
| Montagem no agente | `packages/ai-sdk/src/agent.ts` |
| Registry de tools | `packages/ai-sdk/src/tools/index.ts` |
| Exports | `packages/ai-sdk/src/index.ts` |
