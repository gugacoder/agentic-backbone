# PRP-23B — Rich Activation Pipeline no Backbone

Implementar o pipeline completo de ativação de conteúdo rico no backbone: ler `rich` do query param, propagar pela cadeia sendMessage → assemblePrompt, injetar prompt de display tools, e passar `disableDisplayTools` ao ai-sdk.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone não tem mecanismo para ativar display tools condicionalmente. O PRP 14 delegou a injeção de prompt de display tools ao prompt assembly, mas ninguém implementou. As display tools são sempre carregadas (custo de tokens) e nunca instruídas (modelo não as usa).

### Estado desejado

- `POST /conversations/:sessionId/messages?rich=true` ativa rich content
- O system prompt recebe bloco `<rich_content>` instruindo o modelo a usar display tools
- `disableDisplayTools: false` é passado ao ai-sdk quando `rich=true`
- Sem `rich` param, display tools são desabilitadas (zero tokens) e nenhum prompt é injetado

### Dependencias

- **PRP-23A** — flag `disableDisplayTools` no ai-sdk (F-343)

## Especificacao

### Feature F-344: Ler `rich` query param na rota de mensagens

**Spec:** S-097 seção 2.1

Em `apps/backbone/src/routes/conversations.ts`, na rota `POST /conversations/:sessionId/messages`:

1. Ler o query param: `const rich = c.req.query("rich") === "true";`
2. Nos dois call sites de `sendMessage` (linhas ~342 e ~374), passar `{ rich }` como quarto argumento:

```typescript
// Antes
for await (const event of sendMessage(auth.user, sessionId, effectiveMessage)) {
// Depois
for await (const event of sendMessage(auth.user, sessionId, effectiveMessage, { rich })) {
```

#### Regras

- Ler `rich` uma vez no início do handler, não em cada call site
- NÃO alterar callers de `sendMessage` fora da rota HTTP (heartbeat, cron) — eles não recebem `rich`

### Feature F-345: Propagar `rich` até assemblePrompt e injetar prompt

**Spec:** S-097 seções 2.2, 2.3, 2.4

#### 1. `apps/backbone/src/conversations/index.ts` — assinatura de `sendMessage()`

Adicionar quarto parâmetro:

```typescript
export async function* sendMessage(
  userId: string,
  sessionId: string,
  content: string | ContentPart[],
  opts?: { rich?: boolean }
): AsyncGenerator<AgentEvent> {
```

Propagar `rich` na chamada a `assemblePrompt()`:

```typescript
const assembled = await assemblePrompt(effectiveAgentId, "conversation", {
  userMessage: message,
  channelId: session.channel_id ?? undefined,
  rich: opts?.rich,
});
```

#### 2. `apps/backbone/src/context/index.ts` — interface e prompt

Adicionar `rich?: boolean` à interface `AssemblePromptOpts`:

```typescript
export interface AssemblePromptOpts {
  userMessage?: string;
  channelId?: string;
  rich?: boolean;
}
```

Definir constante `RICH_CONTENT_PROMPT` no topo do arquivo:

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

Injetar condicionalmente em `assemblePrompt()`, após as seções existentes (skills, adapters, services, memory, channel, mode instructions):

```typescript
if (opts.rich) {
  system += RICH_CONTENT_PROMPT;
}
```

### Feature F-346: Passar `disableDisplayTools` ao ai-sdk

**Spec:** S-097 seção 2.3

Em `apps/backbone/src/conversations/index.ts`, na chamada a `instrumentedRunAgent()`:

```typescript
for await (const event of instrumentedRunAgent(effectiveAgentId, "chat", assembled.userMessage, {
  // ...campos existentes...
  disableDisplayTools: !(opts?.rich ?? false),
})) {
```

**Nota:** Verificar se `instrumentedRunAgent` é apenas um wrapper que repassa options para `runAiAgent` via spread. Se filtra as options, ajustar o wrapper em `apps/backbone/src/telemetry/instrumentor.ts` para propagar `disableDisplayTools`.

#### Regras

- O prompt `RICH_CONTENT_PROMPT` é genérico — NÃO mencionar domínios de negócio
- Quando `rich` não é passado ou é `false`: nenhum prompt de display é injetado E `disableDisplayTools: true` é passado
- NÃO alterar callers de `sendMessage` que não passam pelo endpoint HTTP (heartbeat, cron)
- Verificar se `instrumentedRunAgent` repassa options transparentemente

## Limites

- **NÃO** criar prompt de rich content específico por agente — o prompt é genérico
- **NÃO** ativar `rich=true` para canais não-streaming (WhatsApp, voice)
- **NÃO** forçar display tools — o modelo usa quando faz sentido
- **NÃO** alterar o ai-sdk — isso foi feito no PRP-23A

## Validacao

- [ ] `POST /conversations/:sessionId/messages?rich=true` ativa rich content
- [ ] `POST /conversations/:sessionId/messages` (sem `rich`) desativa display tools
- [ ] `sendMessage()` aceita `opts?: { rich?: boolean }` sem quebrar callers existentes
- [ ] `AssemblePromptOpts` tem campo `rich?: boolean`
- [ ] Quando `rich=true`, o system prompt contém `<rich_content>`
- [ ] Quando `rich=true`, `disableDisplayTools` é `false` (display tools habilitadas)
- [ ] Quando `rich=false` ou ausente, `disableDisplayTools` é `true` (display tools desabilitadas)
- [ ] Constante `RICH_CONTENT_PROMPT` lista as 4 domain tools
- [ ] Build do backbone compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-344 rich query param | S-097 | D-003 |
| F-345 propagação rich + prompt | S-097 | D-004, D-005 |
| F-346 disableDisplayTools ao ai-sdk | S-097 | D-006 |
