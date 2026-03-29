# Brainstorming — Sprint 14 / Wave 7

**PRP 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)**

---

## Contexto

O `@agentic-backbone/ai-chat` (PRP 15) entregou um pacote funcional com 29 componentes React para chat rico. Porém, ele define seu próprio sistema de cores via 77 variáveis CSS `--ai-chat-*` com valores HSL hardcoded e usa classes BEM puras (`ai-chat-bubble`, `ai-chat-tool-activity`, etc.) — ignorando completamente o tema shadcn do app consumidor.

No Hub, que usa tema copper/laranja via tweakcn, o chat aparece com tema azul próprio. Qualquer troca de tema no host não afeta o chat.

**O objetivo desta wave** é reescrever a camada visual do pacote para usar exclusivamente componentes shadcn/ui internos (`src/ui/`) e tokens Tailwind semânticos — eliminando todo CSS próprio e toda cor hardcoded. A API pública permanece idêntica.

---

## Funcionalidades mapeadas (estado atual do código)

### Estrutura do pacote `@agentic-backbone/ai-chat`

```
apps/packages/ai-chat/src/
  components/         # 6 componentes core
    Chat.tsx          — container + ChatProvider
    MessageList.tsx   — lista de mensagens
    MessageBubble.tsx — bolha individual (user/assistant)
    MessageInput.tsx  — textarea + botões enviar/abort
    Markdown.tsx      — render de markdown via react-markdown
    StreamingIndicator.tsx — cursor piscante
  parts/              # 4 parts (lógica + UI)
    PartRenderer.tsx      — roteador de partes (lógica pura, sem UI)
    ReasoningBlock.tsx    — bloco colapsável de raciocínio
    ToolActivity.tsx      — indicador de tool em execução
    ToolResult.tsx        — resultado de tool colapsável
  display/            # 19 display renderers + registry
    AlertRenderer.tsx, MetricCardRenderer.tsx, FileCardRenderer.tsx
    PriceHighlightRenderer.tsx, CodeBlockRenderer.tsx, SourcesListRenderer.tsx
    StepTimelineRenderer.tsx, ProgressStepsRenderer.tsx, ChartRenderer.tsx
    CarouselRenderer.tsx, ProductCardRenderer.tsx, ComparisonTableRenderer.tsx
    DataTableRenderer.tsx, SpreadsheetRenderer.tsx, GalleryRenderer.tsx
    ImageViewerRenderer.tsx, LinkPreviewRenderer.tsx, MapViewRenderer.tsx
    ChoiceButtonsRenderer.tsx, registry.ts
  hooks/
    useBackboneChat.ts    — hook de chat (lógica pura)
    ChatProvider.tsx      — context provider (lógica pura)
  styles.css            — 2345 linhas com 77 CSS vars --ai-chat-*
  index.ts              — barrel exports
```

### Dependências atuais

