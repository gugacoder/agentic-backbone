# Plano de Implementacao — Agentic Backbone (CONCEPT.md)

## Contexto

O **third-brain** (`D:\sources\_unowned\third-brain`) validou o conceito OpenClaw com sucesso: heartbeat autonomo, memoria semantica (PostgreSQL + pgvector), skills, adapters, SSE streaming, e dashboard React. Agora vamos implementar o CONCEPT.md completo no **agentic-backbone**, portando os padroes comprovados do third-brain e adaptando para SQLite + Claude Agent SDK.

**O que ja existe no agentic-backbone** (~430 linhas de codigo funcional):
- Hono HTTP server (porta 7700) com 4 endpoints
- Agent runner wrapping Claude Agent SDK `query()` com `AsyncGenerator<AgentEvent>`
- Sessoes SQLite + in-memory Map
- Context loader (SOUL.md, skills, tools, adapters, heartbeat instructions)
- Heartbeat 30s com guards (already-running, empty-instructions, duplicate) e HEARTBEAT_OK
- Frontmatter YAML parser

**O que falta**: Event bus, SSE broadcasting, estrutura de contexto por agente, channels, skills completos, memoria semantica, tasks/sub-agents, multi-agent, users.

---

## Fase 0 — Event Bus + SSE Infrastructure

**Objetivo**: Criar a infraestrutura de eventos que todas as fases seguintes precisam.

### Criar:
- **`src/events/index.ts`** — EventEmitter tipado com tipos de evento:
  - `heartbeat:status` (agentId, status, preview, durationMs)
  - `channel:message` (channelId, agentId, content, role)
  - Cache do ultimo evento por tipo (para catch-up de novos SSE clients)

- **`src/events/sse.ts`** — SSE hub para gerenciar conexoes:
  - `subscribe(channelId, stream)` / `unsubscribe`
  - `broadcast(channelId, event)` — envia para todos os clients daquele channel
  - Ping keep-alive a cada 30s
  - Catch-up: ao conectar, envia ultimo evento

### Modificar:
- **`src/heartbeat/index.ts`** — Substituir o TODO na linha 112 por emissao de evento via event bus
- **`src/routes/index.ts`** — Adicionar `GET /system/events` (SSE stream do system channel)

### Verificacao:
- `curl -N http://localhost:7700/system/events` recebe heartbeat events
- Multiplos clients SSE recebem os mesmos eventos
- Ping keep-alive a cada 30s

---

## Fase 1 — Reestruturacao do Contexto

**Objetivo**: Migrar de estrutura plana (`context/memory/`, `context/heartbeat/`) para a estrutura entity-based do CONCEPT.md, criando `system.main` como primeiro agente.

### Nova estrutura de diretorios:
```
context/
  shared/
    skills/
    tools/
    adapters/
  system/
    SOUL.md                              ← mover de context/memory/SOUL.md
    skills/
    tools/
    adapters/
  users/
    system/
      USER.md                            ← novo
      channels/
        system-channel/
          CHANNEL.md                     ← novo
  agents/
    system.main/
      AGENT.md                           ← novo (owner: system, delivery: system-channel)
      SOUL.md                            ← opcional, override do system/SOUL.md
      HEARTBEAT.md                       ← mover de context/heartbeat/INSTRUCTIONS.md
      MEMORY.md                          ← mover de context/memory/MEMORY.md
      memory/
      tasks/
      skills/
      tools/
      adapters/
      conversations/
```

### Criar:
- **`src/context/paths.ts`** — Resolver central de caminhos:
  - `CONTEXT_DIR`, `agentDir(id)`, `userDir(slug)`, `channelDir(user, slug)`, `sharedDir()`, `systemDir()`
  - `parseAgentId("system.main")` → `{ owner: "system", slug: "main" }`

- **`src/context/resolver.ts`** — Resolver com precedencia:
  - System agents: `shared/ → system/ → agents/system.*`
  - User agents: `shared/ → users/{user}/ → agents/{user}.*`
  - `resolveResources(agentId, "skills"|"tools"|"adapters")` → merged `ContextEntry[]`
  - `resolveAgentSoul(agentId)` → concatena/override por precedencia

