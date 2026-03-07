# PRP-04 — Chat e Conversas

Interface de chat em tempo real para conversar com agentes, visualizar historico e gerenciar sessoes de conversa.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem scaffold (PRP-01), dashboard de agentes (PRP-02) com botao "Nova Conversa" que cria sessao e navega. A pagina `/conversations` existe como placeholder. O backbone expoe:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/conversations` | Listar sessoes (filtro por agent_id, user_id) |
| POST | `/conversations` | Criar sessao (`{ agentId, userId }`) |
| GET | `/conversations/:sessionId` | Detalhes da sessao |
| GET | `/conversations/:sessionId/messages` | Historico de mensagens |
| POST | `/conversations/:sessionId/messages` | Enviar mensagem (SSE stream response) |
| PATCH | `/conversations/:sessionId` | Atualizar sessao (titulo) |
| DELETE | `/conversations/:sessionId` | Excluir sessao |
| GET | `/conversations/:sessionId/export` | Exportar conversa |

O streaming de resposta usa `lib/chat-stream.ts` (`streamMessage()`) que consome SSE com eventos `init`, `text`, `result`, `usage`.

### Estado desejado

1. Lista de conversas com busca e filtro por agente
2. Chat view com streaming em tempo real
3. Gerenciamento de sessoes (renomear, exportar, excluir)

## Especificacao

### Feature F-016: Lista de conversas

**Substituir placeholder** `routes/_authenticated/conversations.tsx`:

- Fetch via `conversationsQueryOptions()` (loader)
- Lista vertical (nao grid — conversas sao lineares)

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Agente | `session.agent_id` | Badge com nome do agente |
| Titulo | `session.title` | Texto (ou "Sem titulo" em muted) |
| Ultima mensagem | preview | Texto truncado (1 linha) |
| Data | `session.updated_at` | Timestamp relativo ("ha 5 min") |

**Barra de acoes (PageHeader):**
- Busca por titulo (client-side filter)
- Filtro por agente (Select com agentes disponiveis)
- Botao "Nova Conversa" → dialog para escolher agente → `POST /conversations` → navega para `/conversations/:id`

**Comportamento:**
- Click na conversa → navega para `/conversations/:id`
- Ordenacao: mais recente primeiro (por `updated_at`)
- SSE `channel:message` → invalida query `["conversations"]`

### Feature F-017: Chat view com streaming

**routes/_authenticated/conversations.$id.tsx:**

- Fetch sessao via `conversationQueryOptions(id)` (loader)
- Fetch historico via `GET /conversations/:id/messages`

**Layout:**

```
+------header---------------+
| <- Voltar | Agente: nome   | [menu]
+----------------------------+
|                            |
|  [msg assistant]           |
|           [msg user]       |
|  [msg assistant]           |
|  [streaming...]            |
|                            |
+----------------------------+
| [input________________] [>]|
+----------------------------+
```

**Header:**
- Botao voltar (mobile: `<-`, desktop: breadcrumb Conversas > Titulo)
- Nome do agente (badge)
- Menu dropdown: Renomear, Exportar, Excluir

**components/chat/message-list.tsx:**

```typescript
interface MessageListProps {
  messages: ChatMessage[];
  streamingContent?: string;
}
```

- Scroll reverso (mais recente embaixo)
- Auto-scroll para ultima mensagem ao receber novo conteudo
- Botao "scroll to bottom" quando usuario scrollou para cima
- ScrollArea do shadcn

**components/chat/message-bubble.tsx:**

```typescript
interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}
```

- Assistant: alinhado a esquerda, cor neutra (muted background)
- User: alinhado a direita, cor primary
- Markdown renderizado via `react-markdown` com syntax highlighting para blocos de codigo (instalar `react-markdown` e `react-syntax-highlighter` ou `shiki`)
- Timestamps discretos entre blocos de mensagens (quando gap > 5 min)
- Botao de copia discreto no hover

**Streaming:**
- Envio: `POST /conversations/:id/messages` com `{ content }` via `streamMessage()` de `lib/chat-stream.ts`
- Concatenar eventos `text` para exibir streaming caracter a caracter
- Evento `result` substitui o conteudo streaming pela mensagem final
- Evento `usage` armazena metricas (para exibicao futura)
- `AbortController` para cancelar streaming

**components/chat/streaming-indicator.tsx:**
- Cursor piscante (`|`) no final do texto streaming
- Exibido enquanto streaming esta ativo

### Feature F-018: Input de mensagem

**components/chat/message-input.tsx:**

```typescript
interface MessageInputProps {
  onSend: (content: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}
```

- Textarea expansivel (1 a 5 linhas, auto-resize)
- Enter envia mensagem, Shift+Enter insere nova linha
- Botao enviar (icone Send) — desabilitado se vazio ou streaming
- Durante streaming: botao muda para "Parar" (icone Square) que chama `onAbort()`
- Desabilitado enquanto streaming (nao pode enviar duas msgs simultaneas)
- Focus automatico ao abrir chat
- Placeholder: "Digite sua mensagem..."

### Feature F-019: Gerenciamento de sessoes

**Renomear:**
- Menu dropdown → "Renomear" → dialog com input para novo titulo
- `PATCH /conversations/:id` com `{ title }`
- Invalida queries `["conversations"]` e `["conversations", id]`

**Exportar:**
- Menu dropdown → "Exportar"
- `GET /conversations/:id/export` → download do arquivo retornado
- Usar `window.open()` ou `fetch` + `Blob` + `URL.createObjectURL`

**Excluir:**
- Menu dropdown → "Excluir"
- `ConfirmDialog` com mensagem "Esta conversa sera removida permanentemente."
- `DELETE /conversations/:id`
- Invalida `["conversations"]`, navega para `/conversations`

**Tab Conversas no detalhe do agente (PRP-02):**
- Substituir placeholder da tab "Conversas" em `agents.$id.tsx`
- Fetch conversas filtradas por agente: `GET /conversations?agent_id=:id`
- Mesma lista da pagina `/conversations` mas filtrada
- Click navega para `/conversations/:sessionId`

## Limites

- **NAO** implementar mensagens de midia (imagens, audio, video) — apenas texto e markdown.
- **NAO** implementar threading ou reply — conversas sao lineares.
- **NAO** implementar notificacoes push — apenas SSE no hub.
- **NAO** implementar paginacao infinita no historico — carregar todas as mensagens de uma vez (sessoes raramente excedem centenas de mensagens).
- **NAO** implementar typing indicators entre usuarios — apenas streaming do agente.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-02** (Dashboard de Agentes) deve estar implementado — tab Conversas vive no detalhe do agente.

## Validacao

- [ ] Lista de conversas carrega sessoes do backbone
- [ ] Busca por titulo filtra conversas
- [ ] Filtro por agente funciona
- [ ] Nova conversa cria sessao e abre chat
- [ ] Mensagem enviada aparece como bubble do usuario imediatamente
- [ ] Resposta do agente aparece em streaming (caracter a caracter)
- [ ] Markdown renderiza corretamente (headers, listas, codigo com syntax highlight)
- [ ] Botao abort cancela streaming em andamento
- [ ] Enter envia, Shift+Enter insere nova linha
- [ ] Historico de mensagens carrega ao abrir conversa existente
- [ ] Renomear conversa atualiza titulo na UI
- [ ] Excluir conversa pede confirmacao e redireciona para lista
- [ ] Exportar conversa baixa arquivo
- [ ] Auto-scroll funciona durante streaming
- [ ] Botao scroll-to-bottom aparece quando usuario scrollou para cima
- [ ] Layout responsivo: tela cheia em mobile
- [ ] Tab Conversas no agente mostra conversas filtradas
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-016 Lista conversas | S-004 sec 3.1 | D-005 (visao unificada) |
| F-017 Chat streaming | S-004 sec 3.2, 3.3 | G-001, D-004, D-001 |
| F-018 Message input | S-004 sec 3.2 | G-001 |
| F-019 Gerenciamento | S-004 sec 3.1 | G-008, D-009 (auditabilidade) |
