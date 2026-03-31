# Guest Agent — Snippets de referencia

Codigo removido do `@agentic-backbone/ai-chat` em 2026-03-31 durante limpeza do componente `<Chat>`.

Essas props e componentes implementavam o seletor de agentes — UI para escolher um agente diferente dentro de uma conversa. Foram removidos porque nunca estiveram conectados ao fluxo real (o `activeAgent` era estado local, nao influenciava o POST). Sao referencia para quando a feature guest-agent for implementada.

---

## Props removidas

### ChatProps / ChatContentProps (Chat.tsx)

```typescript
endpoints?: AgentEndpoint[];      // lista de agentes disponiveis
defaultAgent?: string;            // agente selecionado por default
showAgentSelector?: boolean;      // default true — mostra badge do agente
compactAgentSelector?: boolean;   // default false — badge so com avatar
```

### MessageInputProps (MessageInput.tsx)

```typescript
endpoints?: AgentEndpoint[];
activeEndpoint?: string;
onEndpointChange?: (id: string) => void;
showAgentSelector?: boolean;
compactAgentSelector?: boolean;
```

---

## Tipo AgentEndpoint (MessageInput.tsx)

```typescript
export interface AgentEndpoint {
  id: string;
  label: string;
  avatar?: string;
}
```

---

## Estado do agente ativo (ChatContent em Chat.tsx)

```typescript
const [activeAgent, setActiveAgent] = React.useState(defaultAgent ?? endpoints?.[0]?.id ?? "");
```

Passava para MessageInput como:

```tsx
<MessageInput
  endpoints={endpoints}
  activeEndpoint={activeAgent}
  onEndpointChange={setActiveAgent}
  showAgentSelector={showAgentSelector}
  compactAgentSelector={compactAgentSelector}
/>
```

---

## Componente AgentBadge (MessageInput.tsx)

Botao clicavel que mostra o agente ativo. Modo normal (avatar + label + chevron) e compacto (so avatar).

```tsx
function AgentBadge({ endpoints, activeId, compact = false, onClick }: { endpoints: AgentEndpoint[]; activeId: string; compact?: boolean; onClick: () => void }) {
  const active = endpoints.find((e) => e.id === activeId) ?? endpoints[0];
  if (!active) return null;

  const avatar = active.avatar ? (
    <img src={active.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
  ) : (
    <span className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-semibold">
      {active.label.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center rounded-full border border-border/50 bg-background/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer",
        compact ? "p-1" : "gap-1.5 px-2.5 py-1",
      )}
    >
      {avatar}
      {!compact && <span className="max-w-[80px] truncate">{active.label}</span>}
      {!compact && <svg className="h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );
}
```

---

## Componente AgentDropdown (MessageInput.tsx)

Dropdown compartilhado entre clique no badge e @mention. Filtra agentes por query.

```tsx
function AgentDropdown({ endpoints, activeId, query, highlightIndex, onSelect, onClose }: {
  endpoints: AgentEndpoint[];
  activeId: string;
  query: string;
  highlightIndex: number;
  onSelect: (ep: AgentEndpoint) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? endpoints.filter((ep) => ep.label.toLowerCase().includes(query) || ep.id.toLowerCase().includes(query))
    : endpoints;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div ref={menuRef} className="absolute bottom-full left-0 right-0 mb-1 mx-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1 z-20">
      {filtered.map((ep, i) => (
        <button
          key={ep.id}
          type="button"
          onClick={() => onSelect(ep)}
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
            i === highlightIndex ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
          )}
        >
          {ep.avatar ? (
            <img src={ep.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
          ) : (
            <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-semibold">
              {ep.label.charAt(0).toUpperCase()}
            </span>
          )}
          <span>{ep.label}</span>
          <span className="text-xs text-muted-foreground/50 ml-auto">{ep.id}</span>
        </button>
      ))}
    </div>
  );
}
```

---

## Logica de @mention e dropdown no MessageInput

Estado e derivados:

```typescript
const [mentionIndex, setMentionIndex] = useState(0);
const [showAgentDropdown, setShowAgentDropdown] = useState(false);

const hasMultipleEndpoints = !!(endpoints && endpoints.length > 1 && onEndpointChange);
const hasMention = hasMultipleEndpoints && input.startsWith("@");
const agentDropdownOpen = hasMention || showAgentDropdown;
const agentQuery = hasMention ? input.slice(1).toLowerCase() : "";
```

Funcoes de selecao/fechamento:

```typescript
function selectAgent(ep: AgentEndpoint) {
  onEndpointChange!(ep.id);
  if (hasMention) setInput("");
  setMentionIndex(0);
  setShowAgentDropdown(false);
  textareaRef.current?.focus();
}

function closeAgentDropdown() {
  setShowAgentDropdown(false);
  if (hasMention) setInput("");
  setMentionIndex(0);
}
```

Navegacao por teclado no handleKeyDown:

```typescript
if (agentDropdownOpen && hasMultipleEndpoints) {
  const filtered = agentQuery
    ? endpoints!.filter((ep) => ep.label.toLowerCase().includes(agentQuery) || ep.id.toLowerCase().includes(agentQuery))
    : endpoints!;
  if (filtered.length > 0) {
    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectAgent(filtered[mentionIndex]); return; }
  }
  if (e.key === "Escape") { e.preventDefault(); closeAgentDropdown(); return; }
}
```

Render do dropdown e badge no JSX:

```tsx
{/* Agent dropdown */}
{agentDropdownOpen && hasMultipleEndpoints && (
  <AgentDropdown
    endpoints={endpoints!}
    activeId={activeEndpoint!}
    query={agentQuery}
    highlightIndex={mentionIndex}
    onSelect={selectAgent}
    onClose={closeAgentDropdown}
  />
)}

{/* Agent badge */}
{showAgentSelector && hasMultipleEndpoints && activeEndpoint && (
  <AgentBadge endpoints={endpoints!} activeId={activeEndpoint} compact={compactAgentSelector} onClick={() => setShowAgentDropdown(!showAgentDropdown)} />
)}
```
