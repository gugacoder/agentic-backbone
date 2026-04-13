# Milestone 24 — Migracao para OpenClaude SDK

Migrar o backbone de `@agentic-backbone/ai-sdk` (Vercel AI SDK) para `@codrstudio/openclaude-sdk` (Claude Code CLI wrapper).

**Escopo:** backbone + openclaude-sdk. O openclaude-chat tem seu proprio milestone.

## Recursos

| Recurso | Caminho |
|---|---|
| **Backbone** | `apps/backbone/` (este repo) |
| **OpenClaude SDK** (editavel) | `D:\aw\context\workspaces\openclaude-sdk\repo\` |
| **OpenClaude SDK demo** | `D:\aw\context\workspaces\openclaude-sdk\repo\.tmp\demo` |
| **Decisoes (D-01 a D-20)** | `DECISIONS.md` (neste milestone) |
| **Principios** | `PRINCIPLES.md` (neste milestone) |
| **Rotas** | `ROTAS.md` (neste milestone) |
| **Uso atual da ai-sdk no backbone** | `BACKBONE-USAGE.md` (neste milestone) — todos os imports, eventos consumidos, tools |
| **Planos YAML** | `context/plans/*.yml` |

### Como compilar e testar a openclaude-sdk

```bash
cd D:\aw\context\workspaces\openclaude-sdk\repo
npm run build          # compila pra dist/
npm link               # disponibiliza globalmente

cd D:\aw\context\workspaces\ab\repo
npm link @codrstudio/openclaude-sdk   # linka no backbone
```

---

## Checklist de implementacao

### Fase 1 — Fundacao (sem dependencias entre si, podem ser paralelas)

- [x] **Plan resolver** (D-07)
  - Criar Zod schema que valida planos YAML (context/plans/*.yml)
  - Loader que le e valida os 5 planos (free, economic, standard, premium, max)
  - `resolve(role, plan)` → slug → `{ provider, model, parameters }`
  - `resolve(slug, plan)` → `{ provider, model, parameters }`
  - Provider obrigatorio no schema (nunca inferido)
  - Remover: RoutingRule, RoutingContext, resolveModelResult, todo codigo legado de routing em `src/settings/llm.ts`
  - Manter: PROVIDER_CONFIGS (baseURL, apiKeyEnv) — ainda necessario pra montar ProviderRegistry

- [x] **MCP server builtin** (D-05, D-19)
  - Criar script Node.js: MCP server stdio com @modelcontextprotocol/sdk
  - Expor tools internas: jobs (submit, list, get, kill), memory (search, save), cron (list, create, delete), messages (send), emit, sysinfo
  - Cada tool: name, description, inputSchema (Zod), handler → CallToolResult
  - Testar: passar pro query() como `{ type: "stdio", command: "node", args: ["caminho/do/server.mjs"] }`
  - Referencia: `.tmp/mcp-stdio-server.mjs` (teste funcional criado durante decisoes)

- [x] **CLAUDE_CONFIG_DIR por agente** (D-13)
  - Criar `context/agents/{agentId}/.claude-config/` na inicializacao do agente
  - Copiar `~/.claude/.credentials.json` pra la (se nao existir)
  - Skills do agente em `.claude-config/skills/{slug}/SKILL.md`
  - Referencia: `.tmp/agent-config-test/` (teste funcional criado durante decisoes)

### Fase 2 — Core (depende da Fase 1)

- [x] **Reescrever src/agent/index.ts** (D-01, D-06, D-13, D-20)
  - Importar `query` de `@codrstudio/openclaude-sdk`
  - Montar options por modo de execucao:
    - **Todos os modos:** env.CLAUDE_CONFIG_DIR, systemPrompt, mcpServers (builtin + adapters filtrados), model (do plan resolver)
    - **conversation:** cwd = `agents/{id}/conversations/{sessionId}/`, persistSession = true, resume entre turnos
    - **heartbeat:** cwd = `agents/{id}/heartbeat/`, persistSession = false, sem resume
    - **cron:** cwd = `agents/{id}/cron/{cronJobId}/`, persistSession = false, sem resume
    - **request/webhook:** cwd = `agents/{id}/requests/{requestId}/`, persistSession = false, sem resume
  - Mapear SDKMessage → tipo backbone enxuto (text, tool-call, tool-result, usage, result)
  - O mapeamento fica num unico ponto — consumidores do backbone nao conhecem SDKMessage

- [x] **Adaptar stream-dispatcher.ts** (D-06)
  - Substituir `step_finish` por boundary na chegada de SDKAssistantMessage completa
  - Logica: quando chega SDKAssistantMessage com content blocks, flush buffer pro canal

- [x] **Remover datastream.ts** (D-06)
  - Protocolo Vercel AI SDK DataStream descartado
  - Remover arquivo ou reescrever pra SSE de SDKMessage

### Fase 3 — Rotas (depende da Fase 2)

- [x] **GET /conversations/:id/messages** (D-12, D-13)
  - Ler do JSONL do CLI em `{CLAUDE_CONFIG_DIR}/projects/<sanitized-cwd>/<sessionId>.jsonl`
  - Filtrar: retornar apenas type "user" e "assistant" (ignorar queue-operation, attachment, last-prompt)
  - Converter formato CLI → formato que o chat espera
  - Paginacao cursor-based reversa: `?limit=50&before=cursor` → `{ messages, hasMore, cursor }`
  - Conversas legacy (formato antigo {role, content, _meta}) convertidas on-the-fly
  - Spec de historico: `CHAT-HISTORY.md`

- [x] **POST /conversations/:id/messages** (D-06, D-11, D-13)
  - Usar query() com resume + config do agente
  - Stream SSE de SDKMessage pro chat (todos os tipos relevantes — ver CHAT-RICH-MESSAGES.md)
  - Capturar `result` event do stream e gravar stats em SQLite (custo, tokens, duracao)
  - Repassar richOutput do request pro query()
  - Attachments: salvar no workspace do agente, passar caminho absoluto no prompt

- [x] **Multi-agent** (D-14)
  - POST messages aceita `agentId` no body
  - Se fornecido, backbone resolve o agente e passa systemPrompt + mcpServers + model daquele agente pro query()
  - POST /conversations aceita `multiAgent?: boolean`
  - GET /agents retorna lista de agentes do usuario

- [x] **Normalizar respostas** (D-10)
  - `starred` retorna boolean (nao 0/1) em GET /conversations

### Fase 4 — Swap e cleanup

- [x] **Trocar dependencias** (D-15, D-18)
  - backbone: `@agentic-backbone/ai-sdk` → `@codrstudio/openclaude-sdk`
  - hub: `@agentic-backbone/ai-chat` → `@codrstudio/openclaude-chat`
  - apps/chat: `@agentic-backbone/ai-chat` → `@codrstudio/openclaude-chat`
  - Atualizar todos os imports
  - Remover `memory/flush.ts` (D-02)
  - **Manter** pacote `ai` (Vercel) — 60+ tools ainda usam `import { tool } from "ai"` (D-18)

- [ ] **Remover pacotes antigos** (adiado — ai-chat ainda depende de ai-sdk, removido no milestone do openclaude-chat)
  - Remover `apps/packages/ai-sdk/`
  - Remover `apps/packages/ai-chat/`
  - Remover deps orfas (@ai-sdk/react, etc.)

- [x] **Atualizar CLAUDE.md**
  - Refletir nova arquitetura (openclaude-sdk, planos, MCP, CLAUDE_CONFIG_DIR)

### Validacao

- [ ] Conversa basica (enviar/receber)
- [ ] Tool calls via MCP (stdio builtin + http externo)
- [ ] Cron + heartbeat (persistSession false, sem residuo)
- [ ] Cost tracking (result → SQLite)
- [ ] Multi-agent (troca de agente por turno)
- [ ] Display renderers (match por sufixo mcp__display__*)
- [ ] `npm run build` compila sem erros
- [ ] `npm run dev:all` funciona sem regressao
