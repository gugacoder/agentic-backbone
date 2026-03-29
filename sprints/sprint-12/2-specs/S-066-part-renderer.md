# S-066 — PartRenderer

Switch central que mapeia `message.part.type` ao componente React correto.

**Resolve:** AC-011 (PartRenderer.tsx ausente — GAP CRÍTICO)
**Score de prioridade:** 10
**Dependência:** S-058 (Markdown), S-059 (ReasoningBlock), S-061 (ToolActivity), S-062 (ToolResult), S-063–S-065 (display renderers), S-067 (registry)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `PartRenderer.tsx` — componente que recebe um `part` de uma mensagem e renderiza o componente React apropriado
- Mapear `part.type` para componentes: `text` → Markdown, `reasoning` → ReasoningBlock, `tool-invocation` → ToolActivity/ToolResult ou display renderer
- Para tool-invocations do tipo display (prefixo `display_`): buscar o renderer no registry
- Para tool-invocations funcionais: ToolActivity durante call, ToolResult após result

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/parts/PartRenderer.tsx` (NOVO)

```typescript
export interface PartRendererProps {
  part: MessagePart;  // tipo do @ai-sdk/react
  isStreaming?: boolean;
  displayRenderers?: DisplayRendererMap;  // override de renderers
}
```

Lógica de switch:

```typescript
switch (part.type) {
  case "text":
    return <Markdown content={part.text} />;

  case "reasoning":
    return <ReasoningBlock content={part.reasoning} isStreaming={isStreaming} />;

  case "tool-invocation": {
    const isDisplay = part.toolInvocation.toolName.startsWith("display_");

    if (isDisplay && part.toolInvocation.state === "result") {
      const Renderer = resolveDisplayRenderer(part.toolInvocation.toolName, displayRenderers);
      if (Renderer) return <Renderer {...part.toolInvocation.result} />;
    }

    if (part.toolInvocation.state === "result") {
      return <ToolResult toolName={part.toolInvocation.toolName} result={part.toolInvocation.result} />;
    }

    return <ToolActivity toolName={part.toolInvocation.toolName} state={part.toolInvocation.state} />;
  }

  default:
    return null;
}
```

A função `resolveDisplayRenderer` consulta:
1. `displayRenderers` (prop override) — prioridade
2. `defaultDisplayRenderers` (de S-067 registry) — fallback

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `PartRenderer` e `PartRendererProps`.

---

## 3. Regras de Implementação

- **Display tools são identificadas pelo prefixo `display_`** — consistente com o registry do ai-sdk
- **Override via prop** — consumidor pode passar mapa parcial de renderers customizados
- **Fallback graceful** — se renderer não encontrado, não renderizar nada (ou usar fallback genérico mostrando JSON)
- **ToolActivity durante `call`/`partial-call`, ToolResult no `result`** — nunca ambos
- **Sem estado** — PartRenderer é puramente funcional (props → JSX)

---

## 4. Critérios de Aceite

- [ ] `PartRenderer` renderiza corretamente parts de tipo `text`, `reasoning`, `tool-invocation`
- [ ] Display tools (prefixo `display_`) resolvem para o renderer correto
- [ ] Renderers de display são overridable via prop `displayRenderers`
- [ ] Tool calls funcionais mostram ToolActivity durante call e ToolResult no result
- [ ] Parts desconhecidos não quebram a UI (retornam null)
- [ ] Export no `index.ts`