- `@ai-sdk/react`, `@agentic-backbone/ai-sdk`
- `clsx`, `embla-carousel-react`, `lucide-react`
- `react-markdown`, `recharts`, `rehype-highlight`, `remark-gfm`
- **Ausentes**: `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `class-variance-authority`, `tailwind-merge`

### Integração no Hub

- `apps/hub/src/main.tsx` importa `@agentic-backbone/ai-chat/styles.css`
- Hub tem shadcn/ui em `apps/hub/src/components/ui/`: badge, button, card, dialog, scroll-area, separator, table, etc.
- **Gap**: Hub NÃO tem `alert.tsx` (só tem `alert-dialog.tsx`) nem `collapsible.tsx`

---

## Lacunas e oportunidades

### L-01: Componentes shadcn ausentes no Hub
O Hub carece de `alert.tsx` e `collapsible.tsx`. O ai-chat precisará deles internamente. Solução: criar esses dois componentes do zero nos `src/ui/` do ai-chat usando Radix primitives (`@radix-ui/react-collapsible` e uma Alert construída com `div` + variantes CVA).

### L-02: Nenhuma utilidade `cn()` existe no pacote
O pacote atualmente usa apenas `clsx`. Para shadcn, precisa de `cn()` (clsx + tailwind-merge). Isso é uma dep nova mas pequena.

### L-03: Exceção documentada de cor: `text-green-500` no ToolActivity
O check de ferramenta concluída usa `text-green-500` — única cor hardcoded excepcional. A TASK.md deixa como decisão do implementador. Recomendação: manter `text-green-500` (cor semântica de sucesso universal) ou usar `text-primary` (perde semântica visual).

### L-04: `AlertRenderer` usa variant `success` que shadcn Alert não tem natively
O shadcn `Alert` tem `default` e `destructive`. Para `success`, a TASK.md sugere `border-green-500/50` como className adicional — isso constitui uma cor hardcoded menor. Alternativa: usar `default` sem cor especial para success.

### L-05: Chart colors — dependência de tokens `--chart-1..5` do host
Recharts não lê tokens CSS automaticamente — precisa de strings de cor. A solução `var(--chart-1)` funciona SOMENTE se o host define esses tokens (shadcn padrão os define). Se o host não os define, os charts ficam sem cor.

### L-06: Componentes `src/ui/` não podem ser importados de `@/components/ui/`
Como o pacote é publicável, não pode depender de paths do consumidor. Todos os shadcn internos precisam ser copiados/criados em `src/ui/`. Isso inclui criar `progress.tsx` do zero (não existe no Hub).

### L-07: `styles.css` é exportado como `"./styles.css"` no package.json
Este export precisa ser removido. É a única breaking change desta PRP. O Hub precisa remover o import em `main.tsx`.

### L-08: Fases 2-6 são paralelas mas precisam de fase 1 primeiro
A fase 1 (infraestrutura) bloqueia todas as outras. Implementador deve garantir que `src/ui/` e `src/lib/utils.ts` estejam completos antes de tocar nos componentes.

### L-09: Nenhum mecanismo de validação automática de "zero cor hardcoded"
A TASK.md tem checklist visual manual. Um grep pode detectar `hsl(`, `oklch(`, `#[0-9a-fA-F]`, `rgb(` nos `.tsx` para validação rápida pós-implementação.

---

## Priorização

| ID | Descrição | Score | Justificativa |
|----|-----------|-------|---------------|
| D-001 | Criar infraestrutura base: `src/ui/` + `src/lib/utils.ts` + deps radix | 10 | Pré-requisito absoluto de todas as demais fases |
| D-002 | Reescrever 6 componentes core (Chat, MessageList, MessageBubble, MessageInput, Markdown, StreamingIndicator) | 9 | Base visual do chat — maior impacto perceptível no host |
| D-003 | Remover styles.css + export no package.json + import no Hub main.tsx | 9 | Completa o objetivo principal da PRP; sem isso o tema ainda não funciona |
| D-004 | Criar `alert.tsx` e `collapsible.tsx` no `src/ui/` a partir de Radix | 8 | Hub não os tem — são necessários para Parts e AlertRenderer |
| D-005 | Reescrever 3 parts (ReasoningBlock, ToolActivity, ToolResult) | 8 | Componentes de alta visibilidade no chat durante execução de tools |
| D-006 | Reescrever 6 display renderers simples (Alert, MetricCard, FileCard, PriceHighlight, SourcesList, CodeBlock) | 7 | Cobertura ampla de display tools com esforço médio |
| D-007 | Resolver tokens `--chart-1..5` para ChartRenderer | 7 | Gap técnico: recharts não lê CSS vars nativamente; solução `var()` depende do host |
| D-008 | Reescrever 7 display renderers médios (LinkPreview, ChoiceButtons, ComparisonTable, Spreadsheet, StepTimeline, ProgressSteps, MapView) | 6 | Cobertura importante, esforço proporcional |
| D-009 | Reescrever 5 display renderers complexos (DataTable, Carousel, ProductCard, Chart, Gallery, ImageViewer) | 6 | Maior complexidade; DataTable e Carousel têm lógica interativa |
| D-010 | Decisão sobre `text-green-500` no ToolActivity check | 5 | Única cor hardcoded excepcional — decidir manter ou usar token semântico |
| D-011 | Decisão sobre `border-green-500/50` no AlertRenderer success variant | 5 | Alert shadcn não tem variant success; gap de semântica |
| D-012 | Validação pós-implementação: grep por hsl/oklch/hex/rgb nos .tsx | 7 | Garantir cumprimento do requisito de zero cor hardcoded |
| D-013 | Criar `progress.tsx` no `src/ui/` (não existe no Hub) | 4 | Necessário para ProgressStepsRenderer; componente simples sem Radix dep adicional |