### Modificar:
- **`src/context/index.ts`** — Refatorar `loadSkills()`, `loadTools()`, `loadAdapters()`, `loadSoul()`, `loadHeartbeatInstructions()` para aceitar `agentId`. `assembleHeartbeatPrompt(agentId)` e `assembleConversationPrompt(agentId, message)` tornam-se agent-aware.
- **`src/heartbeat/index.ts`** — Usar `assembleHeartbeatPrompt("system.main")`
- **`src/conversations/index.ts`** — Usar `assembleConversationPrompt("system.main", message, userId)`

### Verificacao:
- `loadSoul("system.main")` carrega `agents/system.main/SOUL.md` com fallback para `system/SOUL.md`
- `loadSkills("system.main")` faz merge `shared/skills/ + system/skills/ + agents/system.main/skills/`
- Heartbeat continua funcionando apos reestruturacao
- Conversas continuam funcionando

---

## Fase 2 — Agent Entity + System Channel

**Objetivo**: Introduzir Agent e Channel como entidades runtime. Implementar o System Channel como canal built-in do sistema.

### Criar:
- **`src/agents/types.ts`** — `AgentConfig` (id, owner, slug, delivery, heartbeat config)
- **`src/agents/registry.ts`** — Scan `context/agents/` por `AGENT.md`, parseia frontmatter, retorna configs. `getAgent(id)`, `listAgents()`, `getSystemAgent()`

- **`src/channels/types.ts`** — `ChannelConfig` (id, owner, type) e `ChannelMessage`
- **`src/channels/registry.ts`** — Scan `context/users/*/channels/` por `CHANNEL.md`. `getChannel(id)`, `listChannels()`
- **`src/channels/system-channel.ts`** — Implementacao do system channel:
  - Integra com o SSE hub da Fase 0
  - `deliver(message)` → broadcast via SSE hub
  - Sempre "listened to" (guard no-listeners nao se aplica)

### Modificar:
- **`src/routes/index.ts`** — Adicionar:
  - `POST /system/messages` → envia mensagem ao system agent
  - `POST /channels/:channelId/messages` → envia ao agente do canal
  - `GET /channels/:channelId/events` → SSE stream por canal
  - Manter `/conversations/*` para backward compatibility
- **`src/heartbeat/index.ts`** — Entregar output via system channel em vez de apenas console.log

### Verificacao:
- `POST /system/messages { message: "hello" }` → SSE response via `GET /system/events`
- Heartbeat output aparece no `GET /system/events`
- `GET /health` mostra agentes e canais registrados

---

## Fase 3 — Skills System

**Objetivo**: Sistema completo de skills com loading por precedencia, eligibility filtering, e prompt injection.

### Criar:
- **`src/skills/types.ts`** — `SkillEntry` (slug, path, metadata, content, source, eligible, ineligibleReason), `SkillFrontmatter`
- **`src/skills/loader.ts`** — Usa resolver da Fase 1. Scan multi-nivel com merge por nome (ultimo ganha). Parseia YAML frontmatter de cada `SKILL.md`
- **`src/skills/eligibility.ts`** — Filtros: OS check (`process.platform`), binary check (which/where), env var check, `always: true` bypass. Portar logica do third-brain `src/skills/index.ts`
- **`src/skills/prompt.ts`** — Gera bloco `<available_skills>` para system prompt. So inclui skills elegiveis. Instrucao: "Read SKILL.md when relevant"

### Modificar:
- **`src/context/index.ts`** — Substituir o loading inline de skills (linhas 83-91) pelo novo `skills/prompt.ts`

### Exemplo de skill para criar:
```
context/shared/skills/memory-search/SKILL.md
```

### Verificacao:
- Skill em `context/shared/skills/test/SKILL.md` aparece no prompt
- Skill em `agents/system.main/skills/test/` override o shared
- Skill com `os: ["linux"]` e filtrado no Windows
- Skill com `requires.env: ["MISSING"]` marcado inelegivel

---

## Fase 4 — Memory System

**Objetivo**: Memoria semantica com SQLite (FTS5 + sqlite-vec), portando o padrao hybrid search do third-brain.

### Dependencias a adicionar:
```json
"sqlite-vec": "^0.1",
"openai": "^4",
"chokidar": "^4"
```

