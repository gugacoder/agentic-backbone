# LangGraph Agents - Referências

Guia de referência para implementação de agentes com LangGraph no projeto.

---

## Documentação Oficial

- **LangGraph**: https://www.langchain.com/langgraph
- **LangGraph.js**: https://github.com/langchain-ai/langgraphjs
- **LangChain JS Tools**: https://docs.langchain.com/oss/javascript/langchain/
- **OpenRouter**: https://openrouter.ai/docs

---

## 1. Criação de Tools (TypeScript)

### Padrão Básico

```typescript
import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const searchKb = tool(
  async ({ query, limit = 3 }) => {
    // Implementação
    const results = await kbService.search(query, limit);
    return {
      found: results.length > 0,
      articles: results.map(r => ({
        id: r.id,
        title: r.title,
        score: r.score
      }))
    };
  },
  {
    name: "search_kb",
    description: "Busca artigos na Knowledge Base por query semântica. Use quando o usuário faz uma pergunta que pode ter resposta documentada.",
    schema: z.object({
      query: z.string().describe("A query de busca em linguagem natural"),
      limit: z.number().optional().default(3).describe("Número máximo de resultados")
    })
  }
);
```

### Best Practices para Descrições

A descrição da tool é **crítica** - é o que o LLM usa para decidir quando usar.

**Bom:**
```typescript
description: "Busca artigos na Knowledge Base por query semântica. Use quando o usuário faz uma pergunta que pode ter resposta documentada. NÃO use para bugs ou reclamações."
```

**Ruim:**
```typescript
description: "Busca na KB"  // Muito vago
```

### Schema com Zod

```typescript
// Tipos complexos
const entitySchema = z.object({
  type: z.enum(["person", "product", "company", "date", "money"]),
  value: z.string(),
  confidence: z.number().min(0).max(1)
});

// Arrays
schema: z.object({
  entities: z.array(entitySchema).describe("Entidades extraídas do texto")
})

// Union types
schema: z.object({
  criteria: z.enum(["workload", "expertise", "round_robin"])
    .describe("Critério de atribuição: workload (menos threads), expertise (por categoria), round_robin (rotativo)")
})
```

---

## 2. Graph Architecture

### Estado do Graph

```typescript
import { StateGraph, Annotation } from "@langchain/langgraph";

// Definir estado com Annotation
const GraphState = Annotation.Root({
  // Input
  commentId: Annotation<string>,
  threadId: Annotation<string>,
  text: Annotation<string>,
  authorType: Annotation<"customer" | "attendant" | "agent" | "system">,

  // Classificação
  classification: Annotation<{
    intent: string;
    sentiment: string;
    urgency: string;
    confidence: number;
  } | null>,

  // Reasoning
  toolsToUse: Annotation<string[]>,

  // Resultados
  toolResults: Annotation<Array<{
    tool: string;
    input: object;
    output: object;
    duration_ms: number;
  }>>,

  // Output
  aiHint: Annotation<string | null>,
  labelsAdded: Annotation<string[]>,

  // Erro
  error: Annotation<string | null>
});
```

### Estrutura do Graph

```typescript
const graph = new StateGraph(GraphState)
  // Nodes
  .addNode("classify", classifyNode)
  .addNode("reason", reasonNode)
  .addNode("act", actNode)
  .addNode("finalize", finalizeNode)

  // Edges
  .addEdge("__start__", "classify")
  .addEdge("classify", "reason")
  .addConditionalEdges("reason", shouldAct, {
    act: "act",
    skip: "finalize"
  })
  .addEdge("act", "finalize")
  .addEdge("finalize", "__end__");

const app = graph.compile();
```

### Conditional Edges

```typescript
function shouldAct(state: typeof GraphState.State): "act" | "skip" {
  // Se não há tools para usar, pular direto para finalize
  if (!state.toolsToUse || state.toolsToUse.length === 0) {
    return "skip";
  }
  return "act";
}
```

---

## 3. Intent Classification

### Structured Output

```typescript
import { ChatOpenAI } from "@langchain/openai";

const classificationSchema = z.object({
  intent: z.enum([
    "question",      // Pergunta que pode ter resposta
    "bug",           // Reporte de problema/erro
    "feature",       // Solicitação de feature
    "complaint",     // Reclamação
    "thanks",        // Agradecimento
    "update",        // Atualização de status
    "greeting",      // Saudação
    "other"          // Outros
  ]).describe("Intenção principal da mensagem"),

  sentiment: z.enum([
    "positive",
    "negative",
    "neutral"
  ]).describe("Sentimento geral da mensagem"),

  urgency: z.enum([
    "low",
    "medium",
    "high"
  ]).describe("Nível de urgência baseado no conteúdo e tom"),

  confidence: z.number()
    .min(0).max(1)
    .describe("Confiança na classificação (0-1)"),

  reasoning: z.string()
    .describe("Breve explicação da classificação")
});

const model = new ChatOpenAI({
  model: "google/gemini-2.0-flash-001",
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY
  }
}).withStructuredOutput(classificationSchema);
```

### Prompt de Classificação

```typescript
const CLASSIFY_PROMPT = `Você é um classificador de mensagens de suporte ao cliente.

Analise a mensagem e classifique:
- intent: qual a intenção principal?
- sentiment: qual o tom emocional?
- urgency: quão urgente é?

Regras:
- "thanks" nunca é urgente
- "bug" com palavras como "urgente", "parado", "crítico" = high urgency
- Perguntas simples = low urgency
- Reclamações = medium ou high dependendo do tom

Mensagem do cliente:
{text}

Contexto da thread (últimas mensagens):
{context}
`;
```

---

## 4. Routing Strategies

### LLM-Based Routing

