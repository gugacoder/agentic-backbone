# PRP-25C — Integração: Exports e Hub Refactor

Criar barrel exports dos componentes de conversas no `@codrstudio/agentic-chat` e refatorar o Hub para consumir os novos componentes — reduzindo `conversations-layout.tsx` de ~565 para ~120 linhas e `conversation-chat.tsx` de ~460 para ~100 linhas.

## Execution Mode

`implementar`

## Contexto

### Estado atual

- PRP-25A entregou: primitivos shadcn, tipos, utilitários, hooks
- PRP-25B entregou: ConversationList, ConversationBar, componentes internos
- Componentes existem em `src/conversations/` mas NÃO são exportados na API pública
- Hub implementa toda a UI de conversas inline (~1000 linhas), acoplada a TanStack Router/Query
- `sessionToConversation` no Hub não inclui campo `metadata`

### Estado desejado

- API pública do pacote exporta: `ConversationList`, `ConversationBar`, `useConversations`, `useIsMobile`, `formatRelativeTime`, `buildInitialMessages`, `groupConversations`, tipos
- Hub consome componentes do agentic-chat via slots para features hub-specific
- `conversations-layout.tsx` reduzido para ~120 linhas (composição de ConversationList)
- `conversation-chat.tsx` reduzido para ~100 linhas (composição de ConversationBar + Chat)
- `sessionToConversation` inclui `metadata: { takeover_by, takeover_at }` para uso via slots

### Dependencias

- **PRP-25B** — componentes ConversationList e ConversationBar prontos

## Especificacao

### Feature F-370: Barrel exports — API pública do pacote

**Spec:** S-114

Criar barrel export e atualizar entrada principal do pacote.

#### 1. `src/conversations/index.ts`

```ts
export { ConversationList } from "./ConversationList.js";
export type { ConversationListProps } from "./ConversationList.js";

export { ConversationBar } from "./ConversationBar.js";
export type { ConversationBarProps } from "./ConversationBar.js";

export { useConversations } from "./useConversations.js";
export type { UseConversationsOptions, UseConversationsReturn } from "./useConversations.js";

export { useIsMobile } from "../hooks/useIsMobile.js";

export { formatRelativeTime, buildInitialMessages, groupConversations } from "./utils.js";

export type { Conversation, BackendMessage } from "./types.js";
```

#### 2. Atualizar `src/index.ts`

Adicionar re-exports ao final do arquivo:

```ts
// Conversation management
export {
  ConversationList,
  ConversationBar,
  useConversations,
  useIsMobile,
  formatRelativeTime,
  buildInitialMessages,
  groupConversations,
} from "./conversations/index.js";

export type {
  ConversationListProps,
  ConversationBarProps,
  UseConversationsOptions,
  UseConversationsReturn,
  Conversation,
  BackendMessage,
} from "./conversations/index.js";
```

#### Regras

- Componentes internos (CollapsibleGroup, ConversationListItem, RenameDialog, DeleteDialog) NÃO são exportados
- Extensões `.js` nos imports (ESM)
- Manter exports existentes do pacote intactos

### Feature F-371: Hub conversations-layout refactor

**Spec:** S-115 (seção layout)

Refatorar `apps/hub/src/components/conversations/conversations-layout.tsx` de ~565 para ~120 linhas.

#### 1. Imports

Substituir componentes internos por imports do agentic-chat:

```tsx
import { ConversationList, groupConversations } from "@codrstudio/agentic-chat";
```

#### 2. Remover do arquivo

- Componente `CollapsibleGroup` inline (~30 linhas)
- Componente `ConversationListItem` inline (~115 linhas)
- Função `formatRelativeTime` inline (~15 linhas)
- Toda a lógica de renderização de items e grupos
- Estado de rename inline (renamingId, renameValue)

#### 3. Manter no arquivo

- TanStack Query: `useQuery(conversationsQueryOptions())`, `useQuery(agentsQueryOptions())`
- Mutations: `renameMutation`, `starMutation` (com optimistic update), `createMutation`
- Filtering hub-specific: `agentFilter`, `operatorFilter`, `search`
- Dialog de nova conversa (agent selector) — continua no Hub
- Layout flex com sidebar + Outlet

