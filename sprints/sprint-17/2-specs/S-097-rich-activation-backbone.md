# S-097 — Pipeline de Ativação Rich Content no Backbone

Implementar o pipeline completo de ativação de conteúdo rico no backbone: ler `rich` do query param, propagar pela cadeia sendMessage → assemblePrompt, injetar prompt de display tools, e passar `disableDisplayTools` ao ai-sdk.

**Resolve:** D-003, D-004, D-005, D-006
**Score de prioridade:** 8
**Dependência:** S-096 (flag `disableDisplayTools` no ai-sdk)
**PRP:** 23 — Rich Response: Display Domain Tools + Ativação por Cliente

---

## 1. Objetivo

Hoje o backbone não tem mecanismo para ativar display tools condicionalmente. Esta spec implementa a cadeia completa:

```
HTTP query param ?rich=true
  → conversations.ts lê o param
  → sendMessage() recebe opts.rich
  → assemblePrompt() injeta RICH_CONTENT_PROMPT quando rich=true
  → instrumentedRunAgent() recebe disableDisplayTools: !rich
```

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/routes/conversations.ts`

Na rota `POST /conversations/:sessionId/messages`, ler o query param `rich` e passá-lo para `sendMessage()`.

**Localização:** Onde `effectiveMessage` é construído (antes das chamadas a `sendMessage`).

```typescript
const rich = c.req.query("rich") === "true";
```

Nos dois call sites de `sendMessage` (linhas ~342 e ~374), adicionar `{ rich }` como quarto argumento:

**Antes:**
```typescript
for await (const event of sendMessage(auth.user, sessionId, effectiveMessage)) {
```

**Depois:**
```typescript
for await (const event of sendMessage(auth.user, sessionId, effectiveMessage, { rich })) {
```

### 2.2 Arquivo: `apps/backbone/src/conversations/index.ts`

#### 2.2.1 Assinatura de `sendMessage()`

Adicionar quarto parâmetro `opts?`:

**Antes:**
```typescript
export async function* sendMessage(
  userId: string,
  sessionId: string,
  content: string | ContentPart[]
): AsyncGenerator<AgentEvent> {
```

**Depois:**
```typescript
export async function* sendMessage(
  userId: string,
  sessionId: string,
  content: string | ContentPart[],
  opts?: { rich?: boolean }
): AsyncGenerator<AgentEvent> {
```

#### 2.2.2 Propagar `rich` para `assemblePrompt()`

Na chamada a `assemblePrompt()` (linha ~425):

**Antes:**
```typescript
const assembled = await assemblePrompt(effectiveAgentId, "conversation", {
  userMessage: message,
  channelId: session.channel_id ?? undefined,
});
```

**Depois:**
```typescript
const assembled = await assemblePrompt(effectiveAgentId, "conversation", {
  userMessage: message,
  channelId: session.channel_id ?? undefined,
  rich: opts?.rich,
});
```

#### 2.2.3 Propagar `disableDisplayTools` para `instrumentedRunAgent()`

Na chamada a `instrumentedRunAgent()` (linha ~449):

**Antes:**
```typescript
for await (const event of instrumentedRunAgent(effectiveAgentId, "chat", assembled.userMessage, {
  sessionDir: conversationDir,
  messageMeta: { id: generateMessageId(), userId },
  role: "conversation",
  tools: conversationTools,
  system: assembled.system,
  ...(contentPartsArg ? { contentParts: contentPartsArg } : {}),
})) {
```

**Depois:**
```typescript
for await (const event of instrumentedRunAgent(effectiveAgentId, "chat", assembled.userMessage, {
  sessionDir: conversationDir,
  messageMeta: { id: generateMessageId(), userId },
  role: "conversation",
  tools: conversationTools,
  system: assembled.system,
  ...(contentPartsArg ? { contentParts: contentPartsArg } : {}),
  disableDisplayTools: !(opts?.rich ?? false),
})) {
```

**Nota:** Verificar se `instrumentedRunAgent` é apenas um wrapper que repassa as options para `runAiAgent`. Se sim, o campo `disableDisplayTools` é propagado automaticamente via spread. Se `instrumentedRunAgent` filtra as options, pode ser necessário ajustar o wrapper em `apps/backbone/src/telemetry/instrumentor.ts`.

### 2.3 Arquivo: `apps/backbone/src/context/index.ts`

#### 2.3.1 Interface `AssemblePromptOpts`

**Antes:**
```typescript
export interface AssemblePromptOpts {
  userMessage?: string;
  channelId?: string;
}
```

**Depois:**
```typescript
export interface AssemblePromptOpts {
  userMessage?: string;
  channelId?: string;
  rich?: boolean;
}
```

#### 2.3.2 Constante `RICH_CONTENT_PROMPT`

Adicionar no topo do arquivo (após imports), antes da função `assemblePrompt`:

```typescript
const RICH_CONTENT_PROMPT = `<rich_content>
O cliente suporta conteudo rico. Alem de markdown, voce tem display tools para formatar informacoes de forma visual.

Planeje sua resposta usando as display tools quando fizer sentido:
- display_highlight: para destacar valores, precos, alertas ou pedir escolhas ao usuario
- display_collection: para colecoes (tabelas, comparacoes, carrosseis, galerias, fontes)
- display_card: para itens individuais (produtos, links, arquivos, imagens)
- display_visual: para visualizacoes (graficos, mapas, codigo, progresso, timelines)

Regras:
- Use display tools para informacao estruturada; use markdown para texto corrido
- Combine display tools com texto markdown na mesma resposta
- Nao use display tool quando markdown simples resolve (listas, headings, bold)
- Uma resposta pode ter multiplas display tools
</rich_content>\n\n`;
```

#### 2.3.3 Injeção condicional em `assemblePrompt()`

No corpo de `assemblePrompt()`, antes do retorno do `system` string e após as seções existentes (skills, adapters, services, memory, channel, mode instructions), injetar o prompt de rich content quando `opts.rich === true`:

```typescript
if (opts.rich) {
  system += RICH_CONTENT_PROMPT;
}
```

---

## 3. Regras de Implementação

- O prompt `RICH_CONTENT_PROMPT` é genérico — NÃO mencionar domínios de negócio
- Quando `rich` não é passado ou é `false`, nenhum prompt de display é injetado e `disableDisplayTools: true` é passado ao ai-sdk
- NÃO alterar a assinatura de callers de `sendMessage` que não passam pelo endpoint HTTP (ex: heartbeat, cron) — eles não recebem `rich` e continuam sem display tools
- Verificar se `instrumentedRunAgent` repassa options transparentemente ou se precisa de ajuste

---

## 4. Critérios de Aceite

- [ ] `POST /conversations/:sessionId/messages?rich=true` ativa rich content
- [ ] `POST /conversations/:sessionId/messages` (sem `rich`) desativa display tools
- [ ] `sendMessage()` aceita `opts?: { rich?: boolean }` sem quebrar callers existentes
- [ ] `AssemblePromptOpts` tem campo `rich?: boolean`
- [ ] Quando `rich=true`, o system prompt contém `<rich_content>`
- [ ] Quando `rich=true`, `disableDisplayTools` é `false` (display tools habilitadas)
- [ ] Quando `rich=false` ou ausente, `disableDisplayTools` é `true` (display tools desabilitadas)
- [ ] Build do backbone compila sem erros
