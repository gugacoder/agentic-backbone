# Brainstorming — Sprint 11 | Wave 4

**Sprint:** 11 | **Wave:** 4 | **Data:** 2026-03-29

---

## Contexto

Sprint 11 é um sprint de **implementação**, não de pesquisa de mercado. A tarefa definida em `TASK.md` é o **PRP-14 — Rich Content: Display Tools e Protocolo de Conteúdo Rico**.

### Objetivo do PRP-14

Criar um catálogo de **display tools** — ferramentas cujo único propósito é emitir conteúdo estruturado no stream (product cards, gráficos, carrosseis, fontes, tabelas ricas) além de markdown. O sistema usa Vercel AI SDK `tool()` + `DataStream` para que clientes ricos (`useChat`) renderizem componentes React enquanto canais pobres (WhatsApp) ignoram as display tools e continuam recebendo o texto markdown entre elas.

### Dependência satisfeita

O PRP-14 depende do PRP-13 (Rich Stream), que foi implementado nesta wave (F-171, F-173). A verificação do código confirma:
- `schemas.ts` já declara `reasoning`, `tool-call`, `tool-result`
- `agent.ts` já emite os eventos ricos no loop `fullStream`
- `proxy.ts` já passa os novos tipos de evento para o backbone
- Build do ai-sdk realizado (dist/ atualizado)

---

## Funcionalidades Mapeadas (Estado Atual do Código)

### `apps/packages/ai-sdk/src/`

| Arquivo | Estado | Observação |
|---|---|---|
| `schemas.ts` | ✅ Atualizado (PRP-13) | `AgentEventSchema` com `reasoning`, `tool-call`, `tool-result` |
| `types.ts` | ✅ Atualizado (PRP-13) | `AiAgentEvent` com os 3 novos tipos; `AiAgentOptions.reasoning` presente |
| `agent.ts` | ✅ Atualizado (PRP-13) | Loop `fullStream` emite eventos ricos; `providerOptions` para reasoning ativo |
| `proxy.ts` | ✅ Atualizado (PRP-13) | Passa `reasoning`, `tool-call`, `tool-result` para o backbone |
| `display-schemas.ts` | ❌ **Ausente** | Nenhum schema Zod de display tool existe |
| `tools/display.ts` | ❌ **Ausente** | Nenhuma display tool registrada como Vercel AI SDK `tool()` |
| `index.ts` | ⚠️ Incompleto | Não exporta schemas/tipos de display tools |

### `apps/backbone/src/routes/`

| Arquivo | Estado | Observação |
|---|---|---|
| `conversations.ts` | ⚠️ Incompleto | Suporta apenas formato original (`AgentEvent` JSON); sem `?format=datastream` |
| `datastream.ts` | ❌ **Ausente** | Função `encodeDataStreamEvent()` não existe |

### `guides/`

| Diretório | Estado | Observação |
|---|---|---|
| `guides/rich-content/` | ❌ **Ausente** | Nenhum guia de integração para apps consumidores |

### Display tools no agente

Nenhuma display tool está registrada. O agente só tem `codingTools` (Read, Write, Bash, etc.) e `mcpTools`. O modelo não tem como emitir conteúdo estruturado além de markdown.

---

## Lacunas e Oportunidades

### RC-001 — GAP CRÍTICO: `display-schemas.ts` não existe
**Impacto total.** O arquivo central com os 19 schemas Zod (`DisplayMetric`, `DisplayChart`, `DisplayTable`, `DisplayProduct`, `DisplayCarousel`, etc.) não existe. Todas as outras fases dependem deste arquivo — sem ele, não há types, não há tools, não há guide.

### RC-002 — GAP: `tools/display.ts` não existe
As display tools como Vercel AI SDK `tool()` não existem. O modelo não vê essas ferramentas no system prompt e não pode emitir conteúdo estruturado. Depende de RC-001.

### RC-003 — GAP: `agent.ts` não registra display tools
Mesmo quando `tools/display.ts` existir, as display tools só chegam ao agente quando mergeadas em `allTools` em `runAiAgent()`. A linha `const allTools = { ...codingTools, ...displayTools, ...mcpTools, ...options.tools }` não existe ainda. Depende de RC-002.

### RC-004 — GAP: `index.ts` do ai-sdk não exporta schemas/tipos de display
Apps consumidores (Hub, Chat PWA, qualquer integrador TypeScript) não conseguem importar `DisplayToolRegistry`, `DisplayProductSchema`, `type DisplayProduct`, etc. Depende de RC-001.

### RC-005 — GAP: `routes/datastream.ts` não existe
A função `encodeDataStreamEvent()` que traduz `AgentEvent` para o protocolo Vercel `DataStream` (prefixos `0:`, `9:`, `a:`, `e:`, `d:`, `g:`) não existe. Sem ela, clientes com `useChat()` do `ai/react` não conseguem consumir o stream. A dependência de PRP-13 está satisfeita.

### RC-006 — GAP: `conversations.ts` não suporta `?format=datastream`
A rota `POST /conversations/:sessionId/messages` não aceita o parâmetro `?format=datastream`. Sem esse parâmetro, apps usando `useChat()` recebem JSON de `AgentEvent` em vez do protocolo DataStream esperado. Depende de RC-005.

