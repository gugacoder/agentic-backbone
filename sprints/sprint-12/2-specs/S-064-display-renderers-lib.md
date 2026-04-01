# S-064 — Display Renderers com Lib (Chart + Carousel)

Criar os 2 display renderers que dependem de bibliotecas externas: Chart (recharts) e Carousel (embla-carousel-react).

**Resolve:** AC-009 (Chart e Carousel ausentes)
**Score de prioridade:** 8
**Dependência:** S-056 (scaffold), S-060 (styles.css)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `ChartRenderer.tsx` — renderiza gráficos (bar, line, pie, area, donut) usando recharts com ResponsiveContainer
- Criar `CarouselRenderer.tsx` — carrossel horizontal de cards usando embla-carousel-react com setas e suporte touch

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/display/ChartRenderer.tsx` (NOVO)

```typescript
import { ResponsiveContainer, BarChart, LineChart, PieChart, AreaChart, Bar, Line, Pie, Area, XAxis, YAxis, Tooltip, Legend, Cell } from "recharts";
```

Props: `DisplayChart` (type: bar|line|pie|area|donut, title, data: {label, value, color?}[], xLabel, yLabel, format)

Comportamento:
- **Switch por type** — renderiza o componente recharts correspondente
- **Donut** = PieChart com `innerRadius` > 0
- **ResponsiveContainer** com height fixo (300px default, configurável via CSS variable `--ai-chat-chart-height`)
- **Tooltip** com formatação (monetário, percentual, numérico — baseado em `format`)
- **Cores** — array de 8 cores padrão harmonizadas; `color` no data point tem prioridade
- **Title** — `<h4>` acima do chart

### 2.2 Arquivo: `apps/packages/ai-chat/src/display/CarouselRenderer.tsx` (NOVO)

```typescript
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
```

Props: `DisplayCarousel` (title, items: {image, title, subtitle, price?, url?}[])

Comportamento:
- **Embla carousel** com drag/touch nativo
- **Setas** prev/next nos lados (escondidas em mobile, visíveis em desktop)
- **Cards** — imagem em cima, título, subtítulo, preço opcional (formatado BRL)
- **Dots** indicadores abaixo do carousel
- **Responsivo** — 1 card em mobile, 2 em tablet, 3 em desktop (via CSS)

### 2.3 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `ChartRenderer` e `CarouselRenderer`.

---

## 3. Regras de Implementação

- **recharts e embla-carousel-react são deps do pacote** (declaradas em S-056)
- **ResponsiveContainer é obrigatório** — nunca hardcodar width
- **Preços** via `Intl.NumberFormat("pt-BR", ...)` — consistente com S-063
- **CSS classes** `.ai-chat-display-chart-*` e `.ai-chat-display-carousel-*`

---

## 4. Critérios de Aceite

- [ ] ChartRenderer renderiza os 5 tipos de gráfico (bar, line, pie, area, donut)
- [ ] Charts são responsivos via ResponsiveContainer
- [ ] Tooltip exibe valores formatados
- [ ] CarouselRenderer funciona com drag/touch
- [ ] Setas de navegação funcionais
- [ ] Cards exibem imagem, título e preço formatado
- [ ] Responsivo (1/2/3 cards por breakpoint)
- [ ] Exports no `index.ts`
