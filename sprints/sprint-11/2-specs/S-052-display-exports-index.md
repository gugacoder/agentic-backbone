# S-052 — Display Exports: Schemas e Tipos no index.ts

Exportar todos os schemas Zod, tipos inferidos e o `DisplayToolRegistry` no barrel export do ai-sdk para que apps consumidores possam importar.

**Resolve:** RC-004 (index.ts do ai-sdk não exporta schemas/tipos de display)
**Score de prioridade:** 8
**Dependência:** S-050 (display-schemas.ts deve existir)
**PRP:** 14 — Rich Content

---

## 1. Objetivo

- Adicionar re-exports de `display-schemas.ts` no `apps/packages/ai-sdk/src/index.ts`
- Expor publicamente: `DisplayToolRegistry`, `DisplayToolName`, 19 schemas Zod, 19 tipos inferidos
- Apps consumidores (Hub, Chat PWA, integradores TypeScript) passam a poder fazer `import { DisplayProductSchema, type DisplayProduct } from "@agentic-backbone/ai-sdk"`

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-sdk/src/index.ts`

Adicionar bloco de re-exports do `display-schemas.ts`:

```typescript
export {
  DisplayToolRegistry,
  type DisplayToolName,
  // Schemas
  DisplayMetricSchema,
  DisplayChartSchema,
  DisplayTableSchema,
  DisplayProgressSchema,
  DisplayProductSchema,
  DisplayComparisonSchema,
  DisplayPriceSchema,
  DisplayImageSchema,
  DisplayGallerySchema,
  DisplayCarouselSchema,
  DisplaySourcesSchema,
  DisplayLinkSchema,
  DisplayMapSchema,
  DisplayFileSchema,
  DisplayCodeSchema,
  DisplaySpreadsheetSchema,
  DisplayStepsSchema,
  DisplayAlertSchema,
  DisplayChoicesSchema,
  // Tipos inferidos
  type DisplayMetric,
  type DisplayChart,
  type DisplayTable,
  type DisplayProgress,
  type DisplayProduct,
  type DisplayComparison,
  type DisplayPrice,
  type DisplayImage,
  type DisplayGallery,
  type DisplayCarousel,
  type DisplaySources,
  type DisplayLink,
  type DisplayMap,
  type DisplayFile,
  type DisplayCode,
  type DisplaySpreadsheet,
  type DisplaySteps,
  type DisplayAlert,
  type DisplayChoices,
} from "./display-schemas.js";
```

**Regras:**
- Não alterar exports existentes — apenas adicionar novos
- Usar `type` keyword para re-export de tipos (TypeScript isolatedModules compatibility)
- Exportar também `createDisplayTools` de `./tools/display.js` para consumo programático opcional

---

## 3. Critérios de Aceite

- [ ] `import { DisplayToolRegistry } from "@agentic-backbone/ai-sdk"` resolve corretamente
- [ ] `import { DisplayProductSchema, type DisplayProduct } from "@agentic-backbone/ai-sdk"` resolve corretamente
- [ ] Todos os 19 schemas e 19 tipos estão acessíveis via barrel export
- [ ] `DisplayToolName` type é acessível
- [ ] Exports existentes do ai-sdk continuam funcionando — zero regressão
- [ ] Typecheck passa: nenhum erro TypeScript
- [ ] Build do ai-sdk (`npm run build:packages`) compila sem erros
