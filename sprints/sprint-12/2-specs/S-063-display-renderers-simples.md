# S-063 — Display Renderers Simples (8 componentes)

Criar os 8 display renderers que não dependem de bibliotecas externas pesadas.

**Resolve:** AC-008 (8 display renderers simples ausentes)
**Score de prioridade:** 9
**Dependência:** S-056 (scaffold), S-060 (styles.css para tokens)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

Criar 8 componentes React em `apps/packages/ai-chat/src/display/` que renderizam os dados emitidos pelas display tools do ai-sdk. Cada componente recebe como props o tipo inferido do schema Zod correspondente (de `@agentic-backbone/ai-sdk`).

---

## 2. Alterações

### 2.1 Arquivos em `apps/packages/ai-chat/src/display/` (NOVOS)

#### `AlertRenderer.tsx` — display_alert
- Banner com ícone contextual por variante (info → Info, warning → AlertTriangle, error → XCircle, success → CheckCircle)
- Título em bold + mensagem
- Borda lateral na cor da variante
- Props: `DisplayAlert` (title, message, variant, dismissible)

#### `MetricCardRenderer.tsx` — display_metric
- Card com label, value grande, unit, trend (up/down/neutral com seta e cor)
- Ícone opcional (nome lucide)
- Props: `DisplayMetric` (label, value, unit, trend, icon, description)

#### `PriceHighlightRenderer.tsx` — display_price
- Preço em destaque com formatação monetária (Intl.NumberFormat para BRL)
- Label de contexto + fonte
- Props: `DisplayPrice` (label, price: {value, currency}, context, source)

#### `FileCardRenderer.tsx` — display_file
- Card com ícone por tipo de arquivo (pdf → FileText, image → Image, etc.)
- Nome, tamanho formatado (KB/MB), link de download
- Props: `DisplayFile` (name, type, size, url, preview)

#### `CodeBlockRenderer.tsx` — display_code
- Bloco de código com header (language label + botão copiar)
- Syntax highlighting via rehype-highlight (reusa do Markdown)
- Props: `DisplayCode` (language, code, filename, highlights)

#### `SourcesListRenderer.tsx` — display_sources
- Lista numerada de fontes com favicon, título clicável e snippet
- Props: `DisplaySources` (title, sources: {name, url, favicon, snippet}[])

#### `StepTimelineRenderer.tsx` — display_steps
- Timeline vertical com etapas, ícones de status (pending/active/completed/error)
- Orientação vertical (horizontal como stretch goal)
- Props: `DisplaySteps` (title, steps: {label, description, status}[], orientation)

#### `ProgressStepsRenderer.tsx` — display_progress
- Barra de progresso com steps nomeados e status visual
- Porcentagem de conclusão calculada automaticamente
- Props: `DisplayProgress` (title, steps: {label, status}[], current)

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar todos os 8 renderers.

---

## 3. Regras de Implementação

- **Cada renderer é um arquivo** — um componente por arquivo em `src/display/`
- **Props = tipo Zod inferido** — importar de `@agentic-backbone/ai-sdk`
- **Sem dependências externas** — apenas React, lucide-react, clsx
- **CSS classes** com namespace `.ai-chat-display-{tipo}`
- **Formatação monetária** via `Intl.NumberFormat("pt-BR", { style: "currency", currency })` — nunca hardcodar formato
- **Ícones via lucide-react** — não instalar bibliotecas de ícones adicionais

---

## 4. Critérios de Aceite

- [ ] 8 arquivos de renderer existem em `src/display/`
- [ ] Cada renderer aceita o tipo inferido do schema Zod como props
- [ ] AlertRenderer diferencia 4 variantes visuais (info, warning, error, success)
- [ ] MetricCardRenderer exibe trend com seta e cor
- [ ] PriceHighlightRenderer formata BRL corretamente via Intl.NumberFormat
- [ ] CodeBlockRenderer tem botão copiar funcional
- [ ] SourcesListRenderer renderiza favicons e links clicáveis
- [ ] StepTimelineRenderer diferencia status das etapas visualmente
- [ ] Nenhuma dependência externa além de React, lucide-react, clsx
- [ ] Exports no `index.ts`
