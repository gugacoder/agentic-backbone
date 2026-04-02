# PRP-25B — Componentes de Conversas: List, Bar e Internos

Criar os componentes de gerenciamento de conversas no `@codrstudio/agentic-chat` — 4 componentes internos (CollapsibleGroup, ConversationListItem, RenameDialog, DeleteDialog) e 2 componentes públicos (ConversationList, ConversationBar), todos controlados e framework-agnostic.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- PRP-25A entregou: 3 primitivos shadcn (Input, DropdownMenu, Skeleton), tipos (`Conversation`, `BackendMessage`), utilitários (`formatRelativeTime`, `buildInitialMessages`, `groupConversations`), `useIsMobile`, `useConversations`
- Zero componentes de gerenciamento de sessões no pacote
- Toda a UI de conversas vive no Hub (~1000 linhas), acoplada a TanStack Router/Query:
  - `conversations-layout.tsx` (~565 linhas): sidebar com histórico, busca, favoritos, rename inline, star toggle
  - `conversation-chat.tsx` (~460 linhas): barra de contexto, rename dialog, delete dialog, dropdown menu

### Estado desejado

- 4 componentes internos reutilizáveis (não exportados publicamente)
- `ConversationList` — componente principal da sidebar, totalmente controlado
- `ConversationBar` — barra de contexto no topo do chat, totalmente controlada
- Todos os componentes: slots de extensão para features hub-specific, labels internacionalizáveis, tokens shadcn

### Dependencias

- **PRP-25A** — primitivos shadcn (Input, DropdownMenu, Skeleton), tipos (`Conversation`), utilitários

## Especificacao

### Feature F-367: Componentes internos — CollapsibleGroup, ConversationListItem, RenameDialog, DeleteDialog

**Spec:** S-111

Criar 4 componentes internos em `src/conversations/`. Não são exportados na API pública — usados apenas por ConversationList e ConversationBar.

#### 1. `src/conversations/CollapsibleGroup.tsx`

Extraído de `conversations-layout.tsx:54-81`.

```tsx
interface CollapsibleGroupProps {
  label: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
```

- Usa Radix Collapsible (já disponível no pacote)
- Chevron rotaciona 90° quando aberto (transição CSS `rotate(90deg)`)
- Label em `text-xs font-medium text-muted-foreground`
- Área clicável: label + chevron

#### 2. `src/conversations/ConversationListItem.tsx`

Extraído de `conversations-layout.tsx:83-197`.

```tsx
interface ConversationListItemProps {
  conversation: Conversation;
  agentLabel?: string;
  isActive?: boolean;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameCommit?: () => void;
  onRenameCancel?: () => void;
  onStartRename?: (e: React.MouseEvent) => void;
  onToggleStar?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  badgesExtra?: React.ReactNode;  // slot para badges hub-specific (ex: operador)
  className?: string;
}
```

Layout visual:
- **Esquerda**: Star icon (toggle amarelo quando starred, `Star`/`StarOff` do lucide)
- **Centro** (área clicável): primeira linha com badges (agent badge + `badgesExtra`) + timestamp via `formatRelativeTime`; segunda linha com título truncado
- **Direita**: Pencil icon (visível apenas no hover, `Pencil` do lucide)
- **Inline rename**: quando `isRenaming=true`, substitui título por `<Input>`. Enter confirma, Escape cancela
- **Active state**: `bg-accent` quando `isActive`

#### 3. `src/conversations/RenameDialog.tsx`

Dialog modal para renomear conversa.

```tsx
interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  isPending?: boolean;
  title?: string;           // default: "Rename conversation"
  placeholder?: string;     // default: "Conversation title"
  cancelLabel?: string;     // default: "Cancel"
  confirmLabel?: string;    // default: "Save"
}
```

- Usa primitivo `Dialog` existente no pacote
- Enter no input confirma
- Botão desabilitado quando valor vazio ou `isPending`
- Labels customizáveis para i18n

#### 4. `src/conversations/DeleteDialog.tsx`

Dialog de confirmação para excluir.

```tsx
interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  title?: string;           // default: "Delete conversation"
  description?: string;     // default: "This conversation will be permanently removed."
  cancelLabel?: string;     // default: "Cancel"
  confirmLabel?: string;    // default: "Delete"
}
```

- Usa primitivo `Dialog` existente no pacote
- Botão de confirmar usa `variant="destructive"`
- Labels customizáveis para i18n

#### Regras

- Componentes internos — NÃO exportar em `index.ts`
- Usar lucide-react para ícones (já é dependência do pacote)
- Todos os estilos via tokens CSS shadcn (bg-background, text-foreground, border-input, etc.)
- `ConversationListItem` deve ter keyboard support no inline rename (Enter/Escape)

### Feature F-368: ConversationList — componente principal da sidebar

**Spec:** S-112

