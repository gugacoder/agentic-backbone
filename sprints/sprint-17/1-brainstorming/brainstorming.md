# Brainstorming — Sprint 17 (Wave 15)

**PRP 23 — Rich Response: Display Domain Tools + Ativação por Cliente**

---

## Contexto

O TASK.md pede a implementação do PRP 23, que tem dois objetivos complementares:

1. **Consolidação de tools**: Agrupar as 19 display tools individuais em 4 domain tools com discriminated union por `action`, reduzindo o custo de tokens e seguindo o padrão já adotado no PRP 18.
2. **Ativação por cliente**: Criar mecanismo onde o cliente (ai-chat) envia `rich=true` no query param, o backbone lê o flag e (a) injeta um prompt de rich content no system prompt e (b) habilita as display tools no ai-sdk.

A spec é detalhada e autocontida — mapeamento de arquivos, trechos de código esperados e ordem de execução já definidos. A tarefa de brainstorming é identificar dependências ocultas, gaps e inconsistências que o agente de implementação deve conhecer.

---

## Funcionalidades mapeadas (estado atual do código)

| Área | Arquivo | Estado |
|---|---|---|
| 19 display tools individuais | `apps/packages/ai-sdk/src/tools/display.ts` | **Implementado** — 19 tools com `inputSchema` |
| Schemas individuais | `apps/packages/ai-sdk/src/display-schemas.ts` | **Implementado** — 19 schemas Zod + `DisplayToolRegistry` + `DisplayToolName` |
| `createDisplayTools()` no agent | `apps/packages/ai-sdk/src/agent.ts` linha 145-146 | **Implementado** — carregado sempre, sem flag condicional |
| `AiAgentOptions` sem `disableDisplayTools` | `apps/packages/ai-sdk/src/types.ts` | **Não implementado** — flag ausente |
| Rota POST messages sem `rich` | `apps/backbone/src/routes/conversations.ts` | **Não implementado** — query param não lido |
| `sendMessage()` sem `opts` | `apps/backbone/src/conversations/index.ts` | **Não implementado** — assinatura atual: `(userId, sessionId, content)` |
| `AssemblePromptOpts` sem `rich` | `apps/backbone/src/context/index.ts` | **Não implementado** — interface sem campo `rich` |
| `RICH_CONTENT_PROMPT` | `apps/backbone/src/context/index.ts` | **Não implementado** — constante ausente |
| `useBackboneChat` sem `enableRichContent` | `apps/packages/ai-chat/src/hooks/useBackboneChat.ts` | **Não implementado** — interface sem o campo |
| Registry de renderers por `toolName` | `apps/packages/ai-chat/src/display/registry.ts` | **Implementado** — mapeia `DisplayToolName → Component` |
| `PartRenderer` resolve por `toolName` | `apps/packages/ai-chat/src/parts/PartRenderer.tsx` linha 141-144 | **Implementado** — usa `toolName` para resolver renderer |

---

## Lacunas e oportunidades

### L-1: `DisplayToolName` e `DisplayToolRegistry` ficam desatualizados após o refactor

O tipo `DisplayToolName` em `display-schemas.ts` é derivado de `DisplayToolRegistry`, que lista as 19 tools antigas. Após o refactor para 4 domain tools, o `DisplayToolRegistry` continuará com as 19 entradas (correto — os schemas individuais permanecem). Porém o `registry.ts` do ai-chat usa `DisplayToolName` para tipagem do `DisplayRendererMap`. Com a mudança para `action → Renderer`, o tipo `DisplayToolName` deixa de ser o tipo correto para o mapa de renderers.

**Ação**: O `registry.ts` deve usar um tipo de `action` (os 19 action names) em vez de `DisplayToolName` (os 4 domain tool names). Uma alternativa é exportar um `DisplayActionName` de `display-schemas.ts`.

### L-2: `tools/display.ts` usa `inputSchema` (ai SDK v4 beta), não `parameters`

O código atual em `display.ts` usa `inputSchema:` em cada tool. O TASK.md mostra os trechos com `parameters:`. Deve-se verificar a versão do ai SDK no `package.json` do ai-sdk para confirmar qual propriedade usar — se `parameters` ou `inputSchema`.

