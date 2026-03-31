# S-084 — maxTools Warning no Provider

Adicionar campo `maxTools` ao `PROVIDER_CONFIGS` e emitir warning quando o número de tools de um agente exceder o limite do provider.

**Resolve:** D-008 (maxTools em PROVIDER_CONFIGS), D-009 (warning em agent/index.ts)
**Score de prioridade:** 6
**Dependencia:** Nenhuma — independente das domain tools
**PRP:** 18 — Domain Tools: Agrupamento de Tools por Domínio

---

## 1. Objetivo

Infraestrutura de alerta para detectar quando o total de tools de um agente excede o limite suportado pelo provider (ex: Groq = 128). Não corta tools automaticamente — o agrupamento por domínio (S-080 a S-083) resolve o limite. O warning serve como alerta operacional para novos connectors que possam inflar o total no futuro.

---

## 2. Alterações

### 2.1 Alterar: `apps/backbone/src/settings/llm.ts`

Adicionar `maxTools?: number` ao tipo de `PROVIDER_CONFIGS`:

```typescript
const PROVIDER_CONFIGS: Record<LlmProvider, { baseURL: string; apiKeyEnv: string; maxTools?: number }> = {
  openrouter: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  groq:       { baseURL: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", maxTools: 128 },
};
```

A função `getProviderConfig()` já retorna o objeto do provider — o campo `maxTools` fica disponível automaticamente para os consumidores.

### 2.2 Alterar: `apps/backbone/src/agent/index.ts`

Após a composição de tools (onde `options?.tools` é preparado), adicionar verificação:

```typescript
const providerConf = getProviderConfig(provider);
const toolCount = tools ? Object.keys(tools).length : 0;
if (providerConf.maxTools && toolCount > providerConf.maxTools) {
  console.warn(
    `[agent] ⚠ ${toolCount} tools exceeds ${provider} limit of ${providerConf.maxTools}. ` +
    `Agent may fail on this provider. Consider grouping tools into domain tools.`
  );
}
```

O warning é emitido uma vez por chamada a `runAgent()`. Não bloqueia a execução.

---

## 3. Regras de Implementação

- **Não cortar tools automaticamente** — apenas warning
- **`maxTools` é opcional** — providers sem limite (openrouter) não definem o campo
- **Warning no console** — não usar event bus nem notifier; é log operacional
- **Verificar que `groq` já existe como valor válido de `LlmProvider`** antes de implementar (confirmado: `LlmProvider = "openrouter" | "groq"`)

---

## 4. Critérios de Aceite

- [ ] `PROVIDER_CONFIGS` tem tipo com `maxTools?: number`
- [ ] Provider `groq` tem `maxTools: 128`
- [ ] Provider `openrouter` não tem `maxTools` (sem limite)
- [ ] `agent/index.ts` emite `console.warn` quando tools > maxTools
- [ ] Warning inclui contagem atual e limite do provider
- [ ] Warning não bloqueia execução do agente
- [ ] TypeScript compila sem erros
