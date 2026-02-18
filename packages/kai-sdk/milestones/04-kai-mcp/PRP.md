# KAI MCP — Suporte a Model Context Protocol

A KAI SDK nao suporta MCP. Ferramentas externas expostas via MCP servers (como `submit_job` do Backbone) sao invisiveis para o agente quando roda pelo provider KAI. O Vercel AI SDK ja tem suporte estavel a MCP via `@ai-sdk/mcp`. A KAI so precisa plugar.

---

## Objetivo

Permitir que a KAI SDK conecte a MCP servers e use suas ferramentas junto com as `codingTools` nativas, de forma transparente para o modelo.

## Execution Mode

`implementar`

---

## Contexto

### Estado Atual

```typescript
// agent.ts — so codingTools, nenhum MCP
result = streamText({
  model: openrouter(options.model),
  tools: codingTools,    // ← apenas Read, Write, Edit, Bash, Glob, Grep
  maxSteps: options.maxSteps ?? 30,
  messages,
});
```

O Backbone ja suporta MCP no provider Claude:

```typescript
// providers/claude.ts — MCP funciona com Claude Agent SDK
if (mcpServers) {
  for (const serverName of Object.keys(mcpServers)) {
    allowedTools.push(`mcp__${serverName}__*`);
  }
}
```

Mas no provider KAI, MCP e ignorado — resultado: o SKIP no relatorio de compatibilidade:

```
│ Job trigger cycle │ SKIP │ Kai provider (OpenRouter) não suporta MCP servers │
```

### Infra disponivel

O Vercel AI SDK ja tem suporte estavel a MCP:

| Pacote | Versao | O que faz |
|--------|--------|-----------|
| `@ai-sdk/mcp` | estavel | `createMCPClient()` — conecta a MCP servers via HTTP ou stdio |

```typescript
// Ja funciona no Vercel AI SDK
import { createMCPClient } from "@ai-sdk/mcp";

const client = await createMCPClient({
  transport: { type: "http", url: "http://localhost:8004/mcp" }
});
const mcpTools = await client.tools();

streamText({
  tools: { ...mcpTools, ...codingTools },  // ← codingTools por ultimo = prioridade
});
```

O modelo nao sabe a diferenca entre uma tool nativa (`Read`) e uma tool MCP (`submit_job`). Sao todas ferramentas.

---

## Especificacao

### Nova opcao em `KaiAgentOptions`

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `mcpServers` | `McpServerConfig[]` | `[]` | Lista de MCP servers para conectar |

```typescript
interface McpServerConfig {
  name: string;                          // nome logico (ex: "backbone-jobs")
  transport:
    | { type: "http"; url: string; headers?: Record<string, string> }
    | { type: "stdio"; command: string; args?: string[] };
}
```

### Exemplo de uso

```typescript
import { runKaiAgent } from "@agentic-backbone/kai-sdk";

for await (const event of runKaiAgent("executa o job de relatorio", {
  model: "anthropic/claude-3.5-sonnet",
  apiKey: "...",
  mcpServers: [
    {
      name: "backbone-jobs",
      transport: { type: "http", url: "http://localhost:8004/mcp" }
    }
  ]
})) {
  // agente agora ve tanto codingTools quanto tools do MCP server
}
```

### Ciclo de vida dos MCP clients

```
runKaiAgent() inicio
  │
  ├── 1. Para cada entry em options.mcpServers:
  │      └── createMCPClient(transport) → client
  │      └── client.tools() → mcpTools
  │
  ├── 2. Mergear: { ...allMcpTools, ...codingTools }  (codingTools tem prioridade)
  │
  ├── 3. streamText({ tools: mergedTools, ... })
  │      └── loop agentico normal
  │
  └── 4. Fechar todos os MCP clients (finally block)
         └── client.close() para cada client
```

### Comportamento

- MCP clients sao criados **uma vez** no inicio de `runKaiAgent()` e fechados no final
- Se um MCP server nao estiver disponivel (timeout de 10 segundos), emitir warning e continuar sem ele (nao falhar)
- Se um MCP server expoe uma tool com mesmo nome de uma codingTool, a **codingTool tem prioridade** (nao sobrescreve)
- Tools MCP aparecem para o modelo exatamente como tools nativas — sem prefixo, sem tratamento especial
- Se `mcpServers` nao for passado ou for array vazio, comportamento identico ao atual (sem MCP)

### Nova dependencia

| Pacote | Versao | Motivo |
|--------|--------|--------|
| `@ai-sdk/mcp` | `^0` (ou estavel se disponivel) | createMCPClient, transports |