### RC-007 — GAP: `guides/rich-content/GUIDE.md` não existe
Apps consumidores não têm documentação de como identificar display tools no stream (prefixo `display_` + flag `_display: true` no result), como mapear `toolName` para componentes React, qual é o fallback para ferramentas sem renderer, e exemplos de integração com `useChat`. Sem este guia, o protocolo é opaco para integradores externos.

### RC-008 — GAP: `guides/rich-content/schemas.json` não existe
Clientes não-TypeScript (Python, Java, no-code) não têm JSON Schema para validar payloads das display tools. O guia prevê geração via `zodToJsonSchema`.

### RC-009 — GAP: `guides/rich-content/examples.json` não existe
Implementadores de frontend não têm exemplos de payload canônicos para cada uma das 19 display tools. Sem exemplos, a adoção é lenta e erros de integração são frequentes.

### RC-010 — GAP: `guides/rich-content/component-map.md` não existe
Mapa `toolName → componente React sugerido + libs recomendadas` não está documentado. Equipes de frontend (Hub, Chat PWA) não sabem quais componentes construir nem quais bibliotecas usar (recharts, @tanstack/react-table, embla-carousel, react-leaflet, shiki).

---

## Priorização — Score por Impacto e Dependência

| Score | ID | Item | Justificativa |
|-------|----|------|---------------|
| 10 | RC-001 | `display-schemas.ts` — 19 schemas Zod | Prerequisite absoluto; bloqueia todos os outros gaps; definição dos contratos de dados |
| 9 | RC-002 | `tools/display.ts` — display tools como AI SDK `tool()` | Core da implementação; sem isso o modelo não emite conteúdo estruturado |
| 9 | RC-005 | `routes/datastream.ts` — `encodeDataStreamEvent()` | Habilita `useChat()` do `ai/react`; converte AgentEvent para protocolo DataStream; dependência PRP-13 já satisfeita |
| 9 | RC-003 | `agent.ts` — registrar display tools em `allTools` | Sem este merge o modelo não vê as tools; bloqueia qualquer uso end-to-end |
| 8 | RC-004 | `index.ts` — exportar schemas/tipos | Necessário para integradores TypeScript; sem isso os tipos ficam presos no pacote sem exposição pública |
| 8 | RC-006 | `conversations.ts` — `?format=datastream` | Fecha o ciclo de integração com `useChat`; sem isso apps não conseguem consumir o DataStream |
| 8 | RC-007 | `guides/rich-content/GUIDE.md` | Contrato público para todos os apps consumidores; sem documentação a adoção é lenta e inconsistente |
| 7 | RC-009 | `guides/rich-content/examples.json` | Acelera adoção dos componentes; payloads canônicos reduzem erros de integração |
| 7 | RC-010 | `guides/rich-content/component-map.md` | Referência para equipes de frontend; evita retrabalho de pesquisa de libs |
| 7 | RC-008 | `guides/rich-content/schemas.json` | Habilita validação em clientes não-TypeScript; útil para testes e documentação de API |

### Ordem lógica de execução

```
Fase 1 (base): RC-001 (display-schemas.ts)
Fase 2 (paralelo, depende de Fase 1): RC-002 (tools/display.ts), RC-004 (index.ts exports)
Fase 3 (depende de Fase 2a): RC-003 (agent.ts — registrar displayTools)
Fase 4 (independente): RC-005 (datastream.ts)
Fase 5 (depende de Fase 4): RC-006 (conversations.ts — ?format=datastream)
Fase 6 (build + validação): npm run build:packages
Fase 7 (paralelo, depende de Fase 1): RC-007, RC-008, RC-009, RC-010 (guides/)
Fase 8 (depende de Fase 6): Teste manual SSE + DataStream
```

---

## Consistência do PRP-14

### O que está correto no PRP

- Identificação completa dos 19 schemas Zod com primitivos reutilizáveis (`MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema`)
- Prefixo `display_` por convenção — permite identificação sem lista hardcoded
- Flag `_display: true` no result — diferencia display tools de tools funcionais no stream
- Decisão de não filtrar por modo (conversation/heartbeat/cron) — o modelo decide quando usar
- Separação clara: backend emite JSON, frontend renderiza (sem componentes React no ai-sdk ou backbone)
- Formato DataStream com prefixos corretos (`0:`, `9:`, `a:`, `e:`, `d:`, `g:`)
- Compatibilidade backward: formato original `AgentEvent` JSON mantido para canais existentes

### Observações para implementação

- O campo `justification` nos schemas (`_display: true` no execute) é a chave para o frontend distinguir display tools de tools funcionais sem consultar lista hardcoded
- `display_code` e `display_table` têm sobreposição com markdown; o PRP define claramente quando usar cada um (markdown para conteúdo simples, display tools quando markdown é insuficiente)
- Canais pobres (WhatsApp) recebem apenas o texto markdown entre as display tools — este comportamento já está implícito no stream-dispatcher existente (bufferiza `text`, despacha em `step_finish`)

---

*Sprint 11 — implementação de PRP-14 (Rich Content). Backlog acumulado: 150 discoveries anteriores + 10 novas (RC-001 a RC-010).*
