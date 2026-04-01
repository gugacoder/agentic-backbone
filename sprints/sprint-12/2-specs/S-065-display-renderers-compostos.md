# S-065 — Display Renderers Compostos (9 componentes)

Criar os 9 display renderers compostos que completam o catálogo de 19 renderers.

**Resolve:** AC-010 (9 display renderers compostos ausentes)
**Score de prioridade:** 8
**Dependência:** S-056 (scaffold), S-060 (styles.css)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

Criar 9 componentes React em `apps/packages/ai-chat/src/display/` que renderizam dados das display tools compostas do ai-sdk. Junto com S-063 (8 simples) e S-064 (2 com lib), completa os 19 renderers.

---

## 2. Alterações

### 2.1 Arquivos em `apps/packages/ai-chat/src/display/` (NOVOS)

#### `ProductCardRenderer.tsx` — display_product
- Card de produto com imagem, nome, preço (BRL), rating em estrelas, badges, link
- Botão de ação opcional (url → "Ver produto")
- Props: `DisplayProduct` (name, image, price, rating, source, badges, url, description)

#### `ComparisonTableRenderer.tsx` — display_comparison
- Tabela de comparação lado a lado com header de produto e linhas de atributos
- Destaque visual no "melhor" valor por linha (quando indicado)
- Props: `DisplayComparison` (title, products: {name, image, attributes: {key, value}[]}[])

#### `DataTableRenderer.tsx` — display_table
- Tabela com colunas tipadas: text, number, money, image, link, badge
- Sortável por click no header da coluna
- Formatação automática por tipo (money → Intl.NumberFormat, number → locale)
- Props: `DisplayTable` (title, columns: {key, label, type}[], rows: Record<string, unknown>[])

#### `SpreadsheetRenderer.tsx` — display_spreadsheet
- Grid estilo planilha com headers, células formatadas (monetário/percentual/numérico)
- Sem edição — apenas visualização
- Props: `DisplaySpreadsheet` (title, headers, rows, formats)

#### `GalleryRenderer.tsx` — display_gallery
- Grid de imagens com layout (grid ou masonry)
- Click abre imagem ampliada (usa ImageViewerRenderer como dialog)
- Props: `DisplayGallery` (title, images: {url, alt, caption}[], layout, columns)

#### `ImageViewerRenderer.tsx` — display_image
- Imagem única com caption, responsiva
- Click abre em dialog/modal com zoom (scale transform)
- Props: `DisplayImage` (url, alt, caption, width, height)

#### `LinkPreviewRenderer.tsx` — display_link
- Card com preview de link: OG image, título, descrição, domínio
- Clicável — abre em nova aba
- Props: `DisplayLink` (url, title, description, image, domain)

#### `MapViewRenderer.tsx` — display_map
- Mapa via iframe OpenStreetMap com pins geolocalizados
- URL composta: `https://www.openstreetmap.org/export/embed.html?bbox=...&marker=...`
- Lista de pins abaixo do mapa com label e endereço
- Props: `DisplayMap` (title, center: {lat, lng}, zoom, pins: {lat, lng, label, address}[])

#### `ChoiceButtonsRenderer.tsx` — display_choices
- Botões ou cards clicáveis para opções interativas
- Layout por variant: `buttons` (inline), `cards` (grid), `list` (vertical)
- Click dispara callback `onChoiceSelect(value)` — consumidor define ação
- Props: `DisplayChoices` (title, choices: {label, value, description?, icon?}[], variant)

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar todos os 9 renderers.

---

## 3. Regras de Implementação

- **Um arquivo por renderer** em `src/display/`
- **Props = tipo Zod inferido** de `@agentic-backbone/ai-sdk`
- **Formatação monetária** via `Intl.NumberFormat("pt-BR", ...)` — consistente com S-063
- **MapView usa iframe OSM** — sem dependência de Google Maps ou Mapbox
- **ChoiceButtons:** callback `onChoiceSelect` é prop opcional; quando ausente, botões são decorativos
- **ImageViewer/Gallery:** dialog nativo com `<dialog>` element — sem lib de modal
- **DataTable sort:** estado local, sem lib de tabela (react-table não é dependência)
- **CSS classes** `.ai-chat-display-{tipo}-*`

---

## 4. Critérios de Aceite

- [ ] 9 arquivos de renderer existem em `src/display/`
- [ ] ProductCardRenderer exibe imagem, preço BRL, rating em estrelas
- [ ] ComparisonTableRenderer renderiza N produtos lado a lado
- [ ] DataTableRenderer é sortável por click no header
- [ ] DataTableRenderer formata colunas por tipo (money, number, text, badge)
- [ ] GalleryRenderer suporta grid e masonry layouts
- [ ] ImageViewerRenderer abre em dialog com zoom
- [ ] MapViewRenderer renderiza mapa OSM com pins
- [ ] ChoiceButtonsRenderer suporta 3 variantes de layout
- [ ] Nenhuma dependência externa adicional (usa dialog nativo, iframe OSM)
- [ ] Exports no `index.ts`
