# S-096 — Flag `disableDisplayTools` no ai-sdk

Adicionar flag condicional para desabilitar display tools no ai-sdk, permitindo que o backbone controle se as tools são carregadas com base no contexto do cliente.

**Resolve:** D-002 (Adicionar disableDisplayTools em AiAgentOptions e agent.ts)
**Score de prioridade:** 9
**Dependência:** Nenhuma — pode rodar em paralelo com S-095, S-097, S-099
**PRP:** 23 — Rich Response: Display Domain Tools + Ativação por Cliente

---

## 1. Objetivo

Hoje `createDisplayTools()` é chamado incondicionalmente em `agent.ts` linha 145, e as display tools são sempre mergeadas no objeto de tools. Quando o cliente não suporta conteúdo rico (WhatsApp, voice, ou qualquer chat sem `rich=true`), essas tools ocupam tokens desnecessariamente.

Esta spec adiciona `disableDisplayTools?: boolean` ao `AiAgentOptions`. Quando `true`, as display tools não são incluídas no merge de tools.

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/types.ts`

Adicionar campo à interface `AiAgentOptions`:

```typescript
export interface AiAgentOptions {
  // ...campos existentes...

  /** Desabilita display tools (rich content). Default: false (display tools habilitadas). */
  disableDisplayTools?: boolean;
}
```

**Posição:** após o campo `repairToolCalls` / `maxRepairAttempts`, antes de `reasoning`.

### 2.2 Arquivo: `apps/packages/ai-sdk/src/agent.ts`

Alterar a linha 145-146 para condicionar o carregamento:

**Antes:**
```typescript
const displayTools = createDisplayTools();
let tools = { ...mcpTools, ...codingTools, ...displayTools, ...dangerousTools };
```

**Depois:**
```typescript
const displayTools = options.disableDisplayTools ? {} : createDisplayTools();
let tools = { ...mcpTools, ...codingTools, ...displayTools, ...dangerousTools };
```

Apenas a primeira linha muda. O restante do merge permanece idêntico.

---

## 3. Regras de Implementação

- O default é `false` (display tools habilitadas) — retrocompatível, nenhum caller existente quebra
- NÃO alterar a assinatura de `createDisplayTools()` — ela continua sem parâmetros
- NÃO remover o import de `createDisplayTools` — ele é usado condicionalmente

---

## 4. Critérios de Aceite

- [ ] `AiAgentOptions` em `types.ts` tem o campo `disableDisplayTools?: boolean`
- [ ] `agent.ts` condiciona o carregamento: `options.disableDisplayTools ? {} : createDisplayTools()`
- [ ] Sem `disableDisplayTools` passado (undefined/false), display tools são carregadas normalmente
- [ ] Com `disableDisplayTools: true`, nenhuma display tool é incluída no merge
- [ ] Build do ai-sdk compila sem erros
