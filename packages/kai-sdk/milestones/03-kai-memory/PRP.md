# KAI Memory — Gestao de Context Window e Visibilidade de Tokens

A KAI SDK carrega todas as mensagens da sessao sem contagem de tokens, sem compactacao e sem visibilidade do uso de contexto. Sessoes longas estouram o context window do modelo e o consumidor nao tem como saber quanto espaco resta. Este PRP define contagem de tokens, compactacao automatica e eventos de visibilidade de contexto.

---

## Objetivo

Adicionar a KAI SDK tres capacidades de gestao de contexto:
1. Contagem de tokens por categoria (system prompt, tools, mensagens, espaco livre)
2. Compactacao automatica de historico quando o uso atinge threshold
3. Evento de visibilidade (`context_status`) no AsyncGenerator para o consumidor renderizar

## Execution Mode

`implementar`

---

## Contexto

### Estado Atual

```typescript
// session.ts — carrega TODAS as mensagens sem limite
const content = await readFile(sessionPath(dir, sessionId), "utf-8");
return content.split("\n").filter(l => l.trim()).map(l => JSON.parse(l));
```

```typescript
// agent.ts — passa tudo ao modelo sem verificar tamanho
const messages: CoreMessage[] = [
  ...previousMessages,    // ← pode ter 500 mensagens, 200K tokens
  { role: "user", content: prompt },
];
```

### Consequencias

| Problema | Causa | Impacto |
|----------|-------|---------|
| Request falha por context overflow | Todas as mensagens sao enviadas | Sessao morre sem recuperacao |
| Custo alto em sessoes longas | Input tokens crescem linearmente | Custo por step aumenta a cada interacao |
| Consumidor cego | Sem metricas de tokens | Nao sabe quando parar ou compactar |
| Sem compactacao | Nenhum mecanismo de resumo | Impossivel manter sessoes longas |

### Referencia competitiva

| SDK | Contagem de tokens | Compactacao | Visibilidade |
|-----|:------------------:|:-----------:|:------------:|
| Claude Code | ✅ Dual-calculation model | ✅ Automatica a ~65% | ✅ `/context` com breakdown |
| OpenCode | ✅ Tracking por sessao | ⚠️ Manual | ⚠️ Limitada |
| KAI SDK | ❌ | ❌ | ❌ |

---

## Especificacao

### C01: Contagem de Tokens

#### Tokenizer

| Aspecto | Decisao |
|---------|---------|
| Biblioteca | `js-tiktoken` ou equivalente leve |
| Modelo de contagem | `cl100k_base` (compativel com Claude, GPT-4, maioria dos modelos via OpenRouter) |
| Precisao | Estimativa — nao precisa ser exata. ±5% e aceitavel |
| Arquivo | `src/context/tokenizer.ts` |

#### Funcao: `countTokens(text: string): number`

Retorna a estimativa de tokens para um texto. Usada internamente pelo SDK.

#### Funcao: `getContextUsage(options): ContextUsage`

Calcula o breakdown de uso do contexto:

```typescript
interface ContextUsage {
  model: string;
  contextWindow: number;        // tamanho total do context window do modelo
  systemPrompt: number;         // tokens do system prompt
  toolDefinitions: number;      // tokens dos schemas Zod das ferramentas
  messages: number;             // tokens do historico de mensagens
  used: number;                 // total usado (system + tools + messages)
  free: number;                 // espaco livre
  usagePercent: number;         // percentual usado (0-100)
  compactThreshold: number;     // percentual em que compactacao dispara
  willCompact: boolean;         // true se usagePercent >= compactThreshold
}
```

**Context window por modelo:** O SDK precisa de uma tabela de context windows por modelo. Essa tabela pode ser:
- Um mapa simples `{ "anthropic/claude-3.5-sonnet": 200000, "openai/gpt-4o": 128000, ... }`
- Configuravel via `KaiAgentOptions.contextWindow` para modelos desconhecidos
- Default de 128.000 tokens para modelos nao mapeados

---

### C02: Compactacao Automatica

#### Quando compactar

| Parametro | Valor default | Configuravel |
|-----------|:------------:|:------------:|
| Threshold de compactacao | 65% do context window | sim, via `options.compactThreshold` |
| Buffer de seguranca | 15% do context window reservado para output | fixo |

Compactacao dispara **antes** de chamar `streamText()` se `usagePercent >= compactThreshold`.

#### Como compactar

1. Separar mensagens em duas partes:
   - **Cabeca:** as primeiras N mensagens que serao resumidas
   - **Cauda:** as ultimas K mensagens que serao mantidas inteiras

2. Chamar o proprio modelo (via `generateText`, nao `streamText`) com um prompt de sumarizacao:

```
Resuma a conversa abaixo preservando: decisoes tomadas, arquivos modificados,
estado atual do trabalho, e proximos passos. Seja conciso.

[mensagens da cabeca]
```

3. Substituir a cabeca por uma unica mensagem:

```
{ role: "user", content: "<context_summary>\n{resumo}\n</context_summary>" }
```

4. O array de mensagens fica: `[summary, ...cauda]`

#### Decisoes de corte

| Aspecto | Decisao |
|---------|---------|
| Quantas mensagens manter na cauda | As ultimas que caibam em 30% do context window |
| Formato do resumo | Texto livre dentro de `<context_summary>` |
| Custo da compactacao | Uma chamada extra ao modelo — aceitavel |
| Persistencia | O resumo substitui as mensagens originais no JSONL |

