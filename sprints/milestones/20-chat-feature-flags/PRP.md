# PRP 20 — ai-chat: Feature flags para configuracao do componente Chat

Adicionar props de configuracao ao `<Chat>` do pacote `@agentic-backbone/ai-chat` para controlar visibilidade de reasoning, upload, gravacao de audio, seletor de agente e modo compacto do badge.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

O `<Chat>` (PRP 16) expoe duas feature flags:

| Prop | Default | Funciona |
|---|---|---|
| `enableAttachments` | `false` | Parcial — guarda PlusMenu e drag/drop, mas **nao** guarda paste de arquivos |
| `enableVoice` | `false` | Sim |

Reasoning blocks (`ReasoningBlock.tsx`) sao renderizados sempre. Durante streaming, expandem automaticamente. Ao finalizar, colapsam mas **permanecem visiveis** no chat.

O seletor de agente (`AgentBadge`) aparece sempre que ha multiplos endpoints. Nao ha modo compacto.

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Reasoning pos-stream | Colapsa mas permanece visivel | Desaparece (default). `keepReasoning=true` mantem |
| Upload (paste) | Paste de arquivos funciona mesmo com `enableAttachments=false` | Paste respeitado pelo flag |
| Seletor de agente | Sempre visivel se `endpoints.length > 1` | Controlado por `showAgentSelector` |
| Badge do agente | Sempre mostra avatar + nome + chevron | `compactAgentSelector=true` mostra so avatar |

---

## Especificacao

### 1. Novas props — `ChatProps`

#### 1.1 Arquivo: `apps/packages/ai-chat/src/components/Chat.tsx`

Adicionar ao `ChatProps`:

```typescript
export interface ChatProps {
  // ... props existentes ...
  keepReasoning?: boolean;        // default false
  showAgentSelector?: boolean;    // default true
  compactAgentSelector?: boolean; // default false
}
```

`enableAttachments` e `enableVoice` ja existem — nao criar novas.

Passar as novas props de `Chat` → `ChatContent` → componentes filhos via props diretas (mesmo pattern atual — sem context).

---

### 2. `keepReasoning` — reasoning desaparece ao finalizar

#### 2.1 Arquivo: `apps/packages/ai-chat/src/parts/PartRenderer.tsx`

Adicionar `keepReasoning?: boolean` ao `PartRendererProps`.

No case `"reasoning"`: quando `keepReasoning === false` (ou undefined) e `isStreaming === false`, retornar `null`.

```typescript
case "reasoning": {
  const p = part as ReasoningPart;
  if (!keepReasoning && !isStreaming) return null;
  return <ReasoningBlock content={p.reasoning} isStreaming={isStreaming} />;
}
```

#### 2.2 Arquivo: `apps/packages/ai-chat/src/components/MessageBubble.tsx`

Adicionar `keepReasoning?: boolean` ao `MessageBubbleProps`. Passar para `<PartRenderer>`.

#### 2.3 Arquivo: `apps/packages/ai-chat/src/components/MessageList.tsx`

Adicionar `keepReasoning?: boolean` ao `MessageListProps`. Passar para `<MessageBubble>`.

#### 2.4 Fluxo completo

```
Chat(keepReasoning) → ChatContent → MessageList → MessageBubble → PartRenderer → ReasoningBlock | null
```

---

### 3. `enableAttachments` — corrigir paste

#### 3.1 Arquivo: `apps/packages/ai-chat/src/components/MessageInput.tsx`

Linha 525: `onPaste={handlePaste}` — hoje o paste nao respeita `enableAttachments`.

Corrigir para:

```typescript
onPaste={enableAttachments ? handlePaste : undefined}
```

Nenhuma outra alteracao necessaria — drag/drop e PlusMenu ja estao corretos.

---

### 4. `showAgentSelector` — ocultar badge, manter @mention

#### 4.1 Arquivo: `apps/packages/ai-chat/src/components/MessageInput.tsx`

Adicionar `showAgentSelector?: boolean` ao `MessageInputProps` (default `true`).

Condicionar o render do `<AgentBadge>` (linhas 515-517):

```typescript
{showAgentSelector && hasMultipleEndpoints && activeEndpoint && (
  <AgentBadge ... />
)}
```

A logica de `@mention` (linhas 273-275) e `AgentDropdown` (linhas 473-482) permanecem inalteradas — continuam funcionando independente do badge.

---

### 5. `compactAgentSelector` — badge so com avatar

#### 5.1 Arquivo: `apps/packages/ai-chat/src/components/MessageInput.tsx`

Adicionar `compactAgentSelector?: boolean` ao `MessageInputProps` (default `false`).

Passar para `AgentBadge` como prop `compact`.

No `AgentBadge`, quando `compact=true`:
- Renderizar apenas o avatar (circulo com imagem ou inicial)
- Remover label (`<span>` com nome)
- Remover chevron (`<svg>`)
- Reduzir padding (de `px-2.5 py-1` para `p-0.5`)
- Manter o `onClick` para abrir dropdown

---

## Limites

### NAO fazer

- Nao criar Context/Provider para as novas props — usar prop drilling (pattern atual)
- Nao alterar a API de `enableAttachments`/`enableVoice` — apenas corrigir o bug de paste
- Nao persistir `keepReasoning` em sessao/localStorage — eh efemero
- Nao alterar estilos do ReasoningBlock — apenas condicionar render no PartRenderer
- Nao adicionar animacao de fade-out no reasoning — simplesmente nao renderizar

### Observacoes

- `compactAgentSelector` so faz sentido quando `showAgentSelector=true` (combinacao implicita)
- O default de `enableAttachments` permanece `false` (como esta hoje)

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Adicionar props ao `ChatProps` e `ChatContentProps` em `Chat.tsx` | nada |
| 2a | `keepReasoning`: propagar por `MessageList` → `MessageBubble` → `PartRenderer` | fase 1 |
| 2b | `enableAttachments`: corrigir paste em `MessageInput.tsx` | nada |
| 2c | `showAgentSelector` + `compactAgentSelector`: alterar `MessageInput.tsx` e `AgentBadge` | fase 1 |
| 3 | Build (`npm run build:packages`) e validacao visual | fases 2a-c |

Fases 2a, 2b e 2c sao independentes — podem ser executadas em paralelo.
