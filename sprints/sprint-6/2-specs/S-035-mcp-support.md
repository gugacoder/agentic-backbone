# S-035 — MCP Support (Model Context Protocol)

Suporte ao Model Context Protocol (MCP) como cliente e servidor: agentes do Backbone se conectam a qualquer servidor MCP externo (Notion, GitHub, Jira, Postgres, etc.) e também são expostos como servidores MCP para clientes externos (Claude Desktop, Cursor, etc.).

**Resolve:** D-054 (sem suporte a MCP), G-055 (MCP como cliente e servidor)
**Score de prioridade:** 9

---

## 1. Objetivo

- Implementar cliente MCP no backbone: agentes podem usar ferramentas de qualquer servidor MCP configurado via ADAPTER.yaml
- Implementar servidor MCP no backbone: expõe os agentes como endpoints MCP consumíveis por clientes externos
- UI de descoberta e configuração de servidores MCP no Hub
- Integração com o sistema de adaptadores existente (precedência: shared → system → agent)
- Zero mudanças na API pública existente de conversas/heartbeat

---

## 2. Schema DB

### 2.1 Tabela `mcp_tool_calls` (auditoria de chamadas MCP)

```sql
CREATE TABLE IF NOT EXISTS mcp_tool_calls (
  id            TEXT PRIMARY KEY,          -- uuid v4
  agent_id      TEXT NOT NULL,
  adapter_id    TEXT NOT NULL,             -- ID do adapter MCP
  tool_name     TEXT NOT NULL,
  input         TEXT NOT NULL,             -- JSON
  output        TEXT,                      -- JSON (null se erro)
  error         TEXT,
  duration_ms   INTEGER,
  called_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mcp_tool_calls_agent ON mcp_tool_calls(agent_id);
CREATE INDEX idx_mcp_tool_calls_adapter ON mcp_tool_calls(adapter_id);
```

---

## 3. Connector MCP Cliente (`src/connectors/mcp/`)

### 3.1 Estrutura

```
src/connectors/mcp/
  index.ts         # ConnectorDef
  client.ts        # Cliente MCP via @modelcontextprotocol/sdk
  schemas.ts       # Zod schemas para ADAPTER.yaml
  tools/
    call-tool.ts   # Tool genérica: chama qualquer ferramenta do servidor MCP
    list-tools.ts  # Tool: lista ferramentas disponíveis no servidor
    index.ts
```

### 3.2 Schema ADAPTER.yaml para servidor MCP (transporte stdio)

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
  allowed_tools: []   # vazio = todas as ferramentas expostas pelo servidor
policy: readwrite
```

### 3.3 Schema ADAPTER.yaml para servidor MCP (transporte HTTP)

```yaml
connector: mcp
credential:
  api_key: "${MCP_API_KEY}"   # opcional
options:
  transport: http
  url: "https://mcp.notion.so/sse"
  server_label: "Notion MCP"
  allowed_tools: ["read_page", "create_page", "search"]
policy: readwrite
```

### 3.4 Integração no runAgent()

Ao compor o prompt do agente, o sistema descobre todos os adapters MCP habilitados no escopo do agente (shared + system + agent-specific). Para cada adapter MCP, conecta via SDK e obtém a lista de ferramentas disponíveis. Essas ferramentas são injetadas no contexto do agente como tools nativas da Vercel AI SDK, com prefixo `mcp_{adapter_slug}_{tool_name}`.

```typescript
// Exemplo de tool gerada dinamicamente
const githubTools = await mcpClient.listTools()
// → tools: [{ name: "mcp_github_create_issue", description: "...", inputSchema: {...} }]
```

Chamadas são auditadas em `mcp_tool_calls`.

### 3.5 Tool `list_mcp_tools`

```typescript
// Input: { adapterId?: string }
// Output: { tools: Array<{ name, description, inputSchema }> }
```

---

## 4. Servidor MCP (`src/mcp-server/`)

### 4.1 Estrutura

```
src/mcp-server/
  index.ts       # Inicializa e expõe o servidor MCP do backbone
  server.ts      # Implementação MCP Server via @modelcontextprotocol/sdk
  tools.ts       # Ferramentas expostas: send_message, get_agent_status, list_agents
