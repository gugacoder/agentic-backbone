# PRP — Ai: Structured Outputs via generateObject/streamObject

Adicionar suporte a `generateObject()` e `streamObject()` do Vercel AI SDK na ai-sdk, eliminando parsing manual de JSON em respostas estruturadas.

## Execution Mode

`implementar`

## Contexto

### Estado atual

A ai-sdk usa exclusivamente `streamText()` e `generateText()` para todas as interacoes com o modelo. Quando o consumidor precisa de dados estruturados (ex: a compaction em `context/compaction.ts` que extrai um resumo, ou o backbone que extrai fatos para memoria), o fluxo eh:

1. Pedir ao modelo que responda em formato JSON dentro do texto
2. Fazer parse manual da resposta (geralmente `JSON.parse` ou regex)
3. Torcer para o modelo ter seguido o formato pedido

Esse pattern eh fragil: modelos menores erram formato, adicionam markdown fences, omitem campos, ou retornam JSON parcial. Nao ha validacao automatica nem retry.

| Arquivo | Pattern fragil |
|---|---|
| `context/compaction.ts:120-126` | `generateText()` → extrai texto livre para resumo (nao valida estrutura) |
| backbone `memory/` | Extrai fatos de conversas via texto livre |

O Vercel AI SDK v4 oferece `generateObject()` e `streamObject()` que:

- Aceitam schema Zod para validacao automatica
- Forcam o modelo a produzir JSON valido via constrained decoding (quando o provider suporta)
- Retornam objetos tipados diretamente
- Suportam streaming incremental de objetos parciais

### Estado desejado

1. A ai-sdk exporta funcoes utilitarias que encapsulam `generateObject()` e `streamObject()` usando o mesmo provider/model do agente
2. A compaction usa `generateObject()` com schema Zod em vez de texto livre
3. Consumidores podem pedir respostas estruturadas ao agente via uma nova opcao ou via tools que retornam objetos tipados

## Especificacao

### 1. Nova funcao utilitaria: `aiGenerateObject()`

Criar `packages/ai-sdk/src/structured.ts`:

```typescript
import { generateObject, streamObject } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { z } from "zod";

export interface AiObjectOptions<T extends z.ZodType> {
  model: string;
  apiKey: string;
  schema: T;
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export async function aiGenerateObject<T extends z.ZodType>(
  options: AiObjectOptions<T>
): Promise<z.infer<T>> {
  const openrouter = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: options.apiKey,
  });

  const result = await generateObject({
    model: openrouter(options.model),
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    maxTokens: options.maxTokens,
  });

  return result.object;
}
```

Criar funcao analoga `aiStreamObject()` que retorna `AsyncGenerator` de objetos parciais.

### 2. Migrar compaction para structured output

Refatorar `context/compaction.ts` para usar `generateObject()` com schema:

```typescript
import { z } from "zod";

const CompactionSchema = z.object({
  summary: z.string().describe("Resumo conciso da conversa"),
  decisions: z.array(z.string()).describe("Decisoes tomadas"),
  filesModified: z.array(z.string()).describe("Arquivos modificados"),
  currentState: z.string().describe("Estado atual do trabalho"),
  nextSteps: z.array(z.string()).describe("Proximos passos"),
});
```

O resultado tipado substitui o texto livre atual, permitindo que a mensagem de resumo seja montada de forma deterministica a partir dos campos.

### 3. Exportar no index.ts

Adicionar ao `packages/ai-sdk/src/index.ts`:

```typescript
export { aiGenerateObject, aiStreamObject } from "./structured.js";
export type { AiObjectOptions } from "./structured.js";
```

### 4. Nao criar provider redundante

A funcao `aiGenerateObject` cria o provider `createOpenAICompatible` internamente (mesmo pattern de `compactMessages`). Quando o PRP 10 (Provider Registry) for implementado, migrar para o registry centralizado.

## Limites

- **NAO** alterar a assinatura de `runAiAgent()` — structured outputs sao funcoes utilitarias separadas, nao um novo modo do agente
- **NAO** adicionar dependencias alem do que ja existe (`ai`, `zod`)
- **NAO** forcar structured outputs no `streamText()` principal — o agente continua respondendo em texto livre com tools
- **NAO** remover o fallback de texto em `compactMessages` — se `generateObject` falhar, manter a logica atual como fallback

## Validacao

- [ ] `aiGenerateObject()` com schema Zod retorna objeto tipado valido
- [ ] `aiStreamObject()` emite objetos parciais incrementalmente
- [ ] `compactMessages()` usa `generateObject()` e monta resumo a partir de campos estruturados
- [ ] Fallback: se `generateObject()` falhar (provider nao suporta), cai no `generateText()` atual
- [ ] Tipos exportados corretamente em `dist/`
- [ ] `npm run build --workspace=packages/ai-sdk` compila sem erros

## Rastreabilidade

| Mudanca | Arquivos |
|---|---|
| Funcoes utilitarias | `packages/ai-sdk/src/structured.ts` (novo) |
| Compaction refatorada | `packages/ai-sdk/src/context/compaction.ts` |
| Exports publicos | `packages/ai-sdk/src/index.ts` |
