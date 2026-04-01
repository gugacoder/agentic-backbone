# S-090 — Refatorar sendMessage + InboundMessage para Content Array

Expandir `sendMessage()`, `appendModelMessage()` e `InboundMessage.content` para aceitar `string | ContentPart[]`.

**Resolve:** D-005 (refatorar sendMessage e InboundMessage para content array)
**Score de prioridade:** 9
**Dependencia:** S-088 — classificador já produz content arrays
**PRP:** 21 — File Upload: Envio de Arquivos para o Modelo

---

## 1. Objetivo

Ponto central de integração do backbone. Sem esta refatoração, nem a rota multipart (S-087), nem o Evolution (S-093), nem o frontend (S-094) conseguem entregar `ContentPart[]` ao pipeline de agente. A expansão deve ser retrocompatível — `string` continua funcionando.

---

## 2. Alterações

### 2.1 Arquivo: `apps/backbone/src/conversations/index.ts` (MODIFICAR)

#### Função: `sendMessage()`

Assinatura atual:
```typescript
export async function* sendMessage(
  userId: string,
  sessionId: string,
  message: string
): AsyncGenerator<AgentEvent>
```

Nova assinatura:
```typescript
export async function* sendMessage(
  userId: string,
  sessionId: string,
  content: string | ContentPart[]
): AsyncGenerator<AgentEvent>
```

Internamente:
- Se `content` é `string`, manter comportamento atual (passar como string para `runAgent`)
- Se `content` é `ContentPart[]`, passar como content array para `runAgent`

A passagem para `runAgent()` (ai-sdk) deve respeitar a tipagem de `content` do Vercel AI SDK — `string | Array<TextPart | ImagePart | FilePart>`.

**Todos os call sites de `sendMessage()` devem ser verificados** para garantir que continuam passando `string` onde já passavam. Nenhum call site existente precisa mudar — a expansão é aditiva.

### 2.2 Arquivo: `apps/backbone/src/conversations/persistence.ts` (MODIFICAR)

#### Função: `appendModelMessage()`

Assinatura atual:
```typescript
export function appendModelMessage(
  agentId: string,
  sessionId: string,
  message: { role: string; content: string; _meta?: Record<string, unknown> }
): void
```

Nova assinatura — expandir `content`:
```typescript
export function appendModelMessage(
  agentId: string,
  sessionId: string,
  message: { role: string; content: string | ContentPart[]; _meta?: Record<string, unknown> }
): void
```

Ao serializar:
- Se `content` é `string`, serializar normalmente (retrocompatível)
- Se `content` é `ContentPart[]`, aplicar `stripBase64ForStorage()` (S-089) antes de serializar

### 2.3 Arquivo: `apps/backbone/src/channels/delivery/types.ts` (MODIFICAR)

#### Interface: `InboundMessage`

Tipo atual:
```typescript
export interface InboundMessage {
  senderId: string;
  content: string;
  ts: number;
  metadata?: Record<string, unknown>;
}
```

Novo tipo:
```typescript
export interface InboundMessage {
  senderId: string;
  content: string | ContentPart[];
  ts: number;
  metadata?: Record<string, unknown>;
}
```

**Impacto:** Todos os canais (Evolution, etc.) que criam `InboundMessage` continuam passando `string` — retrocompatível. Apenas o Evolution atualizado (S-093) passará `ContentPart[]` para mensagens com mídia.

### 2.4 Verificar call chain

A chain completa é:

```
Rota POST → sendMessage(content) → runAgent(content) → streamText(content)
                                                              ↑
Evolution webhook → routeInboundMessage(InboundMessage) → sendMessage(content)
```

Garantir que `routeInboundMessage()` (ou equivalente) extrai `content` de `InboundMessage` e passa para `sendMessage()` sem forçar `.toString()`.

---

## 3. Regras de Implementação

- **Retrocompatibilidade obrigatória** — `string` deve continuar funcionando em todos os caminhos
- **Não forçar conversão** — se recebeu `string`, passa `string`; se recebeu `ContentPart[]`, passa `ContentPart[]`
- **Tipo `ContentPart`** — usar os tipos do Vercel AI SDK (`TextPart`, `ImagePart`, `FilePart`) importados de `ai`
- **Verificar todos os call sites** de `sendMessage()`, `appendModelMessage()` e `routeInboundMessage()` — confirmar que compilam sem mudança
- **Não alterar a assinatura de `runAgent()`** do ai-sdk se já aceita content array — apenas verificar compatibilidade

---

## 4. Critérios de Aceite

- [ ] `sendMessage()` aceita `content: string | ContentPart[]`
- [ ] `appendModelMessage()` aceita `content: string | ContentPart[]`
- [ ] `InboundMessage.content` tipado como `string | ContentPart[]`
- [ ] Chamadas existentes com `string` continuam compilando sem mudança
- [ ] Content array é propagado até `runAgent()` → `streamText()` sem perda
- [ ] Content string é propagado sem conversão desnecessária
- [ ] `appendModelMessage()` aplica `stripBase64ForStorage()` quando content é array
- [ ] TypeScript compila sem erros em `apps/backbone`