### Criar:
- **`src/memory/types.ts`** — `MemoryChunk`, `MemorySearchResult`, `MemoryConfig`
- **`src/memory/schema.ts`** — Schema SQLite:
  - `files(id, path, hash, mtime, size)`
  - `chunks(id, file_id, text, start_line, end_line, hash)`
  - `chunks_vec` — virtual table vec0 (embedding float[1536])
  - `chunks_fts` — FTS5 virtual table (text)
  - `embedding_cache(provider, model, hash, embedding)`
  - Carrega sqlite-vec extension via `load()`
  - DB por agente: `data/memory/{agentId}.sqlite`

- **`src/memory/chunker.ts`** — Portar de third-brain `src/memory/indexer.ts`:
  - Split por linhas, target ~400 tokens (x 4 chars), overlap 80 tokens
  - Preservar line numbers (startLine, endLine)
  - SHA-256 hash por chunk para change detection

- **`src/memory/embeddings.ts`** — Interface: `embed(texts: string[]): Promise<Float32Array[]>`
  - Provider OpenAI: `text-embedding-3-small` (1536 dims) via `openai` npm
  - Abstraction para adicionar Gemini/Voyage/Local depois

- **`src/memory/indexer.ts`** — Pipeline:
  1. Scan `MEMORY.md + memory/*.md` do agente
  2. Hash files, detectar mudancas
  3. Chunk → check cache → embed uncached → upsert SQLite
  4. Cleanup chunks de files removidos/alterados

- **`src/memory/search.ts`** — Hybrid search (portar de third-brain):
  - Vector: `SELECT from chunks_vec WHERE embedding MATCH query LIMIT N*4`
  - BM25: `SELECT from chunks_fts WHERE text MATCH query ORDER BY rank LIMIT N*4`
  - Merge: `0.7 * vecScore + 0.3 * bm25Score`
  - Filter `minScore`, limit `maxResults`

- **`src/memory/manager.ts`** — Singleton por agente:
  - `getMemoryManager(agentId)` → lazy init
  - `sync()` → re-index changed files
  - `search(query)` → hybrid search
  - File watching com chokidar (debounced)
  - Dirty flag + auto-sync antes de search

### Modificar:
- **`src/context/index.ts`** — Na montagem do prompt, incluir `<memory_context>` com resultados de busca relevantes ao input do usuario
- **`apps/backbone/package.json`** — Adicionar dependencias
- **`.env.example`** — Adicionar `OPENAI_API_KEY`

### Verificacao:
- MEMORY.md com conteudo → indexer gera chunks e embeddings no SQLite
- `search("topico X")` retorna chunks relevantes com scores
- Alterar MEMORY.md → re-indexing automatico (apenas chunks alterados)
- Embedding cache evita re-embedding de chunks iguais
- Deletar o `.sqlite` e re-indexar produz resultado identico

---

## Fase 5 — Heartbeat Multi-Agent + Active Hours

**Objetivo**: Evoluir de timer unico global para scheduler multi-agent com active hours.

### Criar:
- **`src/heartbeat/active-hours.ts`** — `isWithinActiveHours(config)`: formato "HH:MM", suporte overnight, timezone-aware. Portar de third-brain
- **`src/heartbeat/scheduler.ts`** — Scheduler multi-agent:
  - `HeartbeatAgentState[]` por agente registrado
  - Cada agente tem intervalMs, nextDueMs, lastRunMs proprios
  - Single `setTimeout` aponta para o proximo agente due
  - `addAgent(agentId, config)`, `removeAgent(agentId)`

### Modificar:
- **`src/heartbeat/index.ts`** — Refatorar:
  - `tick(agentId)` em vez de `tick()` global
  - Guard `no-listeners`: check se ha SSE clients no canal do agente
  - Guard `active-hours`: check via `isWithinActiveHours()`
  - State vira `Map<agentId, HeartbeatState>`
  - `startHeartbeat()` descobre agentes com heartbeat.enabled e registra no scheduler

### Verificacao:
- system.main continua com heartbeat normal
- Segundo agente com `every: "1m"` tem ciclo independente
- Active hours: fora da janela, heartbeat skip
- `GET /health` mostra status por agente

---

## Fase 6 — Tools, Adapters, Users

**Objetivo**: Completar o sistema com tools loading, adapter registry, e user management.

