# S-050 — Display Schemas Zod

Criar o arquivo `display-schemas.ts` com os 19 schemas Zod das display tools, primitivos reutilizáveis, registry e tipos TypeScript inferidos.

**Resolve:** RC-001 (display-schemas.ts não existe — GAP CRÍTICO)
**Score de prioridade:** 10
**Dependência:** Nenhuma — prerequisite de S-051, S-052, S-055
**PRP:** 14 — Rich Content

---

## 1. Objetivo

- Criar o arquivo central `apps/packages/ai-sdk/src/display-schemas.ts` com todos os schemas Zod das display tools
- Definir 4 primitivos reutilizáveis: `MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema`
- Definir 19 display tool schemas organizados em 6 categorias
- Exportar o `DisplayToolRegistry` (mapa nome → schema) e tipo `DisplayToolName`
- Exportar tipos TypeScript inferidos via `z.infer<>` para cada schema
- Garantir que cada schema é auto-descritivo e validável em boundaries públicas

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/display-schemas.ts` (NOVO)

Criar arquivo com a seguinte estrutura:

#### Primitivos reutilizáveis

```typescript
import { z } from "zod";

const MoneySchema = z.object({
  value: z.number(),
  currency: z.string().default("BRL"),
});

const SourceRefSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  favicon: z.string().url().optional(),
});

const ImageItemSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

const BadgeSchema = z.object({
  label: z.string(),
  variant: z.enum(["default", "success", "warning", "error", "info"]).default("default"),
});
```

#### 19 Display Tool Schemas (6 categorias)

**Categoria 1 — Métricas e Dados:**
- `DisplayMetricSchema` — KPI com label, value, unit, trend, icon
- `DisplayChartSchema` — Gráfico (bar, line, pie, area, donut) com data points e format
- `DisplayTableSchema` — Tabela rica com colunas tipadas (text, number, money, image, link, badge)
- `DisplayProgressSchema` — Barra de progresso com steps nomeados e status

**Categoria 2 — Produtos e Comércio:**
- `DisplayProductSchema` — Card de produto com image, price, rating, source, badges
- `DisplayComparisonSchema` — Comparação lado a lado de produtos com atributos
- `DisplayPriceSchema` — Preço em destaque com label, contexto e fonte

**Categoria 3 — Mídia:**
- `DisplayImageSchema` — Imagem única com caption, width, height
- `DisplayGallerySchema` — Grid de imagens com layout (grid/masonry) e colunas
- `DisplayCarouselSchema` — Carrossel horizontal de cards com image, title, subtitle, price

**Categoria 4 — Referências e Navegação:**
- `DisplaySourcesSchema` — Lista de fontes consultadas com favicon e snippet
- `DisplayLinkSchema` — Preview de link com OG image, title, description
- `DisplayMapSchema` — Mapa com pins geolocalizados (lat, lng, label, address)

**Categoria 5 — Documentos e Arquivos:**
- `DisplayFileSchema` — Card de arquivo com name, type, size, url, preview
- `DisplayCodeSchema` — Bloco de código com language, syntax highlighting
- `DisplaySpreadsheetSchema` — Planilha com headers, rows, formatação monetária/percentual

**Categoria 6 — Interativo:**
- `DisplayStepsSchema` — Timeline/checklist com etapas e orientação (vertical/horizontal)
- `DisplayAlertSchema` — Banner de alerta (info, warning, error, success)
- `DisplayChoicesSchema` — Opções clicáveis (buttons, cards, list)

Os schemas completos estão definidos no PRP-14 (seção 1.1). Implementar exatamente como especificado.

#### Registry e tipos

```typescript
export const DisplayToolRegistry = {
  display_metric: DisplayMetricSchema,
  display_chart: DisplayChartSchema,
  display_table: DisplayTableSchema,
  display_progress: DisplayProgressSchema,
  display_product: DisplayProductSchema,
  display_comparison: DisplayComparisonSchema,
  display_price: DisplayPriceSchema,
  display_image: DisplayImageSchema,
  display_gallery: DisplayGallerySchema,
  display_carousel: DisplayCarouselSchema,
  display_sources: DisplaySourcesSchema,
  display_link: DisplayLinkSchema,
  display_map: DisplayMapSchema,
  display_file: DisplayFileSchema,
  display_code: DisplayCodeSchema,
  display_spreadsheet: DisplaySpreadsheetSchema,
  display_steps: DisplayStepsSchema,
  display_alert: DisplayAlertSchema,
  display_choices: DisplayChoicesSchema,
} as const;

export type DisplayToolName = keyof typeof DisplayToolRegistry;
```

Exportar tipo inferido para cada schema: `export type DisplayMetric = z.infer<typeof DisplayMetricSchema>`, etc.

---

## 3. Regras de Implementação

- **Arquivo único** — todos os 19 schemas no mesmo arquivo para coerência e import único
- **Primitivos são `const` (não exportados)** — usados internamente pelos schemas exportados
- **Nomes seguem convenção `Display{Tipo}Schema`** — consistente com Zod patterns do projeto
- **Registry usa prefixo `display_`** — permite identificação no stream sem lista hardcoded
- **Não criar nenhum outro arquivo** — esta spec cobre apenas schemas e tipos

---

## 4. Critérios de Aceite

- [ ] Arquivo `apps/packages/ai-sdk/src/display-schemas.ts` existe com os 19 schemas Zod
- [ ] Primitivos `MoneySchema`, `SourceRefSchema`, `ImageItemSchema`, `BadgeSchema` estão definidos e usados pelos schemas
- [ ] `DisplayToolRegistry` mapeia 19 nomes (prefixo `display_`) para seus respectivos schemas
- [ ] `DisplayToolName` é um type union das 19 chaves do registry
- [ ] Tipos inferidos exportados para cada schema (19 tipos)
- [ ] Todos os schemas passam validação Zod com payloads válidos
- [ ] Typecheck passa: nenhum erro TypeScript no ai-sdk
