# S-078 — Reescrever Display Renderers Complexos com shadcn/ui

Reescrever os 5 display renderers complexos (DataTable, Carousel, ProductCard, Chart, Gallery+ImageViewer) para usar componentes shadcn internos.

**Resolve:** D-009 (5 display renderers complexos), D-007 (tokens --chart-1..5)
**Score de prioridade:** 6
**Dependencia:** S-073 (infraestrutura src/ui/ e cn())
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Reescrever `DataTableRenderer.tsx`, `CarouselRenderer.tsx`, `ProductCardRenderer.tsx`, `ChartRenderer.tsx`, `GalleryRenderer.tsx` e `ImageViewerRenderer.tsx`
- Usar componentes shadcn: `Table`, `ScrollArea`, `Card`, `Badge`, `Button`, `Dialog`
- Manter libs de comportamento: `embla-carousel-react`, `recharts`
- Resolver tokens de cor para charts via `var(--chart-1..5)`

---

## 2. Alteracoes

### 2.1 Arquivo: `apps/packages/ai-chat/src/display/DataTableRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-datatable-*`

**Depois:** Usar `Table` + `ScrollArea` + `Button` + `Badge` do shadcn:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

<ScrollArea className="w-full">
  <Table>
    <TableHeader>
      <TableRow>
        {columns.map((col, i) => (
          <TableHead key={i}>
            {col.sortable ? (
              <Button variant="ghost" size="sm" className="font-semibold -ml-3"
                      onClick={() => handleSort(col.key)}>
                {col.label}
                <SortIcon className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              col.label
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {sortedRows.map((row, ri) => (
        <TableRow key={ri}>
          {columns.map((col, ci) => (
            <TableCell key={ci}>
              {renderCell(row[col.key], col.type)}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ScrollArea>
```

Celulas tipadas:
- `money` → formatacao BRL com `Intl.NumberFormat`
- `image` → `<img className="rounded-sm h-8 w-8 object-cover" />`
- `link` → `<a className="text-primary underline">`
- `badge` → `<Badge variant="secondary">`
- `default` → texto simples

Manter logica de sort (state + comparador por tipo de coluna).

### 2.2 Arquivo: `apps/packages/ai-chat/src/display/CarouselRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-carousel-*`

**Depois:** Manter `embla-carousel-react` para logica de scroll. UI com shadcn:

```tsx
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../lib/utils";

<div className="relative">
  {/* Container do carousel */}
  <div className="overflow-hidden rounded-lg" ref={emblaRef}>
    <div className="flex">
      {slides.map((slide, i) => (
        <div key={i} className="flex-[0_0_100%] min-w-0 px-1">
          <Card className="overflow-hidden">
            {slide.image && <img src={slide.image} alt={slide.title} className="w-full aspect-video object-cover" />}
            <div className="p-3">
              <p className="font-medium text-sm">{slide.title}</p>
              {slide.description && <p className="text-xs text-muted-foreground mt-1">{slide.description}</p>}
              {slide.badge && <Badge className="mt-2">{slide.badge}</Badge>}
            </div>
          </Card>
        </div>
      ))}
    </div>
  </div>

  {/* Setas de navegacao */}
  <Button variant="outline" size="icon"
    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
    onClick={scrollPrev} disabled={!canScrollPrev}>
    <ChevronLeft className="h-4 w-4" />
  </Button>
  <Button variant="outline" size="icon"
    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
    onClick={scrollNext} disabled={!canScrollNext}>
    <ChevronRight className="h-4 w-4" />
  </Button>

  {/* Dots de paginacao */}
  <div className="flex justify-center gap-1.5 mt-3">
    {slides.map((_, i) => (
      <button key={i}
        className={cn("w-2 h-2 rounded-full transition-colors",
          i === selectedIndex ? "bg-primary" : "bg-muted")}
        onClick={() => scrollTo(i)} />
    ))}
  </div>
</div>
```

- `embla-carousel-react` continua como dep de comportamento
- Dots: `bg-primary` (ativo) / `bg-muted` (inativo)

### 2.3 Arquivo: `apps/packages/ai-chat/src/display/ProductCardRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-product-*`

**Depois:** Usar `Card` + `Badge` + `Button`:
```tsx
import { Card, CardContent, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

<Card className="overflow-hidden">
  <div className="relative">
    <img src={image} alt={title} className="w-full aspect-video object-cover" />
    {discount && (
      <Badge className="absolute top-2 right-2" variant="destructive">
        -{discount}%
      </Badge>
    )}
  </div>
  <CardContent className="p-4 space-y-2">
    <CardTitle className="text-sm">{title}</CardTitle>
    <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-bold">{formattedPrice}</span>
      {originalPrice && (
        <span className="text-sm text-muted-foreground line-through">{formattedOriginal}</span>
      )}
    </div>
    {url && (
      <Button className="w-full" size="sm" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">Ver produto</a>
      </Button>
    )}
  </CardContent>
</Card>
```

### 2.4 Arquivo: `apps/packages/ai-chat/src/display/ChartRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-chart-*`, cores hardcoded

**Depois:** Manter `recharts` para renderizacao. Wrapper com `Card`:

```tsx
import { Card } from "../ui/card";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

<Card className="p-4">
  {title && <p className="text-sm font-medium mb-4">{title}</p>}
  <div className="min-h-[200px]">
    <ResponsiveContainer width="100%" height={height || 300}>
      {/* recharts components usando CHART_COLORS */}
    </ResponsiveContainer>
  </div>
</Card>
```

**Resolucao D-007:** As cores dos graficos usam `var(--chart-1)` a `var(--chart-5)` — tokens padrao do shadcn. O host (Hub) define esses tokens no seu CSS. Se o host nao os define, os charts ficam sem cor — comportamento intencional (o pacote assume host shadcn).

Aplicar cores nas series:
- `BarChart`: `<Bar fill={CHART_COLORS[i % 5]} />`
- `LineChart`: `<Line stroke={CHART_COLORS[i % 5]} />`
- `PieChart`: `<Cell fill={CHART_COLORS[i % 5]} />`
- `AreaChart`: `<Area fill={CHART_COLORS[i % 5]} stroke={CHART_COLORS[i % 5]} />`

Eixos e grid: `stroke="var(--border)"`, labels: `fill="var(--muted-foreground)"`

### 2.5 Arquivo: `apps/packages/ai-chat/src/display/GalleryRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-gallery-*`

**Depois:** Grid + `Dialog` do shadcn para lightbox:
```tsx
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";

<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
  {images.map((img, i) => (
    <Dialog key={i}>
      <DialogTrigger asChild>
        <button className="relative group cursor-pointer rounded-md overflow-hidden aspect-square">
          <img src={img.src} alt={img.alt || ""} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn className="h-5 w-5 text-foreground" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 bg-background/95">
        <img src={img.src} alt={img.alt || ""} className="w-full h-auto" />
        {img.caption && <p className="p-3 text-sm text-muted-foreground">{img.caption}</p>}
      </DialogContent>
    </Dialog>
  ))}
</div>
```

### 2.6 Arquivo: `apps/packages/ai-chat/src/display/ImageViewerRenderer.tsx` (MODIFICAR)

**Antes:** classes `ai-chat-display-image-viewer-*`

**Depois:** `Dialog` do shadcn para lightbox + controles de zoom:
```tsx
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";

{/* Thumbnail */}
<Dialog>
  <DialogTrigger asChild>
    <button className="relative group cursor-pointer rounded-md overflow-hidden">
      <img src={src} alt={alt || ""} className="max-w-full rounded-md" />
      <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ZoomIn className="h-5 w-5 text-foreground" />
      </div>
    </button>
  </DialogTrigger>
  <DialogContent className="max-w-4xl p-0 bg-background/95">
    {/* Toolbar de zoom */}
    <div className="absolute top-2 right-2 flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={zoomIn}><Plus className="h-4 w-4" /></Button>
      <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
      <Button variant="ghost" size="icon" onClick={zoomOut}><Minus className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={resetZoom}><RotateCcw className="h-4 w-4" /></Button>
    </div>
    {/* Imagem com zoom */}
    <div className="overflow-auto max-h-[80vh]">
      <img src={src} alt={alt || ""}
        style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        className="w-full h-auto" />
    </div>
  </DialogContent>
</Dialog>
```

- Manter logica de zoom (0.25x-4x) com state interno
- Toolbar com `Button variant="ghost"`

---

## 3. Regras de Implementacao

- **Substituir `clsx()` por `cn()`** onde necessario
- **Zero classe `ai-chat-display-*`** — todas removidas
- **Zero cor hardcoded** — exceto `var(--chart-1..5)` e `var(--border)` que sao CSS variables do host
- **Manter API publica** — props e data contract identicos
- **Manter libs de comportamento** — `embla-carousel-react` e `recharts` permanecem
- **Nao alterar `registry.ts`** — mapeamento puro

---

## 4. Criterios de Aceite

- [ ] DataTableRenderer usa `Table` + `ScrollArea` + `Button` — zero classe `ai-chat-display-datatable`
- [ ] DataTableRenderer suporta sort, celulas tipadas (money/image/link/badge)
- [ ] CarouselRenderer usa `Card` + `Button` + embla — zero classe `ai-chat-display-carousel`
- [ ] CarouselRenderer arrows e dots funcionam
- [ ] ProductCardRenderer usa `Card` + `Badge` + `Button` — zero classe `ai-chat-display-product`
- [ ] ChartRenderer usa `Card` + recharts + `var(--chart-1..5)` — zero classe `ai-chat-display-chart`
- [ ] ChartRenderer suporta Bar, Line, Pie, Area com cores do tema
- [ ] GalleryRenderer usa grid + `Dialog` lightbox — zero classe `ai-chat-display-gallery`
- [ ] ImageViewerRenderer usa `Dialog` + zoom controls — zero classe `ai-chat-display-image-viewer`
- [ ] Zoom (0.25x-4x) funciona no ImageViewer
- [ ] Zero `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo `.tsx`
- [ ] API publica (props, exports) inalterada