### Criar:
- **`src/tools/loader.ts`** — Mesmo padrao de skills, scan por `TOOL.md` com merge por precedencia
- **`src/tools/prompt.ts`** — Gera `<available_tools>` block para prompt
- **`src/adapters/types.ts`** — Interface: `OutboundAdapter { id, sendText(text): Promise<boolean> }`
- **`src/adapters/registry.ts`** — Factory pattern com lazy instantiation (portar de third-brain). Plugin pattern: `registerOutbound(id, factory)`, `resolveOutbound(id)`
- **`src/adapters/console.ts`** — Adapter built-in: log para stdout (desenvolvimento)
- **`src/users/types.ts`** — `UserConfig` (slug, displayName, permissions)
- **`src/users/manager.ts`** — Scan `context/users/` por `USER.md`. CRUD: createUser, getUser, listUsers

### Modificar:
- **`src/context/index.ts`** — Integrar tools context no prompt assembly
- **`src/routes/index.ts`** — Adicionar rotas de user management:
  - `POST /users`, `GET /users`, `GET /users/:userId`
  - `POST /users/:userId/agents`

### Verificacao:
- TOOL.md em `context/shared/tools/web-search/` aparece no prompt
- Console adapter recebe heartbeat output
- Criar user → estrutura de diretorios criada em `context/users/{slug}/`

---

## Fase 7 — Conversation Persistence + Memory Flush

**Objetivo**: Persistir conversas no filesystem e implementar memory flush pre-compaction.

### Criar:
- **`src/conversations/persistence.ts`** — Escrita para filesystem:
  - `agents/{agentId}/conversations/{sessionId}/SESSION.md` (metadata)
  - `agents/{agentId}/conversations/{sessionId}/messages.jsonl` (transcript)
  - Append por mensagem, read-back para contexto

- **`src/memory/flush.ts`** — Pre-compaction flush:
  - Silent turn: "Save important facts to MEMORY.md"
  - Agent escreve via Write tool
  - Suprime resposta do delivery
  - Triggers re-indexing

### Modificar:
- **`src/conversations/index.ts`** — Adicionar persistence apos cada troca de mensagem

### Verificacao:
- Mensagens geram `messages.jsonl` crescente
- Memory flush append facts ao MEMORY.md
- Re-indexing pega o conteudo novo

---

## Grafo de Dependencias

```
Fase 0: Event Bus + SSE          ← fundacao
  |
Fase 1: Reestruturacao Contexto  ← estrutural
  |
Fase 2: Agent Entity + Channel   ← entidades core
  |
  |-- Fase 3: Skills             ← paralelo
  +-- Fase 4: Memory             ← paralelo
        |
      Fase 5: Heartbeat Multi-Agent
        |
      Fase 6: Tools, Adapters, Users
        |
      Fase 7: Persistence + Flush
```

Fases 3 e 4 podem ser desenvolvidas em paralelo apos Fase 2.

---

## Decisoes Tecnicas

| Decisao | Escolha | Razao |
|---------|---------|-------|
| Vector search | `sqlite-vec` (vec0) | Recomendado pelo autor, substitui sqlite-vss deprecated |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) | Mais acessivel e custo-efetivo; abstraction permite trocar depois |
| Event bus | Node.js EventEmitter nativo | Suficiente para processo unico; evita dependencia extra |
| LLM motor | Claude Agent SDK `query()` | Ja implementado; backbone e orquestrador, nao motor |
| Source of truth | Markdown files | SQLite e indice descartavel; deletar .sqlite e re-indexar |
| Working directory | `context/agents/{agentId}/` | Agent SDK resolve paths relativos corretamente |

## Ficheiros Criticos (mais modificados)

| Ficheiro | Fases |
|----------|-------|
| `src/context/index.ts` | 1, 3, 4, 6 |
| `src/heartbeat/index.ts` | 0, 1, 2, 5 |
| `src/routes/index.ts` | 0, 2, 7 |
| `src/conversations/index.ts` | 1, 2, 8 |

## Dependencias npm a Adicionar

| Package | Fase | Uso |
|---------|------|-----|
| `sqlite-vec` | 4 | vec0 virtual table para vector search |
| `openai` | 4 | Embedding provider (text-embedding-3-small) |
| `chokidar` | 4 | File watching para memory sync |
