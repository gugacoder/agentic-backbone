# PRP-35 — MCP Support (Model Context Protocol)

Suporte ao Model Context Protocol como cliente e servidor: agentes do Backbone se conectam a qualquer servidor MCP externo via ADAPTER.yaml, e o Backbone é exposto como servidor MCP para clientes externos (Claude Desktop, Cursor, etc.).

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha suporte a MCP no backbone. Agentes so podem usar tools internas (built-in + TOOL.md). Nao existe endpoint MCP Server. Nao ha tabela de auditoria de chamadas MCP.

### Estado desejado

1. Tabela `mcp_tool_calls` no SQLite para auditoria de chamadas
2. Connector `mcp` em `src/connectors/mcp/` com suporte a transporte `stdio` e `http`
3. Tools MCP injetadas dinamicamente em `runAgent()` com prefixo por adapter
4. Endpoint `/mcp/sse` para clientes externos (Claude Desktop, Cursor)
5. GUI de configuracao de adapters MCP e aba "MCP Tools" no agente

## Especificacao

### Feature F-123: Tabela mcp_tool_calls + migracao DB

**Nova tabela em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS mcp_tool_calls (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  adapter_id    TEXT NOT NULL,
  tool_name     TEXT NOT NULL,
  input         TEXT NOT NULL,
  output        TEXT,
  error         TEXT,
  duration_ms   INTEGER,
  called_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mcp_tool_calls_agent ON mcp_tool_calls(agent_id);
CREATE INDEX idx_mcp_tool_calls_adapter ON mcp_tool_calls(adapter_id);
```

Adicionar migracao no startup do backbone.

### Feature F-124: Connector MCP Cliente (stdio + HTTP)

**Nova estrutura em `src/connectors/mcp/`:**

```
src/connectors/mcp/
  index.ts         # ConnectorDef com client factory, schemas, tools
  client.ts        # Cliente MCP via @modelcontextprotocol/sdk (stdio + http)
  schemas.ts       # Zod schemas para ADAPTER.yaml
  tools/
    call-tool.ts   # Tool: chama ferramenta especifica do servidor MCP
    list-tools.ts  # Tool: lista ferramentas disponíveis no servidor
    index.ts
```

**Schema ADAPTER.yaml — transporte stdio:**

```yaml
connector: mcp
credential: {}
options:
  transport: stdio
  command: "npx"
  args: ["-y", "@modelcontextprotocol/server-github"]
  env:
    GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
  server_label: "GitHub MCP"
  allowed_tools: []   # vazio = todas
policy: readwrite
```

**Schema ADAPTER.yaml — transporte HTTP:**

```yaml
connector: mcp
credential:
  api_key: "${MCP_API_KEY}"
options:
  transport: http
  url: "https://mcp.notion.so/sse"
  server_label: "Notion MCP"
  allowed_tools: ["read_page", "create_page"]
policy: readwrite
```

**Integracao em `runAgent()`:**

Ao compor o prompt do agente, descobrir todos os adapters MCP habilitados no escopo (shared + system + agent). Para cada adapter, conectar via SDK, obter lista de ferramentas e injeta-las como tools nativas da Vercel AI SDK com prefixo `mcp_{adapter_slug}_{tool_name}`. Cada chamada auditada em `mcp_tool_calls`.

**Endpoints adicionais:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:id/mcp-tools` | Listar ferramentas MCP disponíveis para o agente |
| GET | `/agents/:id/mcp-calls` | Historico de chamadas MCP do agente |

**Dependencia de pacote:**

```json
{ "@modelcontextprotocol/sdk": "^1.0.0" }
```

### Feature F-125: Servidor MCP do Backbone (endpoint SSE para clientes externos)

**Nova estrutura em `src/mcp-server/`:**

```
src/mcp-server/
  index.ts   # Inicializa servidor MCP e registra rota /mcp/sse
  server.ts  # Implementacao via @modelcontextprotocol/sdk
  tools.ts   # Tools expostas: list_agents, send_message, get_agent_status, get_agent_memory
```

**Tools expostas pelo backbone como servidor MCP:**

| Tool | Descricao | Input | Output |
|------|-----------|-------|--------|
| `list_agents` | Lista agentes ativos | `{}` | `{ agents: Array<{ id, label, enabled }> }` |
| `send_message` | Envia mensagem para agente | `{ agentId, message, sessionId? }` | `{ response, sessionId }` |
| `get_agent_status` | Status atual do agente | `{ agentId }` | `{ heartbeat, lastActivity, enabled }` |
| `get_agent_memory` | Busca na memoria semantica | `{ agentId, query }` | `{ results: Array<{ content, score }> }` |

**Configuracao em `context/system/mcp-server.json`:**

```json
{
  "enabled": false,
  "allowed_agents": [],
  "require_auth": true
}
```

**Endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/mcp/sse` | SSE endpoint do servidor MCP (JWT via query param ou header) |
| GET | `/settings/mcp-server` | Obter config do servidor MCP |
| PUT | `/settings/mcp-server` | Atualizar config do servidor MCP |

### Feature F-126: Hub — Configuracao de adapters MCP + Aba "MCP Tools" + Settings MCP Server

**`/adapters` — Formulario para tipo "MCP Server":**

- Select de transporte: `stdio` ou `http`
- Stdio: campos Command, Args (lista), Env vars (editor key-value)
- HTTP: campo URL, campo API Key (opcional)
- Campo: Server Label
- Campo: Allowed Tools (multi-select apos conexao de teste)
- Botao "Testar conexao" — conecta e lista tools disponíveis
- Apos criacao: lista de ferramentas descobertas (nome + descricao)

**`/agents/:id` — Aba "MCP Tools":**

- Lista de adapters MCP habilitados no escopo do agente
- Por adapter: nome do servidor, lista de ferramentas, status de conexao
- Grafico: chamadas MCP nas últimas 24h por ferramenta
- Tabela: últimas 20 chamadas (ferramenta, input resumido, status, duracao)

**`/settings` — Secao "MCP Server":**

- Toggle "Habilitar servidor MCP"
- Campo: Agentes acessíveis (multi-select ou "todos")
- Toggle "Exigir autenticacao JWT"
- Instrucoes de conexao: URL do endpoint SSE, exemplo de configuracao para Claude Desktop
- Botao "Copiar config para Claude Desktop" (gera JSON de configuracao)

## Limites

- **NAO** implementar autenticacao OAuth para servidores MCP remotos (apenas API key ou sem auth)
- **NAO** implementar caching de resultados MCP entre sessoes
- **NAO** implementar painel de administracao de servidores MCP remotos publicos

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba adicionada
- **PRP-12** (Sistema de Adapters) deve estar implementado — novo tipo de adapter

## Validacao

- [ ] Adapter MCP stdio conecta a servidor (ex: `@modelcontextprotocol/server-github`) e expoe tools ao agente
- [ ] Adapter MCP HTTP conecta a servidor SSE e expoe tools ao agente
- [ ] Tools MCP aparecem no prompt do agente e podem ser chamadas durante execucao
- [ ] Cada chamada MCP e registrada em `mcp_tool_calls` com input, output e duracao
- [ ] `allowed_tools` filtra corretamente quais ferramentas sao expostas ao agente
- [ ] Multiplos adapters MCP coexistem sem conflito (prefixo por adapter_slug)
- [ ] Endpoint `/mcp/sse` permite que Claude Desktop/Cursor se conecte e liste agentes
- [ ] Tool `send_message` via MCP Server cria sessao e retorna resposta do agente
- [ ] Botao "Copiar config para Claude Desktop" gera JSON valido
- [ ] Historico de chamadas MCP exibido na aba do agente no Hub
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-123 Tabela mcp_tool_calls | S-035 sec 2 | D-054 |
| F-124 Connector MCP Cliente | S-035 sec 3 | D-054, G-055 |
| F-125 Servidor MCP (SSE) | S-035 sec 4 | G-055 |
| F-126 Hub MCP Tools + Settings | S-035 sec 6 | G-055 |
