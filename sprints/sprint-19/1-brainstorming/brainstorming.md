# Brainstorming — Sprint 19

## Contexto

**PRP 25 — agentic-chat: Componentes de gerenciamento de conversas**

O objetivo é extrair toda a UI de gerenciamento de sessões de chat que hoje vive acoplada ao Hub (TanStack Router + TanStack Query) e publicá-la como componentes reutilizáveis controlados no pacote `@codrstudio/agentic-chat`. Com isso, qualquer consumidor (app chat standalone, terceiros) pode gerenciar conversas sem reimplementar ~1000 linhas de UI.

**Repositórios envolvidos:**
- `D:\sources\codr.studio\agentic-chat` — biblioteca de componentes (alvo das fases 1–5)
- `D:\sources\_unowned\agentic-backbone` — Hub consumidor (alvo da fase 6)

---

## Funcionalidades mapeadas

### `@codrstudio/agentic-chat` (estado atual)

Já implementados:
- `Chat`, `MessageList`, `MessageInput`, `MessageBubble` — chat em si
- 19 display renderers (AlertRenderer, MetricCardRenderer, CodeBlockRenderer, etc.)
- 2 hooks: `useBackboneChat`, `ChatProvider`
- 10 primitivos shadcn: `alert`, `badge`, `button`, `card`, `collapsible`, `dialog`, `progress`, `scroll-area`, `separator`, `table`
- Dependências Radix: `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`

**Ausente:** qualquer componente de gerenciamento de conversas/sessões.

### Hub — `apps/hub/src/components/conversations/`

Dois arquivos monolíticos:
- `conversations-layout.tsx` — 565 linhas: sidebar com busca, grupos colapsáveis (Favoritos / Histórico), star/rename inline, filtro por agente, filtro por operador, paginação ("load more"), empty state
- `conversation-chat.tsx` — 459 linhas: barra de contexto no topo com título + agente, dropdown menu (renomear/exportar/excluir), dialogs inline, `buildInitialMessages` (função de 120+ linhas que converte mensagens do backend para formato ai-sdk), TakeoverButton/TakeoverBanner, ApprovalInlineActions, OrchestrationSidebar

Hub-specific (permanecem no Hub):
- `takeover-button.tsx`, `takeover-banner.tsx` — feature backbone
- `feedback-reason-popover.tsx`, `message-feedback.tsx` — feature backbone
- `operator-message.tsx` — feature backbone

### Primitivos faltantes no agentic-chat

| Primitivo | Uso |
|---|---|
| `Input` | Campo de busca, rename inline |
| `DropdownMenu` | Menu de ações da ConversationBar |
| `Skeleton` | Loading states |

**Nova dependência necessária:** `@radix-ui/react-dropdown-menu: ^2`

---

## Lacunas e oportunidades

1. **Zero gerenciamento de sessões no agentic-chat** — qualquer app que precisar de lista de conversas reimplementa ~1000 linhas.

2. **`buildInitialMessages` hardcoded no Hub** — função crítica de transformação de mensagens (backend → ai-sdk) não está disponível para outros consumidores. Um app standalone que queira mostrar histórico precisa reimplementá-la.

3. **Primitivos shadcn incompletos** — faltam `Input`, `DropdownMenu`, `Skeleton` para suportar os novos componentes.

4. **Sem hook standalone** — quem não usa TanStack Query não tem como fazer fetch de conversas sem implementar tudo do zero.

5. **Acoplamento a TanStack Router** — `ConversationList` e `ConversationBar` no Hub usam `useNavigate`, `useSearch`, `Outlet` — impossível reutilizar fora do Hub.

6. **`formatRelativeTime` e `groupConversations` não exportados** — utilitários úteis para qualquer consumer, hoje presos no Hub.

7. **`useIsMobile` não disponível como hook compartilhado** — duplicado em múltiplos apps.

8. **Sem slots de extensão nos componentes** — features hub-specific (takeover badge, operator filter) precisam de pontos de injeção para não vazar para a biblioteca.

9. **Labels hardcoded em pt-BR no Hub** — componentes devem ter defaults em inglês com override via props para internacionalização.

10. **`sessionToConversation` mapper sem campo `metadata`** — hub-specific fields (`takeover_by`, `takeover_at`) não têm canal de extensão limpo para os slots dos componentes.

---

## Priorização

| ID | Discovery | Score | Justificativa |
|---|---|---|---|
| D-014 | Primitivos shadcn (Input, DropdownMenu, Skeleton) + nova dep | 10 | Desbloqueador absoluto — nenhum componente de conversas compila sem esses primitivos. Zero risco, implementação mecânica. |
| D-015 | Tipos e utilitários (Conversation, BackendMessage, formatRelativeTime, buildInitialMessages, groupConversations) | 10 | Desbloqueador de todas as fases 3–6. buildInitialMessages é a função de maior valor: elimina duplicação crítica entre Hub e futuros consumers. |
| D-016 | Hook `useIsMobile` | 8 | Utilitário simples, zero dependências, reutilizável imediatamente. Desbloqueador para responsividade no Hub refactor. |
| D-017 | Hook `useConversations` (standalone, sem TanStack Query) | 8 | Habilita uso do agentic-chat em apps sem data layer próprio (ex: chat standalone). Usa apenas `useState` + `fetch` — sem novas dependências. |
| D-018 | `CollapsibleGroup` + `ConversationListItem` (componentes internos) | 9 | Blocos construtores da `ConversationList`. Extraídos diretamente do Hub — lógica já validada em produção. |
| D-019 | `RenameDialog` + `DeleteDialog` (componentes internos) | 8 | Dialogs reutilizados por `ConversationList` e `ConversationBar`. Dependem do primitivo `Dialog` já existente. |
| D-020 | `ConversationList` (componente principal da sidebar) | 10 | Componente de maior impacto — representa ~300 linhas removidas do Hub. Slots de extensão (`headerExtra`, `filterExtra`, `itemBadgesExtra`) garantem que features hub-specific não vazem para a biblioteca. |
| D-021 | `ConversationBar` (barra de contexto no topo do chat) | 9 | Segunda maior redução — ~200 linhas removidas do Hub. Slots `actionsExtra`, `menuItemsExtra`, `afterBar` mantêm TakeoverButton/TakeoverBanner no Hub. |
| D-022 | Barrel exports (`src/conversations/index.ts` + atualizar `src/index.ts`) | 7 | Integração final no pacote. Garante API pública limpa e consistente com o restante do agentic-chat. |
| D-023 | Hub refactor — `conversations-layout.tsx` (565 → ~120 linhas) | 9 | Redução drástica de acoplamento. Validação do design: se os slots funcionarem, o Hub não perde nenhuma feature (operator filter, agent filter, takeover badge). |
| D-024 | Hub refactor — `conversation-chat.tsx` (459 → ~100 linhas) | 9 | Elimina `buildInitialMessages` duplicado, dialogs inline, header bar manual. Valida a ConversationBar com os slots `actionsExtra`/`afterBar`. |
| D-025 | Hub — `api/conversations.ts`: adicionar campo `metadata` ao `sessionToConversation` | 6 | Ajuste de mapeamento necessário para que `itemBadgesExtra` do Hub possa ler `conv.metadata.takeover_by`. Mudança pequena, impacto pontual. |