### L-3: `sendMessage()` tem assinatura diferente da spec

O TASK.md mostra `sendMessage(user: AuthUser, sessionId, message, opts?)`, mas o código atual tem `sendMessage(userId: string, sessionId, content: string | ContentPart[])`. O parâmetro `user` é do tipo `AuthUser` na spec, mas `userId: string` no código. Adicionar `opts?: { rich?: boolean }` é seguro, mas a assinatura real deve ser verificada antes de modificar.

### L-4: Backbone não tem um `agent/index.ts` com `runAiAgent` explícito

O TASK.md menciona "backbone passa `disableDisplayTools: !rich`" mas não especifica em qual arquivo do backbone isso ocorre. O `sendMessage()` em `conversations/index.ts` linha 425 chama `assemblePrompt()` e depois provavelmente chama o ai-sdk. O agente deve rastrear onde `runAiAgent` ou equivalente é chamado no backbone para saber onde passar `disableDisplayTools`.

### L-5: `PartRenderer` linha 141 verifica `.startsWith("display_")` — continuará funcionando

Após o refactor, os domain tools ainda se chamam `display_highlight`, `display_collection`, etc. — o prefixo `display_` é preservado. A verificação `toolName.startsWith("display_")` continua correta. O que muda é: em vez de usar `toolName` para resolver o renderer, usa-se `result.action`.

### L-6: `resolveDisplayRenderer()` no registry aceita `string` — interface precisa de atualização

A função `resolveDisplayRenderer(toolName, overrides)` usa `toolName as DisplayToolName` internamente. Com a mudança para `action → Renderer`, a função deve aceitar `action: string` e o tipo `DisplayRendererMap` deve mudar de `Record<DisplayToolName, Component>` para `Record<string, Component>` (ou um tipo de action nomeado).

### L-7: Nenhum sprint anterior implementou nada de PRP 23

Confirmado: o codebase não tem `disableDisplayTools`, `rich` query param, `RICH_CONTENT_PROMPT`, `enableRichContent`, nem o agrupamento de domain tools. Todos os itens são novos.

---

## Priorização

| Rank | Discovery | Score | Justificativa |
|---|---|---|---|
| 1 | D-001: Reescrever `tools/display.ts` com 4 domain tools | 10 | Desbloqueador de D-007/D-008. Maior mudança arquitetural. Fases independentes 1 e 5 dependem disto. |
| 2 | D-002: Adicionar `disableDisplayTools` em `AiAgentOptions` e `agent.ts` | 9 | Sem isso, display tools continuam sendo carregadas mesmo sem `rich=true`. Central para o mecanismo de ativação. |
| 3 | D-003: `conversations.ts`: ler query param `rich` e passar para `sendMessage()` | 8 | Entry point do mecanismo. Fases 2a+2b+2c dependem desta sequência. |
| 4 | D-004: `conversations/index.ts`: adicionar `opts?: { rich? }` e propagar para `assemblePrompt` | 8 | Elo crítico na cadeia de propagação do flag `rich`. |
| 5 | D-005: `context/index.ts`: `AssemblePromptOpts.rich` + injetar `RICH_CONTENT_PROMPT` | 8 | Sem prompt, o modelo não sabe que deve usar display tools. |
| 6 | D-006: Backbone: passar `disableDisplayTools: !rich` ao chamar runAiAgent/stream | 8 | Fecha o loop de ativação condicional no ai-sdk. |
| 7 | D-007: `registry.ts`: mudar de `toolName → Renderer` para `action → Renderer` | 7 | Necessário para frontend funcionar com domain tools. Depende de D-001. |
| 8 | D-008: `PartRenderer.tsx`: resolver renderer por `result.action` em vez de `toolName` | 7 | Atualiza a lógica de renderização para domain tools. Depende de D-001. |
| 9 | D-009: `useBackboneChat.ts`: adicionar `enableRichContent` (default `true`) e propagar `?rich=true` | 7 | Ativa rich content automaticamente no ai-chat. Fase independente. |
| 10 | D-010: Build ai-sdk + ai-chat após refactor | 6 | Valida que os tipos TypeScript compilam corretamente após as mudanças nos schemas e na api do registry. |
