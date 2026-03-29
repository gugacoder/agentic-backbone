# S-055 — Guia Rich Content: Documentação de Integração

Criar o guia completo de integração para apps consumidores do protocolo de conteúdo rico, incluindo GUIDE.md, schemas.json, examples.json e component-map.md.

**Resolve:** RC-007 (GUIDE.md não existe), RC-008 (schemas.json não existe), RC-009 (examples.json não existe), RC-010 (component-map.md não existe)
**Score de prioridade:** 8
**Dependência:** S-050 (schemas devem existir para gerar documentação)
**PRP:** 14 — Rich Content

---

## 1. Objetivo

- Criar `guides/rich-content/GUIDE.md` — contrato público para apps consumidores
- Criar `guides/rich-content/schemas.json` — JSON Schema para clientes não-TypeScript
- Criar `guides/rich-content/examples.json` — payloads canônicos para cada display tool
- Criar `guides/rich-content/component-map.md` — mapa toolName → componente React + libs

---

## 2. Artefatos

### 2.1 Arquivo: `guides/rich-content/GUIDE.md` (NOVO)

Guia completo de integração. Seções obrigatórias:

1. **O que são display tools** — ferramentas cujo propósito é emitir conteúdo estruturado no stream; frontend mapeia para componentes React; backend emite JSON, frontend renderiza
2. **Como consumir via `useChat`** — exemplo de integração com `useChat()` do `ai/react` usando `?format=datastream`
3. **Como identificar display tools no stream**:
   - Prefixo `display_` no `toolName` do evento `tool-call`/`tool-result`
   - Flag `_display: true` no `result` — diferencia de tools funcionais
4. **Catálogo das 19 display tools** — para cada uma: nome, descrição, referência ao schema, quando usar vs markdown
5. **Fallback** — se o frontend não tem renderer para uma display tool, renderizar como JSON formatado (nunca quebrar)
6. **Canais pobres** — WhatsApp e outros canais sem rich content recebem apenas o markdown entre as display tools

### 2.2 Arquivo: `guides/rich-content/schemas.json` (NOVO)

JSON Schema exportado dos schemas Zod via `zodToJsonSchema`. Estrutura:

```json
{
  "display_metric": { /* JSON Schema */ },
  "display_chart": { /* JSON Schema */ },
  // ...19 entries
}
```

Gerado via script (pode ser `.tmp/gen-schemas.mjs`):

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
import { DisplayToolRegistry } from "../apps/packages/ai-sdk/src/display-schemas.js";

const jsonSchemas = Object.fromEntries(
  Object.entries(DisplayToolRegistry).map(([name, schema]) => [
    name,
    zodToJsonSchema(schema),
  ])
);
```

**Nota:** Se o build do ai-sdk ainda não foi feito, gerar manualmente a partir dos schemas Zod do PRP-14.

### 2.3 Arquivo: `guides/rich-content/examples.json` (NOVO)

Um exemplo de payload canônico para cada uma das 19 display tools. Estrutura:

```json
{
  "display_product": {
    "description": "Card de produto com imagem, preço, rating e fonte",
    "example": {
      "title": "Pneu Levorin Praieiro 26x1.95",
      "image": "https://example.com/pneu.jpg",
      "price": { "value": 35.90, "currency": "BRL" },
      "rating": { "score": 4.8, "count": 15000 },
      "source": { "name": "Pedal Ciclo", "url": "https://pedalciclo.com.br" },
      "badges": [{ "label": "Menor preço", "variant": "success" }],
      "url": "https://pedalciclo.com.br/pneu-levorin"
    },
    "use_when": "Apresentar um produto específico encontrado em pesquisa"
  }
  // ...18 mais
}
```

Cada entry tem: `description` (o que a tool exibe), `example` (payload válido contra o schema), `use_when` (quando usar em vez de markdown).

### 2.4 Arquivo: `guides/rich-content/component-map.md` (NOVO)

Mapa de referência para implementadores de frontend:

| Display Tool | Componente sugerido | Libs recomendadas |
|---|---|---|
| display_metric | `<MetricCard />` | — |
| display_chart | `<Chart />` | recharts |
| display_table | `<DataTable />` | @tanstack/react-table |
| display_carousel | `<Carousel />` | embla-carousel-react |
| display_map | `<MapView />` | react-leaflet |
| display_code | `<CodeBlock />` | shiki, react-syntax-highlighter |
| display_spreadsheet | `<Spreadsheet />` | @tanstack/react-table |
| display_sources | `<SourcesList />` | — |
| display_product | `<ProductCard />` | — |
| display_comparison | `<ComparisonTable />` | — |
| display_gallery | `<ImageGallery />` | — |
| display_image | `<ImageViewer />` | — |
| display_link | `<LinkPreview />` | — |
| display_price | `<PriceHighlight />` | — |
| display_file | `<FileCard />` | — |
| display_progress | `<ProgressSteps />` | — |
| display_steps | `<StepTimeline />` | — |
| display_alert | `<Alert />` | shadcn/ui Alert |
| display_choices | `<ChoiceButtons />` | shadcn/ui Button/Card |

---

## 3. Regras de Implementação

- **GUIDE.md é contrato público** — apps consumidores dependem dele; manter atualizado quando schemas mudarem
- **schemas.json é gerado, não escrito manualmente** — usar script para consistência com Zod source of truth
- **examples.json deve ter payloads válidos** — cada example deve passar na validação do schema correspondente
- **component-map.md é sugestão** — não obrigatório para consumidores; serve como referência para acelerar implementação
- **Linguagem em pt-BR** — consistente com o restante da documentação do projeto

---

## 4. Critérios de Aceite

- [ ] `guides/rich-content/GUIDE.md` existe com todas as seções obrigatórias
- [ ] `guides/rich-content/schemas.json` existe com JSON Schema para as 19 display tools
- [ ] `guides/rich-content/examples.json` existe com 19 exemplos canônicos válidos
- [ ] `guides/rich-content/component-map.md` existe com mapa das 19 tools → componentes
- [ ] Exemplos em `examples.json` são consistentes com os schemas Zod do PRP-14
- [ ] GUIDE.md explica como consumir via `useChat()` com `?format=datastream`
- [ ] GUIDE.md documenta fallback para display tools sem renderer
