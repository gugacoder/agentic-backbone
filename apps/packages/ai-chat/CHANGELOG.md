# Changelog

## [0.2.0] - 2026-03-29

### Changed
- Reescrita completa da camada visual com componentes shadcn/ui (Card, Button, Alert, Table, Badge, Collapsible, Dialog, ScrollArea, Separator)
- Eliminado `styles.css` (2346 linhas) — zero CSS próprio no pacote
- Zero cor hardcoded — nenhum `hsl()`, `oklch()`, `#hex`, `rgb()` em nenhum arquivo
- Removido export `./styles.css` do campo `exports` do `package.json`
- O pacote herda 100% do tema shadcn do app consumidor (tokens CSS do host)
- Dark mode automático via shadcn (sem bloco `.dark` próprio)

### Added
- Componentes shadcn internos em `src/ui/`: `alert`, `badge`, `button`, `card`, `collapsible`, `dialog`, `progress`, `scroll-area`, `separator`, `table`
- `src/lib/utils.ts` com função `cn()` (clsx + tailwind-merge)
- Dependências: `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `class-variance-authority`, `tailwind-merge`

### Unchanged
- API pública (`ChatProps`, `useBackboneChat`, `ChatProvider`, exports) — breaking change zero para consumidores
- Hooks (`useBackboneChat`, `ChatProvider`) — lógica pura, sem visual
- Data contract dos display tools (`DisplayToolName`, schemas Zod no ai-sdk)
- Dependências de comportamento: `embla-carousel-react`, `recharts`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `lucide-react`

### Breaking
- Removido export `./styles.css` — consumidores que importavam `@agentic-backbone/ai-chat/styles.css` devem remover o import

## [0.1.0] - 2026-03-29

### Added
- Initial release