### Novo evento (opcional)

```typescript
{ type: "mcp_connected", servers: string[] }
```

Emitido apos todos os MCP clients conectarem, antes do primeiro `streamText()`. Lista os nomes dos servers conectados com sucesso. Permite ao consumidor saber quais MCP servers estao ativos.

---

## Integracao com o Backbone

Apos este PRP, o provider KAI no Backbone pode propagar `mcpServers`:

```typescript
// providers/kai.ts — antes
yield* provider.run(prompt, options);

// providers/kai.ts — depois
yield* provider.run(prompt, {
  ...options,
  mcpServers: options.mcpServers  // ← propaga para runKaiAgent
});
```

Isso resolve o SKIP do relatorio de compatibilidade — o ciclo `Heartbeat → Job → Heartbeat` passa a funcionar com o provider KAI.

---

## Limites

### O que este PRP NAO cobre

- **Nao implementa um MCP server na KAI.** A KAI e cliente MCP, nao servidor. Ela consome tools de servers externos.
- **Nao implementa autenticacao OAuth para MCP.** Suporta apenas HTTP com headers fixos e stdio. OAuth e escopo futuro.
- **Nao implementa MCP resources ou prompts.** Apenas tools. Resources e prompts do MCP protocol sao escopo futuro.
- **Nao implementa reconexao automatica.** Se um MCP server cair durante a sessao, as tools dele deixam de funcionar. Sem retry.
- **Nao implementa descoberta automatica de MCP servers.** O consumidor deve listar explicitamente os servers em `mcpServers`.

### Restricoes tecnicas

- MCP clients devem ser fechados no `finally` block de `runKaiAgent()` para evitar vazamento de processos/conexoes
- Timeout de conexao MCP: 10 segundos. Se nao conectar, segue sem o server
- Tools MCP nao contam no orcamento de tokens do system prompt (PRP 02) — sao registradas diretamente no Vercel AI SDK como ferramentas
- `@ai-sdk/mcp` e a unica dependencia nova. Nao adicionar implementacao MCP custom

---

## Validacao

### Criterios de Aceite

Para a conexao:

- [ ] `@ai-sdk/mcp` adicionado como dependencia no `package.json`
- [ ] `mcpServers` aceito em `KaiAgentOptions` como array de `McpServerConfig`
- [ ] Transport HTTP funciona (conecta a um MCP server via URL)
- [ ] Transport stdio funciona (lanca um processo MCP server local)
- [ ] Server indisponivel emite warning e continua sem falhar
- [ ] MCP clients fechados no final de `runKaiAgent()` (sem vazamento)

Para as ferramentas:

- [ ] Tools de MCP servers aparecem junto com `codingTools` no `streamText()`
- [ ] Modelo consegue chamar uma tool MCP numa sessao real
- [ ] Conflito de nomes: codingTool tem prioridade sobre MCP tool de mesmo nome
- [ ] Sem MCP servers configurados, comportamento identico ao atual

Para o evento:

- [ ] Evento `mcp_connected` emitido com lista de servers conectados
- [ ] Evento tipado em `KaiAgentEvent`

Para integracao:

- [ ] Build passa sem erros (`npm run build` no workspace)
- [ ] Provider KAI no Backbone consegue propagar `mcpServers`

### Comando de validacao

```bash
npm run build --workspace=packages/kai-sdk
```

---

## Exemplos

### Antes — MCP invisivel para KAI

```
Backbone configura mcpServers: ["backbone-jobs"]
Provider Claude: ✅ ve submit_job, list_jobs, get_job_result
Provider KAI:    ❌ SKIP — nao ve nenhuma tool MCP
```

### Depois — MCP transparente

```
Backbone configura mcpServers: ["backbone-jobs"]
Provider Claude: ✅ ve submit_job, list_jobs, get_job_result
Provider KAI:    ✅ ve submit_job, list_jobs, get_job_result

Agente KAI:
  [submit_job] { type: "heartbeat", agentId: "system.probe" }
  → job criado, id: "job-123"
  [get_job_result] { jobId: "job-123" }
  → resultado do heartbeat recebido
```

### Uso standalone (sem Backbone)

```typescript
// KAI SDK direto com MCP server externo
for await (const event of runKaiAgent("liste os arquivos do projeto no github", {
  model: "anthropic/claude-3.5-sonnet",
  apiKey: "...",
  mcpServers: [
    {
      name: "github",
      transport: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"]
      }
    }
  ]
})) {
  console.log(event);
}
// Agente agora tem Read, Write, Edit, Bash, Glob, Grep + todas as tools do GitHub MCP
```