Componente público da sidebar de conversas. **Totalmente controlado** — recebe dados e callbacks, não faz fetch nem navega.

#### 1. `src/conversations/ConversationList.tsx`

```tsx
interface ConversationListProps {
  // Dados
  conversations: Conversation[];
  activeId?: string;
  isLoading?: boolean;

  // Busca
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;                    // default: "Search..."

  // Grupos (se não fornecidos, deriva de conversations por starred)
  favorites?: Conversation[];
  history?: Conversation[];
  favoritesLabel?: string;                       // default: "Favorites"
  historyLabel?: string;                         // default: "History"

  // Paginação
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadMoreLabel?: string;                        // default: "Load more"
  remainingCount?: number;

  // Callbacks
  onSelect?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onStar?: (id: string, starred: boolean) => void;
  onCreateRequest?: () => void;

  // Resolvers
  getAgentLabel?: (agentId: string) => string;

  // Slots de extensão
  headerExtra?: React.ReactNode;                 // entre busca e botão +
  filterExtra?: React.ReactNode;                 // abaixo do header (ex: agent Select)
  itemBadgesExtra?: (conv: Conversation) => React.ReactNode;

  // Empty state
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;                           // default: "No conversations"
  emptyDescription?: string;                     // default: "Start a conversation to begin."

  // Layout
  className?: string;
}
```

#### 2. Estado interno

O componente gerencia internamente:
- `renamingId: string | null` — qual item está sendo renomeado
- `renameValue: string` — valor do input de rename
- `favoritesOpen: boolean` — estado do CollapsibleGroup de favoritos (default: `true`)
- `historyOpen: boolean` — estado do CollapsibleGroup de histórico (default: `true`)

#### 3. Estrutura visual

```
+----------------------------------+
| [Search...] [headerExtra] [+]    |
+----------------------------------+
| [filterExtra]                    |
+----------------------------------+
| ▸ Favorites                      |
|   [ConversationListItem]         |
|   [ConversationListItem]         |
| ▸ History                        |
|   [ConversationListItem]         |
|   [ConversationListItem]         |
|   [Load more (N remaining)]      |
+----------------------------------+
```

- Header: Input de busca + slot `headerExtra` + botão `+` (chama `onCreateRequest`)
- Abaixo do header: slot `filterExtra`
- Grupos: CollapsibleGroup para Favoritos e Histórico
- Items: ConversationListItem para cada conversa
- Load more: botão visível quando `hasMore=true`, mostra `remainingCount`
- Se `favorites`/`history` não fornecidos, deriva de `conversations` usando `groupConversations`

#### 4. Loading state

8 `Skeleton` de `h-16 w-full rounded-lg` dentro de um container com gap.

#### 5. Empty state

Ícone centralizado (default: `MessageSquare` do lucide) + título + descrição. Visível quando `conversations.length === 0` e `isLoading === false`.

#### Regras

- **Totalmente controlado** — zero fetch, zero navegação, zero estado global
- Busca: o componente mostra o input mas NÃO filtra internamente — o consumidor filtra e passa `conversations` já filtradas
- Star toggle: chama `onStar(id, !current)` — o consumidor faz o update (otimista ou não)
- Rename: gerencia o estado do input internamente, chama `onRename(id, title)` no commit
- Slots permitem extensão sem alterar o componente (headerExtra, filterExtra, itemBadgesExtra)
- ScrollArea para overflow do conteúdo

### Feature F-369: ConversationBar — barra de contexto no topo do chat

**Spec:** S-113

Componente público da barra de contexto. **Totalmente controlado.**

#### 1. `src/conversations/ConversationBar.tsx`

```tsx
interface ConversationBarProps {
  // Dados
  title?: string;
  agentLabel?: string;
  isLoading?: boolean;

  // Ações
  onRename?: (title: string) => void;
  onExport?: () => void;
  onDelete?: () => void;
  onBack?: () => void;                          // mostra seta voltar (mobile)

  // Estado dos dialogs (controlled OU uncontrolled)
  // Se não fornecidos, gerencia internamente
  renameOpen?: boolean;
  onRenameOpenChange?: (open: boolean) => void;
  deleteOpen?: boolean;
  onDeleteOpenChange?: (open: boolean) => void;

  // Pending states
  isPendingRename?: boolean;
  isPendingDelete?: boolean;

  // Labels
  renameLabel?: string;         // default: "Rename"
  exportLabel?: string;         // default: "Export"
  deleteLabel?: string;         // default: "Delete"
  untitledLabel?: string;       // default: "Untitled"

  // Slots de extensão
  actionsExtra?: React.ReactNode;      // antes do dropdown (ex: TakeoverButton)
  menuItemsExtra?: React.ReactNode;    // DropdownMenuItems extras
  afterBar?: React.ReactNode;          // abaixo da barra (ex: TakeoverBanner, Approvals)

  // Layout
  className?: string;
}
```

#### 2. Estrutura visual

