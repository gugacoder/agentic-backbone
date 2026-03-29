# S-051 — Display Tools: Criação e Registro no Agente

Criar as 19 display tools como Vercel AI SDK `tool()` e registrá-las no `allTools` do agente para que o modelo possa emitir conteúdo estruturado.

**Resolve:** RC-002 (tools/display.ts não existe), RC-003 (agent.ts não registra display tools)
**Score de prioridade:** 9
**Dependência:** S-050 (display-schemas.ts deve existir)
**PRP:** 14 — Rich Content

---

## 1. Objetivo

- Criar `apps/packages/ai-sdk/src/tools/display.ts` com as 19 display tools usando `tool()` do Vercel AI SDK
- Cada tool tem `description` (pt-BR, orienta o modelo sobre quando usar), `parameters` (schema Zod de S-050), e `execute` que retorna args + flag `_display: true`
- Registrar as display tools no `allTools` em `agent.ts` via merge com coding tools e MCP tools
- Display tools são sempre disponibilizadas — o modelo decide quando usar (sem filtro por modo)

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/tools/display.ts` (NOVO)

Criar função `createDisplayTools()` que retorna objeto com as 19 display tools.

```typescript
import { tool } from "ai";
import {
  DisplayMetricSchema,
  DisplayChartSchema,
  // ...todos os 19 schemas
} from "../display-schemas.js";

export function createDisplayTools() {
  return {
    display_metric: tool({
      description: "Exibe um KPI/metrica em destaque com valor grande, label e tendencia opcional. Use para destacar um numero importante.",
      parameters: DisplayMetricSchema,
      execute: async (args) => ({ ...args, _display: true }),
    }),
    // ...demais 18 tools
  };
}
```

**Padrão de cada tool:**
- `description` — Frase em pt-BR descrevendo o que a tool exibe e quando usar. Não usar jargão técnico — o modelo precisa entender o propósito
- `parameters` — Schema Zod importado de `display-schemas.ts`
- `execute` — `async (args) => ({ ...args, _display: true })` — retorna os args validados com flag `_display: true` para que o frontend identifique display tools no stream sem lista hardcoded

As descriptions completas de cada uma das 19 tools estão definidas no PRP-14 (seção 2.1). Implementar exatamente como especificado.

### 2.2 Arquivo: `apps/packages/ai-sdk/src/agent.ts`

Importar `createDisplayTools()` e mergear no `allTools`:

```typescript
import { createDisplayTools } from "./tools/display.js";

// Dentro de runAiAgent(), junto com codingTools:
const displayTools = createDisplayTools();
const allTools = { ...codingTools, ...displayTools, ...mcpTools, ...options.tools };
```

**Regras:**
- Display tools devem vir **depois** de `codingTools` e **antes** de `mcpTools` no spread — em caso de colisão de nomes, MCP tools e options.tools têm precedência
- Não adicionar nenhum guard condicional (`if (mode === "conversation")`) — display tools são disponíveis em todos os modos
- Não alterar a assinatura de `runAiAgent()` — display tools são internas ao pacote

---

## 3. Regras de Implementação

- **`createDisplayTools()` é função (não const)** — permite lazy creation e evita side effects no import
- **Flag `_display: true`** no result é o contrato público — frontends usam isso para distinguir display tools de tools funcionais
- **Descriptions em pt-BR** — consistente com o sistema (interface em pt-BR, conforme CLAUDE.md)
- **Não criar componentes React** — display tools emitem dados JSON, o frontend renderiza
- **Não filtrar por modo** — o modelo decide quando usar display tools

---

## 4. Critérios de Aceite

- [ ] Arquivo `apps/packages/ai-sdk/src/tools/display.ts` existe com `createDisplayTools()` retornando 19 tools
- [ ] Cada tool tem `description`, `parameters` (schema Zod) e `execute` que retorna `{ ...args, _display: true }`
- [ ] `agent.ts` importa `createDisplayTools()` e mergeia no `allTools`
- [ ] Display tools aparecem no system prompt quando o agente é executado (modelo vê as 19 tools)
- [ ] Nenhum filtro por modo — display tools disponíveis em conversation, heartbeat e cron
- [ ] Typecheck passa: nenhum erro TypeScript no ai-sdk
- [ ] Build do ai-sdk (`npm run build:packages`) compila sem erros
