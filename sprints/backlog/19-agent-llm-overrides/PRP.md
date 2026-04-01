# LLM per-agent per-mode — Slug overrides no AGENT.yml

Permitir que cada agente declare overrides de slug LLM por modo operacional (`conversation`, `heartbeat`, `cron`, `request`, `memory`), mantendo o plan como fonte de verdade dos modelos.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

O modelo usado por qualquer agente e determinado exclusivamente pelo **plan ativo**. O plan define um mapa `roles` que associa cada modo a um slug:

```yaml
# context/plans/standard.yml
roles:
  conversation: medium.mid
  heartbeat: small.low
  cron: medium.low
  memory: medium.low
  request: medium.mid
```

A resolucao acontece em `resolveSlug(role)` (`apps/backbone/src/settings/llm.ts:201`):

```typescript
export function resolveSlug(role: string): SlugDef {
  const plan = getActivePlan();
  const slugName = plan.roles[role] ?? DEFAULT_SLUG;
  return plan.slugs[slugName];
}
```

Todos os agentes compartilham o mesmo mapeamento. Nao ha como um agente usar `large.high` para conversation enquanto outro usa `small.low`.

### Problema

- Agentes com uso intensivo (ex: `guga.kai`) precisam de modelos mais capaz para conversation, mas mais baratos para heartbeat
- Agentes simples (bots de notificacao) nao precisam de modelos caros em nenhum modo
- Hoje a unica opcao e mudar o plan inteiro, afetando todos os agentes

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Resolucao de modelo | `role → plan.roles[role] → slug` | `role → agent.llm[role] ?? plan.roles[role] → slug` |
| AGENT.yml | Sem campo `llm` | Campo opcional `llm: Record<mode, slugName>` |
| AgentConfig type | Sem `llm` | `llm?: Record<string, string>` |
| resolveSlug() | 1 param (role) | 2 params (role, agentSlugOverrides?) |
| runAgent() options | Sem slug overrides | `agentSlugOverrides?: Record<string, string>` |

---

## Especificacao

### 1. Schema YAML — `apps/backbone/src/context/schemas.ts`

Adicionar campo `llm` ao `AgentYmlSchema`:

```typescript
llm: z.record(z.string(), z.string()).optional(),
```

Validacao: chaves sao strings livres (modos), valores sao strings livres (slugs). A validacao de que o slug existe no plan acontece em runtime no `resolveSlug()`.

### 2. Tipo AgentConfig — `apps/backbone/src/agents/types.ts`

Adicionar campo opcional:

```typescript
export interface AgentConfig {
  // ...campos existentes...
  llm?: Record<string, string>;
}
```

### 3. Registry — `apps/backbone/src/agents/registry.ts`

No `parseAgentConfig()`, mapear `data.llm` para o `AgentConfig`:

```typescript
return {
  // ...campos existentes...
  llm: data.llm,
};
```

### 4. Resolucao LLM — `apps/backbone/src/settings/llm.ts`

#### 4.1 `resolveSlug(role, agentSlugOverrides?)`

```typescript
export function resolveSlug(role: string, agentSlugOverrides?: Record<string, string>): SlugDef {
  const plan = getActivePlan();
  const slugName = agentSlugOverrides?.[role] ?? plan.roles[role] ?? DEFAULT_SLUG;
  const slug = plan.slugs[slugName as SlugName];
  // ...fallback existente...
}
```

Precedencia: `agent.llm[role]` > `plan.roles[role]` > `DEFAULT_SLUG`

#### 4.2 `resolveModelResult(role, context?, agentRoutingRules?, agentSlugOverrides?)`

Repassar `agentSlugOverrides` para `resolveSlug()`:

```typescript
export function resolveModelResult(
  role: string,
  context?: RoutingContext,
  agentRoutingRules?: RoutingRule[],
  agentSlugOverrides?: Record<string, string>
): ModelResult {
  const slug = resolveSlug(role, agentSlugOverrides);
  // ...resto inalterado...
}
```

#### 4.3 `resolveParameters(role, agentSlugOverrides?)`

```typescript
export function resolveParameters(role: string, agentSlugOverrides?: Record<string, string>): Record<string, unknown> {
  return resolveSlug(role, agentSlugOverrides).llm.parameters;
}
```

#### 4.4 `resolveModel(role, context?, agentRoutingRules?, agentSlugOverrides?)`

Repassar `agentSlugOverrides` para `resolveModelResult()`.

### 5. Agent runner — `apps/backbone/src/agent/index.ts`