```
+------------------------------------------------------+
| [←] Titulo da conversa   [agent badge] [extras] [⋮]  |
+------------------------------------------------------+
| [afterBar]                                            |
```

- **Esquerda**: seta voltar (visível quando `onBack` fornecido) + título truncado (ou `untitledLabel`)
- **Centro/Direita**: Badge com `agentLabel` + slot `actionsExtra` + botão dropdown (`⋮`)
- **Dropdown** (`DropdownMenu`): Renomear (Pencil icon), Exportar (Download icon), `menuItemsExtra`, Separator, Excluir (Trash2 icon, `text-destructive`)
- **Abaixo**: slot `afterBar`

#### 3. Modos controlled/uncontrolled

- Se `renameOpen`/`onRenameOpenChange` fornecidos → modo controlled (consumidor controla dialog)
- Se não fornecidos → modo uncontrolled (componente gerencia `useState` internamente)
- Mesmo padrão para `deleteOpen`/`onDeleteOpenChange`

#### 4. Loading state

`Skeleton` de `h-5 w-48` no lugar do título quando `isLoading=true`.

#### 5. Integração com dialogs

- Clicar "Renomear" no dropdown abre `RenameDialog` com o título atual
- Clicar "Excluir" no dropdown abre `DeleteDialog`
- `RenameDialog.onConfirm` chama `onRename(newTitle)` e fecha dialog
- `DeleteDialog.onConfirm` chama `onDelete()` e fecha dialog

#### Regras

- **Totalmente controlado** — zero fetch, zero navegação
- Dropdown usa `DropdownMenu` do PRP-25A
- Dialogs usam `RenameDialog`/`DeleteDialog` internos (F-367)
- `onBack` controla visibilidade da seta — componente NÃO decide quando mostrar
- Ícones do lucide-react: `ArrowLeft`, `Pencil`, `Download`, `Trash2`, `MoreVertical`

## Limites

- **NÃO** fazer fetch interno nos componentes — são controlados
- **NÃO** adicionar lógica de navegação (useNavigate, router) — apenas callbacks
- **NÃO** exportar componentes internos (CollapsibleGroup, ConversationListItem, RenameDialog, DeleteDialog)
- **NÃO** acoplar a TanStack Query, Zustand ou qualquer library de estado
- **NÃO** mover TakeoverButton/TakeoverBanner/ApprovalInlineActions para o pacote — são hub-specific
- **NÃO** criar barrel exports neste PRP — isso é PRP-25C

## Validacao

- [ ] `CollapsibleGroup` renderiza label + chevron, colapsa/expande ao clicar
- [ ] `ConversationListItem` renderiza star, badges, título, timestamp, pencil no hover
- [ ] `ConversationListItem` inline rename: Enter confirma, Escape cancela
- [ ] `ConversationListItem` star toggle dispara `onToggleStar`
- [ ] `ConversationListItem` slot `badgesExtra` renderiza conteúdo extra
- [ ] `RenameDialog` abre, Enter confirma, botão desabilitado quando vazio ou isPending
- [ ] `DeleteDialog` abre, botão destructive, confirmação dispara callback
- [ ] `ConversationList` renderiza com dados mockados (favorites + history)
- [ ] `ConversationList` mostra input de busca e dispara `onSearchChange`
- [ ] `ConversationList` grupos Favoritos/Histórico colapsam independentemente
- [ ] `ConversationList` star toggle dispara callback `onStar`
- [ ] `ConversationList` inline rename funciona (double-click/pencil → input → Enter/Escape)
- [ ] `ConversationList` botão `+` dispara `onCreateRequest`
- [ ] `ConversationList` load more visível quando `hasMore=true`, dispara `onLoadMore`
- [ ] `ConversationList` loading state com 8 Skeletons
- [ ] `ConversationList` empty state com ícone + título + descrição
- [ ] `ConversationList` slots headerExtra, filterExtra, itemBadgesExtra renderizam conteúdo
- [ ] `ConversationBar` mostra título + agent badge
- [ ] `ConversationBar` dropdown: Renomear abre dialog, Exportar dispara callback, Excluir abre dialog
- [ ] `ConversationBar` seta voltar visível quando `onBack` fornecido
- [ ] `ConversationBar` loading state com Skeleton no título
- [ ] `ConversationBar` slots actionsExtra, menuItemsExtra, afterBar renderizam conteúdo
- [ ] `ConversationBar` modo uncontrolled: gerencia dialogs internamente
- [ ] Todos os componentes respeitam tokens shadcn (bg-background, text-foreground, etc.)
- [ ] Build compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-367 Componentes internos (CollapsibleGroup, ConversationListItem, RenameDialog, DeleteDialog) | S-111 | D-018, D-019 |
| F-368 ConversationList — sidebar principal | S-112 | D-020 |
| F-369 ConversationBar — barra de contexto | S-113 | D-021 |
