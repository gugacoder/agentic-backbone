# AB Hub - Chat e Conversas

Interface de chat em tempo real para conversar com agentes, visualizar historico e intervir em conversas autonomas.

---

## 1. Objetivo

- Chat com agentes via streaming SSE (texto aparece em tempo real)
- Listar e gerenciar sessoes de conversa
- Visualizar historico de mensagens com markdown renderizado
- Permitir ao operador intervir/assumir conversas do agente
- Resolver G-001 (atendimento 24/7), D-004 (governanca), G-008 (auditabilidade)

---

## 2. API Endpoints Existentes

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

SSE: evento `channel:message` para mensagens de canais externos.

---

## 3. Telas

### 3.1 Lista de Conversas (`/conversations`)

**Layout:** Lista vertical com busca.

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Agente | `session.agent_id` | Badge com nome do agente |
| Titulo | `session.title` | Texto (ou "Sem titulo") |
| Ultima mensagem | preview da ultima msg | Texto truncado |
| Data | `session.updated_at` | Timestamp relativo |

**Acoes:**
- Busca por titulo ou agente
- Filtro por agente (select)
- Botao "Nova Conversa" → dialog para escolher agente → cria sessao → navega para chat
- Swipe-to-delete em mobile (com confirmacao)

### 3.2 Chat (`/conversations/:id`)

**Layout:** Tela cheia com header, area de mensagens e input.

```
+------header---------------+
| <- Voltar | Agente: nome   |
+----------------------------+
|                            |
|  [msg assistant]           |
|           [msg user]       |
|  [msg assistant]           |
|  [streaming indicator]     |
|                            |
+----------------------------+
| [input________________] [>]|
+----------------------------+
```

**Header:**
- Botao voltar (mobile) ou breadcrumb (desktop)
- Nome do agente
- Menu: renomear, exportar, excluir

**Area de Mensagens:**
- Scroll reverso (mais recente embaixo)
- Bubbles: esquerda (assistant, cor neutra), direita (user, cor primary)
- Markdown renderizado nas mensagens do assistant
- Timestamps discretos entre blocos de mensagens
- Streaming indicator: texto aparecendo caractere a caractere + "digitando..."

**Input:**
- Textarea expansivel (1-5 linhas)
- Enviar com Enter (Shift+Enter para nova linha)
- Botao enviar desabilitado enquanto streaming
- Abort button durante streaming

### 3.3 Streaming

O envio de mensagem usa `POST /conversations/:sessionId/messages` que retorna SSE stream:

```
event: init
data: {"type":"init","sessionId":"..."}

event: text
data: {"type":"text","content":"Ola"}

event: text
data: {"type":"text","content":", como posso"}

event: result
data: {"type":"result","content":"Ola, como posso ajudar?"}

event: usage
data: {"type":"usage","usage":{...}}
```

- Concatenar `text` events para exibir streaming
- `result` contem a mensagem final completa
- `usage` contem metricas de tokens/custo
- Suportar `AbortController` para cancelar streaming

---

## 4. Componentes

### 4.1 MessageBubble

**Localizacao:** `components/chat/message-bubble.tsx`

```typescript
interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}
```

- Renderiza markdown via react-markdown (com syntax highlighting para codigo)
- Copia texto com botao discreto no hover

### 4.2 MessageInput

**Localizacao:** `components/chat/message-input.tsx`

```typescript
interface MessageInputProps {
  onSend: (content: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}
```

### 4.3 MessageList

**Localizacao:** `components/chat/message-list.tsx`

```typescript
interface MessageListProps {
  messages: ChatMessage[];
  streamingContent?: string;
}
```

- Auto-scroll para ultima mensagem
- Scroll-to-bottom button quando usuario scrollou para cima

### 4.4 StreamingIndicator

**Localizacao:** `components/chat/streaming-indicator.tsx`

- Cursor piscante no final do texto streaming
- "Digitando..." com animacao de dots

---

## 5. Criterios de Aceite

- [ ] Lista de conversas carrega sessoes do backbone com paginacao
- [ ] Nova conversa cria sessao e abre chat
- [ ] Mensagem enviada aparece como bubble do usuario imediatamente
- [ ] Resposta do agente aparece em streaming (caractere a caractere)
- [ ] Markdown na resposta renderiza corretamente (headers, listas, codigo)
- [ ] Botao abort cancela streaming em andamento
- [ ] Historico de mensagens carrega ao abrir conversa existente
- [ ] Renomear conversa atualiza titulo
- [ ] Excluir conversa pede confirmacao e redireciona para lista
- [ ] Exportar conversa baixa arquivo
- [ ] Layout responsivo: tela cheia em mobile, panel em desktop
- [ ] Scroll automatico para ultima mensagem
- [ ] Enter envia, Shift+Enter insere nova linha

---

## 6. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Chat Streaming | G-001 (atendimento 24/7), D-004 (governanca — intervir na conversa) |
| Historico | G-008, D-009 (auditabilidade) |
| MessageBubble | D-001 (visibilidade do que o agente responde) |
| Lista Conversas | D-005 (visao unificada) |
