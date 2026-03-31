# PRP-18E — maxTools Warning no Provider

Adicionar campo `maxTools` ao `PROVIDER_CONFIGS` e emitir warning quando o numero de tools de um agente exceder o limite do provider.

## Execution Mode

`implementar`

## Contexto

### Estado atual

`PROVIDER_CONFIGS` em `apps/backbone/src/settings/llm.ts` tem tipo `Record<LlmProvider, { baseURL: string; apiKeyEnv: string }>` — sem `maxTools`. O `agent/index.ts` passa tools diretamente ao AI SDK sem nenhuma verificacao de limite.

### Estado desejado

`PROVIDER_CONFIGS` inclui `maxTools?: number` (Groq = 128). O `agent/index.ts` emite `console.warn` quando tools excedem o limite. Nao corta tools automaticamente — o agrupamento por dominio resolve.

### Dependencias

- **Nenhuma** — independente das domain tools, pode ser executado em paralelo

## Especificacao

### Feature F-319: maxTools em PROVIDER_CONFIGS

**Spec:** S-084 secao 2.1

Alterar `apps/backbone/src/settings/llm.ts`:
- Adicionar `maxTools?: number` ao tipo de `PROVIDER_CONFIGS`
- Adicionar `maxTools: 128` para o provider `groq`
- Provider `openrouter` nao define `maxTools` (sem limite)

```typescript
const PROVIDER_CONFIGS: Record<LlmProvider, { baseURL: string; apiKeyEnv: string; maxTools?: number }> = {
  openrouter: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  groq:       { baseURL: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", maxTools: 128 },
};
```

### Feature F-320: Warning em agent/index.ts

**Spec:** S-084 secao 2.2

Alterar `apps/backbone/src/agent/index.ts`:
- Apos composicao de tools, verificar se `maxTools` esta definido e o total excede
- Emitir `console.warn` com contagem atual e limite do provider
- Warning nao bloqueia execucao

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

## Limites

- **NAO** cortar tools automaticamente — apenas warning
- **NAO** usar event bus nem notifier — eh log operacional simples
- **NAO** bloquear execucao do agente

## Validacao

- [ ] `PROVIDER_CONFIGS` tem tipo com `maxTools?: number`
- [ ] Provider `groq` tem `maxTools: 128`
- [ ] Provider `openrouter` nao tem `maxTools`
- [ ] `agent/index.ts` emite `console.warn` quando tools > maxTools
- [ ] Warning inclui contagem atual e limite do provider
- [ ] Warning nao bloqueia execucao do agente
- [ ] TypeScript compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-319 maxTools em PROVIDER_CONFIGS | S-084 | D-008 |
| F-320 Warning em agent/index.ts | S-084 | D-009 |