#### 4. Composição via slots

```tsx
<ConversationList
  conversations={filtered}
  favorites={favorites}
  history={visibleHistory}
  activeId={activeId}
  isLoading={loadingConversations}
  search={search}
  onSearchChange={setSearch}
  searchPlaceholder="Buscar..."
  favoritesLabel="Favoritos"
  historyLabel="Histórico"
  onSelect={(id) => navigate({ to: `${basePath}/${id}` })}
  onRename={(id, title) => renameMutation.mutate({ id, title })}
  onStar={(id, starred) => starMutation.mutate({ id, starred })}
  onCreateRequest={handleNewConversation}
  getAgentLabel={(agentId) => getAgentLabel(agents, agentId)}
  hasMore={history.length > historyLimit}
  onLoadMore={() => setHistoryLimit((l) => l + PAGE_SIZE)}
  remainingCount={history.length - historyLimit}
  loadMoreLabel="Carregar mais"
  emptyTitle="Nenhuma conversa"
  emptyDescription="Inicie uma conversa com um agente."
  headerExtra={
    <Button variant={operatorFilter ? "default" : "ghost"} size="icon" className="size-8 shrink-0"
      onClick={() => setOperatorFilter((v) => !v)} title="Filtrar com operador">
      <User className="size-3.5" />
    </Button>
  }
  filterExtra={!fixedAgentId && filterAgents.length > 1 && <AgentFilterSelect ... />}
  itemBadgesExtra={(conv) =>
    conv.metadata?.takeover_by ? (
      <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
        <User className="mr-0.5 size-2.5" /> Op
      </Badge>
    ) : null
  }
  className={cn(isMobile ? "w-full" : "w-80")}
/>
```

#### 5. Labels em pt-BR

O Hub passa todas as labels em português via props: "Buscar...", "Favoritos", "Histórico", "Carregar mais", "Nenhuma conversa", etc.

#### Regras

- Manter `useIsMobile` do agentic-chat (substituir implementação local se existir)
- Manter TanStack Query mutations — o Hub NÃO usa `useConversations` hook
- Dialog de nova conversa permanece no Hub (agent selector é hub-specific)
- Filtro por agente e filtro por operador permanecem no Hub (lógica hub-specific)
- `Outlet` do TanStack Router permanece (roteamento é responsabilidade do Hub)

### Feature F-372: Hub conversation-chat refactor + mapper

**Spec:** S-115 (seções chat + mapper)

Refatorar `apps/hub/src/components/conversations/conversation-chat.tsx` de ~460 para ~100 linhas e atualizar mapper.

#### 1. Mapper — `apps/hub/src/api/conversations.ts`

Atualizar `sessionToConversation` para incluir `metadata`:

```ts
function sessionToConversation(s: Session): Conversation & { takeover_by: string | null; takeover_at: string | null } {
  return {
    id: s.session_id,
    agentId: s.agent_id,
    title: s.title ?? undefined,
    updatedAt: s.updated_at,
    starred: s.starred === 1,
    takeover_by: s.takeover_by,
    takeover_at: s.takeover_at,
    metadata: {
      takeover_by: s.takeover_by,
      takeover_at: s.takeover_at,
    },
  };
}
```

Campos diretos `takeover_by`/`takeover_at` mantidos para compatibilidade com código Hub existente. Campo `metadata` permite acesso via tipo base `Conversation` do agentic-chat (usado por `itemBadgesExtra`).

#### 2. Imports

```tsx
import { ConversationBar, buildInitialMessages } from "@codrstudio/agentic-chat";
import { Chat } from "@codrstudio/agentic-chat";
```

#### 3. Remover do arquivo

- Função `buildInitialMessages` inline (~120 linhas)
- `RenameDialog` inline
- `DeleteDialog` inline
- Header bar manual (layout, badge, dropdown)
- Dropdown menu manual (MoreVertical, items)

#### 4. Manter no arquivo