#### Nova opcao em `KaiAgentOptions`

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `contextWindow` | number | auto-detectado ou 128000 | Tamanho do context window do modelo |
| `compactThreshold` | number | 0.65 | Percentual de uso que dispara compactacao (0-1) |
| `disableCompaction` | boolean | false | Desabilita compactacao automatica |

---

### C03: Evento de Visibilidade

#### Novo evento: `context_status`

Emitido no inicio de cada chamada ao modelo (antes do `streamText()`):

```typescript
{
  type: "context_status",
  context: {
    model: "anthropic/claude-3.5-sonnet",
    contextWindow: 200000,
    systemPrompt: 1100,
    toolDefinitions: 3200,
    messages: 24500,
    used: 28800,
    free: 171200,
    usagePercent: 14.4,
    compacted: false        // true se compactacao ocorreu nesse step
  }
}
```

**Adicionar ao `KaiAgentEvent`:**

```typescript
| { type: "context_status", context: ContextUsage & { compacted: boolean } }
```

O consumidor (CLI, UI) decide como renderizar. Pode ser uma barra visual como a do Claude Code, um log, ou ignorado.

---

### Integracao com `agent.ts`

O fluxo de `runKaiAgent()` muda para:

```
1. Montar messages (como hoje)
2. Calcular ContextUsage
3. Se usagePercent >= compactThreshold:
   a. Compactar mensagens
   b. Recalcular ContextUsage
4. yield { type: "context_status", context: usage }
5. Chamar streamText() (como hoje)
6. Continuar normalmente
```

Essa logica e executada **a cada step** do loop agentico (via `onStepFinish`), nao apenas no inicio da sessao.

---

## Limites

### O que este PRP NAO cobre

- **Nao implementa memoria semantica.** Embeddings, busca vetorial e MEMORY.md sao do Backbone, nao do SDK.
- **Nao implementa sliding window.** A estrategia e compactacao por sumarizacao, nao janela deslizante.
- **Nao implementa cache de tokens.** Prompt caching e responsabilidade do provider (OpenRouter/Anthropic), nao do SDK.
- **Nao expoe UI de contexto.** O SDK emite eventos — o consumidor decide a visualizacao.
- **Nao otimiza tool definitions.** O custo em tokens dos schemas Zod e reportado mas nao reduzido.

### Restricoes tecnicas

- O tokenizer deve ser leve (<500KB no bundle)
- Contagem de tokens NAO deve bloquear o event loop (usar versao sync do tiktoken para textos pequenos, chunk para textos grandes)
- A chamada de compactacao deve usar o mesmo `model` e `apiKey` do agente
- Compactacao persiste no JSONL — mensagens originais sao substituidas, nao mantidas em paralelo
- Se a compactacao falhar (erro de API), o SDK deve continuar sem compactar e emitir warning no evento

---

## Validacao

### Criterios de Aceite

Para contagem de tokens:

- [ ] `countTokens()` retorna numero > 0 para qualquer string nao-vazia
- [ ] `getContextUsage()` retorna breakdown com todos os campos de `ContextUsage`
- [ ] Estimativa de tokens tem margem de erro < 10% comparada com tokenizacao real

Para compactacao:

- [ ] Compactacao dispara automaticamente quando uso atinge threshold
- [ ] Apos compactacao, `usagePercent` cai para < 50%
- [ ] Mensagens recentes (cauda) sao mantidas intactas
- [ ] Resumo e persistido no JSONL no lugar das mensagens originais
- [ ] `disableCompaction = true` impede compactacao

Para visibilidade:

- [ ] Evento `context_status` e emitido antes de cada chamada ao modelo
- [ ] Evento inclui `compacted: true` quando compactacao ocorreu
- [ ] `ContextUsage` esta tipado em `types.ts`

Para integracao:

- [ ] Build passa sem erros (`npm run build` no workspace)
- [ ] Sessao com 100+ mensagens nao falha por context overflow
- [ ] Sessao longa compacta automaticamente e continua funcionando

### Comando de validacao

```bash
npm run build --workspace=packages/kai-sdk
```

---

## Exemplos

### Antes — sessao longa estoura

```
Step 1-20: agente trabalha normalmente
Step 21-30: respostas ficam lentas (input enorme)
Step 31: "Error: context_length_exceeded" → sessao morre
Consumidor: nao sabe o que aconteceu
```

### Depois — compactacao transparente

```
Step 1-20: agente trabalha normalmente
  context_status: 45% usado
Step 21: threshold atingido (65%)
  context_status: 65% usado, compacted: true
  → mensagens 1-15 resumidas em 1 paragrafo
  context_status: 32% usado
Step 22-40: agente continua com contexto limpo
  context_status: 55% usado
Consumidor: ve o breakdown em tempo real, sem surpresas
```

### Renderizacao pelo consumidor (exemplo)

```
⛁ ⛁ ⛁ ⛀ ⛶ ⛶ ⛶ ⛶ ⛶ ⛶  anthropic/claude-3.5-sonnet · 28.8k/200k tokens (14%)

  ⛁ System prompt:    1.1k tokens (0.6%)
  ⛁ Tool definitions: 3.2k tokens (1.6%)
  ⛁ Messages:        24.5k tokens (12.3%)
  ⛶ Free space:     171.2k tokens (85.6%)
```