```typescript
const reasoningSchema = z.object({
  tools: z.array(z.enum([
    "search_kb",
    "search_similar_threads",
    "add_label",
    "add_property",
    "suggest_reply",
    "flag_attention",
    "extract_entities",
    "detect_language",
    "auto_assign",
    "auto_categorize"
  ])).describe("Lista de tools a executar"),

  reasoning: z.string()
    .describe("Por que essas tools foram escolhidas")
});

const REASON_PROMPT = `Baseado na classificação, decida quais ações tomar.

Classificação:
- Intent: {intent}
- Sentiment: {sentiment}
- Urgency: {urgency}

Regras de decisão:
- intent=question → search_kb (sempre), suggest_reply (se encontrar)
- intent=bug → search_similar_threads, add_label("bug")
- urgency=high → flag_attention, add_label("urgent")
- sentiment=negative → flag_attention
- intent=thanks → NENHUMA tool (retornar lista vazia)
- Primeira mensagem de thread → auto_categorize, auto_assign

NÃO use tools desnecessárias. Menos é mais.
`;
```

### Semantic Routing (Embedding-Based)

Para casos de alta performance, considere pré-classificar com embeddings:

```typescript
// Exemplos pré-definidos por categoria
const intentExamples = {
  question: [
    "Como faço para resetar minha senha?",
    "Qual o horário de funcionamento?",
    "Vocês aceitam cartão?"
  ],
  bug: [
    "O sistema está dando erro",
    "Não consigo fazer login",
    "A página não carrega"
  ],
  // ...
};

// Pré-computar embeddings na inicialização
const intentEmbeddings = await computeEmbeddings(intentExamples);

// Runtime: classificar por similaridade
function classifyBySimilarity(text: string): string {
  const embedding = await embed(text);
  return findNearestIntent(embedding, intentEmbeddings);
}
```

---

## 5. Tool Execution

### ToolNode

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

const tools = [
  searchKb,
  searchSimilarThreads,
  addLabel,
  addProperty,
  suggestReply,
  flagAttention,
  extractEntities,
  detectLanguage,
  autoAssign,
  autoCategorize
];

const toolNode = new ToolNode(tools);
```

### Execução Manual com Logging

```typescript
async function actNode(state: typeof GraphState.State) {
  const results = [];

  for (const toolName of state.toolsToUse) {
    const tool = tools.find(t => t.name === toolName);
    if (!tool) continue;

    const startTime = Date.now();

    try {
      const input = buildToolInput(toolName, state);
      const output = await tool.invoke(input);

      results.push({
        tool: toolName,
        input,
        output,
        duration_ms: Date.now() - startTime
      });
    } catch (error) {
      results.push({
        tool: toolName,
        input: {},
        output: { error: error.message },
        duration_ms: Date.now() - startTime
      });
    }
  }

  return { toolResults: results };
}
```

---

## 6. OpenRouter Configuration

### Setup

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "google/gemini-2.0-flash-001",
  temperature: 0,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": process.env.APP_URL,
      "X-Title": "Triager"
    }
  }
});
```

### Modelos Recomendados

| Uso | Modelo | Custo | Latência |
|-----|--------|-------|----------|
| Classificação | `google/gemini-2.0-flash-001` | Baixo | ~500ms |
| Reasoning | `google/gemini-2.0-flash-001` | Baixo | ~500ms |
| Geração de resposta | `anthropic/claude-3-haiku` | Médio | ~1s |
| Fallback | `openai/gpt-4o-mini` | Baixo | ~800ms |

---

## 7. Error Handling

### Fallback Pattern

```typescript
async function classifyWithFallback(state) {
  try {
    return await classifyNode(state);
  } catch (error) {
    console.error("Classification failed, using fallback", error);
    return {
      classification: {
        intent: "other",
        sentiment: "neutral",
        urgency: "medium",
        confidence: 0.5,
        reasoning: "Fallback due to classification error"
      },
      error: error.message
    };
  }
}
```

### Retry com Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(baseDelay * Math.pow(2, i));
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## 8. Observability

### Logging Structure

```typescript
interface TriagerLog {
  execution_id: string;
  comment_id: string;
  thread_id: string;

  // Timing
  started_at: Date;
  completed_at: Date;
  duration_ms: number;

  // Phases
  phases: {
    classify: { duration_ms: number; result: object };
    reason: { duration_ms: number; result: object };
    act: { duration_ms: number; tools: object[] };
    finalize: { duration_ms: number; result: object };
  };

  // Output
  ai_hint: string | null;
  labels_added: string[];
  tools_executed: string[];

  // Errors
  errors: Array<{ phase: string; message: string }>;
}
```

### Métricas

```typescript
// Prometheus-style metrics
const metrics = {
  triager_executions_total: Counter,
  triager_duration_seconds: Histogram,
  triager_classification_distribution: Counter,  // by intent
  triager_tools_called_total: Counter,           // by tool name
  triager_errors_total: Counter,                 // by phase
};
```

---

## Referências Externas

- [Intent Recognition & Auto-Routing](https://gist.github.com/mkbctrl/a35764e99fe0c8e8c00b2358f55cd7fa)
- [Building Multi-Agent Workflows](https://www.ema.co/additional-blogs/addition-blogs/multi-agent-workflows-langchain-langgraph)
- [Best AI Agent Frameworks 2025](https://langwatch.ai/blog/best-ai-agent-frameworks-in-2025-comparing-langgraph-dspy-crewai-agno-and-more)
- [LangGraph ToolNode Tutorial](https://medium.com/@vivekvjnk/introduction-to-tool-use-with-langgraphs-toolnode-0121f3c8c323)
- [ReAct Agents with LangGraph](https://dylancastillo.co/posts/react-agent-langgraph.html)