- TanStack Query: queries de conversation, session, agents, messages
- Mutations: rename, delete, takeover, release
- `TakeoverButton`, `TakeoverBanner`, `ApprovalInlineActions` — passados via slots
- `OrchestrationSidebar` — continua no Hub
- Lógica de orchestration path

#### 5. Composição via slots

```tsx
<ConversationBar
  title={conversation.title}
  agentLabel={agentLabel}
  onRename={(title) => renameMutation.mutate(title)}
  onExport={handleExport}
  onDelete={() => deleteMutation.mutate()}
  onBack={isMobile ? () => navigate({ to: basePath }) : undefined}
  isPendingRename={renameMutation.isPending}
  isPendingDelete={deleteMutation.isPending}
  renameLabel="Renomear"
  exportLabel="Exportar"
  deleteLabel="Excluir"
  untitledLabel="Sem título"
  actionsExtra={!isUnderTakeover && <TakeoverButton ... />}
  menuItemsExtra={null}
  afterBar={
    <>
      {isUnderTakeover && session?.takeover_by && session?.takeover_at && (
        <TakeoverBanner ... />
      )}
      <ApprovalInlineActions sessionId={id} />
    </>
  }
/>
<Chat
  endpoint=""
  token={token}
  sessionId={id}
  initialMessages={buildInitialMessages(existingMessages)}
  className="flex-1 flex flex-col overflow-hidden"
/>
```

#### 6. Labels em pt-BR

"Renomear", "Exportar", "Excluir", "Sem título".

#### Regras

- `buildInitialMessages` importado do agentic-chat — remover implementação local
- TakeoverButton, TakeoverBanner, ApprovalInlineActions permanecem no Hub
- OrchestrationSidebar permanece no Hub
- `useAuthStore` permanece no Hub (token para Chat)
- Mobile: `onBack` controlado pelo Hub (navega para `basePath`)

## Limites

- **NÃO** mover TakeoverButton/TakeoverBanner/ApprovalInlineActions para agentic-chat — são hub-specific
- **NÃO** mover OrchestrationSidebar para agentic-chat — é hub-specific
- **NÃO** mover dialog de nova conversa (agent selector) para agentic-chat — é hub-specific
- **NÃO** alterar a API do backend — componentes consomem a API existente
- **NÃO** alterar a API pública do Chat/MessageList/MessageInput — são independentes
- **NÃO** remover TanStack Query do Hub — continua sendo o data layer do Hub
- **NÃO** criar agent selector no agentic-chat — cada app tem seu próprio fluxo de criação

## Validacao

### Checklist — agentic-chat exports

- [ ] `src/conversations/index.ts` criado com todos os exports públicos
- [ ] `src/index.ts` atualizado com re-exports de conversations
- [ ] Componentes internos NÃO exportados na API pública
- [ ] `import { ConversationList, ConversationBar, ... } from "@codrstudio/agentic-chat"` funciona

### Checklist — Hub refactor

- [ ] Sidebar de conversas funciona idêntico ao atual
- [ ] Busca por título funciona
- [ ] Filtro por agente funciona
- [ ] Filtro por operador funciona
- [ ] Star/unstar com optimistic update funciona
- [ ] Inline rename na sidebar funciona
- [ ] Nova conversa (dialog com agent selector) funciona
- [ ] Barra de contexto mostra título + agente
- [ ] Menu: Renomear, Exportar, Excluir funcionam
- [ ] TakeoverButton aparece no slot `actionsExtra`
- [ ] TakeoverBanner aparece no slot `afterBar`
- [ ] ApprovalInlineActions aparece no slot `afterBar`
- [ ] Orchestration sidebar continua funcionando
- [ ] Mobile: sidebar esconde quando chat ativo, seta voltar funciona
- [ ] `sessionToConversation` inclui campo `metadata` com takeover_by/takeover_at
- [ ] `npm run build` compila sem erro em ambos os pacotes
- [ ] `npm run dev:all` funciona sem regressão

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-370 Barrel exports — API pública | S-114 | D-022 |
| F-371 Hub conversations-layout refactor | S-115 | D-023 |
| F-372 Hub conversation-chat refactor + mapper | S-115 | D-024, D-025 |