Adicionar `agentSlugOverrides` ao tipo de options e repassar:

```typescript
export async function* runAgent(
  prompt: string,
  options?: {
    // ...campos existentes...
    agentSlugOverrides?: Record<string, string>;
  }
): AsyncGenerator<AgentEvent> {
  const role = options?.role ?? "conversation";
  const routingResult = resolveModelResult(role, options?.routingContext, options?.agentRoutingRules, options?.agentSlugOverrides);
  const params = resolveParameters(role, options?.agentSlugOverrides);
  // ...resto inalterado...
}
```

### 6. Call sites — passar `agent.llm`

#### 6.1 Conversation — `apps/backbone/src/conversations/index.ts`

Na chamada a `instrumentedRunAgent` (~linha 439), adicionar:

```typescript
agentSlugOverrides: agent?.llm,
```

`agent` ja esta disponivel via `getAgent(agentId)` na linha 277.

#### 6.2 Heartbeat — `apps/backbone/src/heartbeat/index.ts`

Na chamada a `instrumentedRunAgent` (~linha 194), adicionar:

```typescript
agentSlugOverrides: agentConfig?.llm,
```

`agentConfig` ja esta disponivel via `listAgents()` na linha 114.

#### 6.3 Cron — `apps/backbone/src/cron/executor.ts`

Na chamada a `instrumentedRunAgent` (~linha 138), adicionar:

```typescript
agentSlugOverrides: agentConfig?.llm,
```

`agentConfig` ja esta disponivel via `getAgent(job.agentId)` na linha 130.

#### 6.4 Request — `apps/backbone/src/routes/agents.ts`

Nas chamadas a `runAgent` (~linhas 382, 390, 431, 438), adicionar:

```typescript
agentSlugOverrides: agent?.llm,
```

`agent` ja esta disponivel via `getAgent(agentId)` na linha 365.

#### 6.5 Memory flush — `apps/backbone/src/memory/flush.ts`

Na chamada a `resolveModelResult("memory")` (~linha 178), passar overrides:

```typescript
const { model: modelId, provider } = resolveModelResult("memory", undefined, undefined, agentSlugOverrides);
```

O `flushMemory()` recebe `agentId` — carregar o agent com `getAgent()` e passar `agent?.llm`.

#### 6.6 Demais call sites (drafts, system, eval, benchmark)

Nao alterar. Esses contextos nao tem agente especifico — usam o plan normalmente.

---

## Exemplo de uso

```yaml
# context/agents/guga.kai/AGENT.yml
id: guga.kai
owner: guga
slug: kai
enabled: true

llm:
  conversation: large.mid
  heartbeat: small.low
  cron: medium.low
  memory: small.low
```

Resultado: `guga.kai` usa `large.mid` (modelo mais capaz) para conversation, enquanto heartbeat e memory usam `small.low` (mais barato). Modos nao declarados (`request`, `webhook`) usam o plan normalmente.

---

## Limites

### NAO fazer

- **NAO** aceitar modelo direto (ex: `google/gemini-2.0-flash`) — sempre slug, resolvido pelo plan
- **NAO** validar slugs no parse do YAML — validacao e em runtime (slug pode nao existir em plans de tier inferior)
- **NAO** alterar comportamento de routing rules — elas continuam tendo prioridade sobre o slug base
- **NAO** adicionar UI para editar `llm` do agente — editar AGENT.yml diretamente por ora
- **NAO** alterar call sites que nao tem agentConfig (drafts, system, eval, benchmark)

### Observacoes

- Routing rules (`agentRoutingRules`) continuam tendo prioridade sobre slug overrides — o slug override define o **baseline**, a routing rule pode elevar
- O campo `llm` e hot-reloaded pelo watcher de AGENT.yml (via `refreshAgentRegistry()`)
- `InstrumentedRunAgentOptions` herda de `Parameters<typeof runAgent>[1]`, entao nao precisa de alteracao separada

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | Schema + tipo (`schemas.ts`, `types.ts`) | nada |
| 2 | Registry (`registry.ts`) — mapear `data.llm` | fase 1 |
| 3 | Resolucao LLM (`llm.ts`) — `agentSlugOverrides` param | nada |
| 4 | Agent runner (`agent/index.ts`) — repassar overrides | fase 3 |
| 5 | Call sites (conversations, heartbeat, cron, routes, memory) | fases 2 + 4 |

Fases 1 e 3 sao independentes e podem ser executadas em paralelo.
Fases 2 e 4 dependem de 1 e 3 respectivamente, mas sao independentes entre si.
