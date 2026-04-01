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
  showAgentSelector?: boolean;    // default true
  compactAgentSelector?: boolean; // default false
}
```

`enableAttachments` e `enableVoice` ja existem — nao criar novas.

Passar as novas props de `Chat` → `ChatContent` → componentes filhos via props diretas (mesmo pattern atual — sem context).

---

### 2. ~~`keepReasoning`~~ — DESCARTADA

Esta feature flag foi planejada mas descartada durante a implementacao. Reasoning blocks agora sempre permanecem visiveis apos o streaming — sem condicional, sem prop. O comportamento e fixo: renderiza sempre.

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
- Nao alterar estilos do ReasoningBlock

### Observacoes

- `compactAgentSelector` so faz sentido quando `showAgentSelector=true` (combinacao implicita)
- O default de `enableAttachments` permanece `false` (como esta hoje)

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Adicionar props ao `ChatProps` e `ChatContentProps` em `Chat.tsx` | nada |
| 2a | `enableAttachments`: corrigir paste em `MessageInput.tsx` | nada |
| 2b | `showAgentSelector` + `compactAgentSelector`: alterar `MessageInput.tsx` e `AgentBadge` | fase 1 |
| 3 | Build (`npm run build:packages`) e validacao visual | fases 2a-b |

Fases 2a e 2b sao independentes — podem ser executadas em paralelo.