```

### 4.2 Transporte

- SSE endpoint: `GET /mcp/sse` (autenticado via JWT query param ou header)
- Cada conexão representa um cliente externo (Claude Desktop, Cursor, etc.)

### 4.3 Ferramentas expostas pelo backbone como servidor MCP

| Tool | Descrição | Input | Output |
|------|-----------|-------|--------|
| `list_agents` | Lista agentes ativos | `{}` | `{ agents: Array<{ id, label, enabled }> }` |
| `send_message` | Envia mensagem para agente | `{ agentId, message, sessionId? }` | `{ response, sessionId }` |
| `get_agent_status` | Status atual do agente | `{ agentId }` | `{ heartbeat, lastActivity, enabled }` |
| `get_agent_memory` | Busca na memória semântica | `{ agentId, query }` | `{ results: Array<{ content, score }> }` |

### 4.4 Configuração do servidor MCP

Em `context/system/mcp-server.json`:

```json
{
  "enabled": false,
  "allowed_agents": [],   // vazio = todos os agentes acessíveis
  "require_auth": true    // JWT obrigatório
}
```

---

## 5. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/mcp-tools` | Listar ferramentas MCP disponíveis para o agente |
| GET | `/agents/:id/mcp-calls` | Histórico de chamadas MCP do agente |
| GET | `/mcp/sse` | SSE endpoint do servidor MCP (para clientes externos) |
| GET | `/settings/mcp-server` | Config do servidor MCP |
| PUT | `/settings/mcp-server` | Atualizar config do servidor MCP |

---

## 6. Telas (Hub)

### 6.1 `/adapters` — Seção MCP

- Novo tipo de adapter: "MCP Server" com ícone diferenciado
- Formulário de criação:
  - Transporte: `stdio` ou `http`
  - Stdio: campo Command, campo Args (lista), campos Env vars (key-value editor)
  - HTTP: campo URL, campo API Key (opcional)
  - Campo: Server Label
  - Campo: Allowed Tools (multi-select após conexão de teste)
- Botão "Testar conexão" — conecta e lista tools disponíveis
- Após criação: lista de ferramentas descobertas (nome + descrição)

### 6.2 `/agents/:id` — Aba "MCP Tools"

- Lista de adaptadores MCP habilitados no escopo do agente
- Por adapter: nome do servidor, lista de ferramentas, status de conexão
- Gráfico: chamadas MCP nas últimas 24h por ferramenta
- Tabela: últimas 20 chamadas (ferramenta, input resumido, status, duração)

### 6.3 `/settings` — Seção "MCP Server"

- Toggle "Habilitar servidor MCP"
- Campo: Agentes acessíveis (multi-select ou "todos")
- Toggle "Exigir autenticação JWT"
- Instruções de conexão: URL do endpoint SSE, exemplo de configuração para Claude Desktop
- Botão "Copiar config para Claude Desktop" (gera JSON de configuração)

---

## 7. Dependências

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0"
}
```

---

## 8. Critérios de Aceite

- [ ] Adapter MCP com transporte stdio conecta a servidor (ex: `@modelcontextprotocol/server-github`) e expõe tools ao agente
- [ ] Adapter MCP com transporte HTTP conecta a servidor SSE e expõe tools ao agente
- [ ] Ferramentas MCP aparecem no prompt do agente e podem ser chamadas durante execução
- [ ] Cada chamada MCP é registrada em `mcp_tool_calls` com input, output e duração
- [ ] `allowed_tools` filtra corretamente quais ferramentas são expostas ao agente
- [ ] Endpoint `/mcp/sse` permite que Claude Desktop/Cursor se conecte e liste agentes
- [ ] Tool `send_message` via MCP Server cria sessão e retorna resposta do agente
- [ ] Histórico de chamadas MCP exibido na aba do agente no Hub
- [ ] Botão "Copiar config para Claude Desktop" gera JSON válido de configuração MCP
- [ ] Múltiplos adapters MCP coexistem sem conflito de nomes de tools (prefixo por adapter)
