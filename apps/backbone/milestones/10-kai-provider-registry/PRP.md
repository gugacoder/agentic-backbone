# PRP — Kai: Provider Registry para Multi-Model

Centralizar a criacao de providers via `createProviderRegistry()` do Vercel AI SDK, eliminando instancias repetidas de `createOpenAICompatible` e habilitando aliases de modelo.

## Execution Mode

`implementar`

## Contexto

### Estado atual

A kai-sdk cria o provider OpenRouter em dois lugares distintos, com codigo identico:

```typescript
// agent.ts:41-45
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: options.apiKey,
});

// context/compaction.ts:114-118
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: options.apiKey,
});
```

Problemas:

| Problema | Impacto |
|---|---|
| Provider duplicado | Codigo repetido em 2+ lugares |
| Sem aliases | Consumidor precisa saber ID exato do modelo ("anthropic/claude-sonnet-4") |
| Sem fallback | Nao ha como definir modelo backup se o primario falhar |
| Acoplado ao OpenRouter | Trocar provider requer mudar multiplos arquivos |

O Vercel AI SDK v4 oferece `createProviderRegistry()`:

```typescript
const registry = createProviderRegistry({
  openrouter: createOpenAICompatible({ ... }),
});
const model = registry.languageModel("openrouter:anthropic/claude-sonnet-4");
```

### Estado desejado

1. Um unico `ProviderRegistry` criado por sessao do agente
2. Consumidores podem registrar aliases (ex: `"fast"` → `"anthropic/claude-haiku-4.5"`)
3. Compaction e futuras funcoes utilitarias (structured outputs, etc.) reutilizam o mesmo registry
4. Preparacao para multi-provider futuro (OpenRouter + Anthropic direto + local)

## Especificacao

### 1. Novo modulo: provider registry

Criar `packages/kai-sdk/src/providers.ts`:

```typescript
import { experimental_createProviderRegistry as createProviderRegistry } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface KaiProviderConfig {
  /** OpenRouter API key */
  apiKey: string;
  /** Aliases de modelo: nome amigavel → model ID completo */
  aliases?: Record<string, string>;
}

const DEFAULT_ALIASES: Record<string, string> = {
  "fast": "anthropic/claude-haiku-4.5",
  "balanced": "anthropic/claude-sonnet-4",
  "strong": "anthropic/claude-opus-4.6",
};

export function createKaiProviderRegistry(config: KaiProviderConfig) {
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: config.apiKey,
  });

  const aliases = { ...DEFAULT_ALIASES, ...config.aliases };

  return {
    /** Resolve modelo por ID ou alias */
    model(nameOrAlias: string) {
      const resolved = aliases[nameOrAlias] ?? nameOrAlias;
      return openrouter(resolved);
    },
    /** Aliases registrados */
    aliases,
  };
}
```

### 2. Integracao no agent.ts

Substituir a criacao inline do provider:

```typescript
// Antes (agent.ts:41-45)
const openrouter = createOpenAICompatible({ ... });
// Uso: openrouter(options.model)

// Depois
const providers = createKaiProviderRegistry({
  apiKey: options.apiKey,
  aliases: options.modelAliases,
});
// Uso: providers.model(options.model)
```

### 3. Nova opcao em KaiAgentOptions

```typescript
// types.ts
export interface KaiAgentOptions {
  // ...existentes...

  /** Aliases de modelo: ex. { "fast": "anthropic/claude-haiku-4.5" } */
  modelAliases?: Record<string, string>;
}
```

O consumidor pode entao usar:

```typescript
runKaiAgent(prompt, {
  model: "fast",  // resolve para claude-haiku-4.5
  apiKey,
  modelAliases: {
    "fast": "anthropic/claude-haiku-4.5",
    "strong": "anthropic/claude-opus-4.6",
  },
});
```

### 4. Passagem para compaction

Refatorar `CompactOptions` para aceitar o registry ao inves de `model` + `apiKey`:

```typescript
// Opcao A: passar registry como dependencia
export interface CompactOptions {
  // ...existentes...
  /** Provider registry para reuso. Se nao fornecido, cria um internamente (backward compat). */
  providers?: ReturnType<typeof createKaiProviderRegistry>;
}
```

Se `providers` nao for passado, a compaction cria seu proprio provider internamente (backward compatibility).

### 5. Exportar no index.ts

```typescript
export { createKaiProviderRegistry } from "./providers.js";
export type { KaiProviderConfig } from "./providers.js";
```

## Limites

- **NAO** registrar multiplos providers neste PRP — apenas OpenRouter. Multi-provider (Anthropic direto, Ollama) eh futuro
- **NAO** alterar IDs de modelo existentes nos consumidores — aliases sao opcao, IDs completos continuam funcionando
- **NAO** criar logica de fallback automatico entre modelos — isso eh responsabilidade do consumidor via `prepareStep` (PRP 07)
- **NAO** adicionar dependencias — `createProviderRegistry` ja existe no pacote `ai`

## Validacao

- [ ] `runKaiAgent({ model: "anthropic/claude-sonnet-4" })` funciona como antes (ID completo)
- [ ] `runKaiAgent({ model: "fast" })` resolve para o alias configurado
- [ ] Compaction reutiliza o mesmo registry do agente (nao cria provider duplicado)
- [ ] Default aliases (`fast`, `balanced`, `strong`) funcionam sem configuracao
- [ ] Aliases customizados sobrescrevem os defaults
- [ ] `npm run build --workspace=packages/kai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Provider registry | `packages/kai-sdk/src/providers.ts` (novo) |
| Integracao no agente | `packages/kai-sdk/src/agent.ts` |
| Nova opcao | `packages/kai-sdk/src/types.ts` |
| Compaction com registry | `packages/kai-sdk/src/context/compaction.ts` |
| Exports | `packages/kai-sdk/src/index.ts` |
