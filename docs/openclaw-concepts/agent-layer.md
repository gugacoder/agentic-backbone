# OpenClaw Agent Layer — How It Works Without the Claude Agent SDK

## Overview

OpenClaw **does not use** the `@anthropic-ai/claude-agent-sdk`. Instead, it builds on the **Pi agent ecosystem** — a set of libraries by Mario Zechner (`@mariozechner/pi-*`) that provide a provider-agnostic agent runtime with built-in coding tools, streaming, and session management.

This is the most important architectural difference from our backbone: OpenClaw's agent layer is **not locked to a single LLM provider**.

---

## Library Stack

| Package | Purpose |
|---|---|
| `@mariozechner/pi-ai` | Low-level LLM abstraction. `streamSimple()` for streaming API calls across providers. |
| `@mariozechner/pi-agent-core` | Agent primitives: session, message history, tool execution engine. |
| `@mariozechner/pi-coding-agent` | Higher-level coding agent: `createAgentSession()`, built-in coding tools (Read, Write, Edit, Exec, Glob), `ModelRegistry`, `AuthStorage`. |

These are **not mainstream SDKs** — they are maintained by a single developer (Mario Zechner, the OpenClaw author). They are custom-built for the OpenClaw use case.

---

## Built-in Coding Tools

OpenClaw ships with tools equivalent to the ones the Claude Agent SDK provides:

| OpenClaw Tool | Claude Agent SDK Equivalent | Source |
|---|---|---|
| `Read` | `Read` | `createReadTool()` from `pi-coding-agent` |
| `Write` | `Write` | `createWriteTool()` from `pi-coding-agent` |
| `Edit` | `Edit` | `createEditTool()` from `pi-coding-agent` |
| `Exec` | `Bash` | `createExecTool()` — shell execution with security config |
| `Glob` | `Glob` | `codingTools` from `pi-coding-agent` |
| `ApplyPatch` | *(none)* | `createApplyPatchTool()` — unified diffs |

These are created via `createOpenClawCodingTools()` in `src/agents/pi-tools.ts`.

**Key difference:** OpenClaw wraps each tool with sandboxing, policy filtering, and provider-specific normalization. Tools aren't a flat allowlist — they go through layered security policies (global → provider → agent → group → subagent).

---

## Custom Tools (Beyond Coding)

OpenClaw adds domain-specific tools via `createOpenClawTools()` in `src/agents/openclaw-tools.ts`:

| Tool | Purpose |
|---|---|
| `Browser` | Playwright-based browser automation (sandboxed) |
| `Canvas` | Canvas/drawing operations |
| `Image` | Image generation/processing |
| `WebSearch` | Web search |
| `WebFetch` | Web content fetching |
| `Message` | Send messages to external channels (Slack, Telegram, etc.) |
| `Sessions` | Spawn sub-agents, manage agent sessions |
| `Cron` | Schedule recurring tasks |
| `TTS` | Text-to-speech (OpenAI TTS, ElevenLabs, Edge TTS) |
| `Gateway` | Gateway-specific routing operations |

Tools are conditionally created based on feature flags, provider capabilities (e.g., vision), and security policies.

---

## Multi-Provider Support

### Model Registry & Auth

```
agent/
  models.json    ← available models (provider, model ID, context window, capabilities)
  auth.json      ← API keys per provider (supports multiple profiles per provider)
```

Managed by `ModelRegistry` and `AuthStorage` from `pi-coding-agent`, wrapped in `src/agents/pi-model-discovery.ts`:

```typescript
export function discoverModels(authStorage: AuthStorage, agentDir: string): ModelRegistry {
  return new ModelRegistry(authStorage, path.join(agentDir, "models.json"));
}
```

### Supported Providers

| Provider | API Type | Notes |
|---|---|---|
| Anthropic (Claude) | `anthropic` | Prompt caching, vision, extended thinking |
| OpenAI (GPT) | `openai` | Function calling format |
| Google (Gemini) | `google` | Special tool schema cleaning, turn ordering fixes |
| AWS Bedrock | `aws-bedrock` | Claude via AWS |
| Ollama | `ollama` | Local models |
| GitHub Copilot | `github-copilot` | |
| Z.ai (GLM) | `zai` | |
| CLI backends | `cli` | Claude CLI, Codex CLI, custom CLIs as subprocess |

### Provider-Specific Quirks

Each provider has its own module for handling differences:

- **Google** (`pi-embedded-runner/google.ts`) — tool schema sanitization, turn ordering fixes
- **Anthropic** — refusal token scrubbing, prompt caching support
- **OpenAI** — tool naming quirks, function calling format differences
- **CLI** — subprocess invocation instead of HTTP API calls

---

## The Tool Loop

### How It Works

```
1. runEmbeddedPiAgent()                    ← entry point (run.ts)
   │
   2. runEmbeddedAttempt()                 ← single attempt (attempt.ts)
      │
      ├── createOpenClawCodingTools()      ← build tool set
      ├── createAgentSession()             ← init pi-coding-agent session
      ├── subscribeEmbeddedPiSession()     ← attach streaming handlers
      │
      └── activeSession.prompt(text)       ← starts the tool loop
           │
           ├── LLM generates text_delta    → onPartialReply() callback
           ├── LLM requests tool_use       → tool executes locally
           ├── tool_result returned         → onToolResult() callback
           ├── LLM continues reasoning...  → loop continues
           └── message_end                 → loop ends
```

The critical call is `activeSession.prompt(effectivePrompt)` — this is the async operation that drives the entire tool loop inside the Pi SDK. The SDK:

1. Sends the prompt + conversation history to the LLM
2. Streams the response
3. When the LLM requests a tool call, executes it locally
4. Feeds the tool result back to the LLM
5. Repeats until the LLM produces a final text response

### Streaming via Subscriptions

Before calling `prompt()`, OpenClaw sets up event subscriptions:

```typescript
const subscription = subscribeEmbeddedPiSession({
  session: activeSession,
  onPartialReply: (text) => { /* streaming text chunk to client */ },
  onToolResult: (toolName, result) => { /* tool execution notification */ },
  onBlockReply: (block) => { /* complete block (paragraph/code) */ },
  onReasoningStream: (reasoning) => { /* extended thinking stream */ },
});
```

Events handled:
- `text_delta` — streaming text chunks (accumulated into final response)
- `message_start` / `message_end` — message boundaries
- `content_block_start` / `content_block_end` — tool use block demarcation
- `input_json_delta` — streaming tool parameters
- `tool_result` — tool execution output

---

## Session Management

### Persistence

- **Session file** — `agent/sessions/<sessionId>/session.json` (metadata)
- **Transcript** — `agent/sessions/<sessionId>/transcript.jsonl` (message history)
- **Session Manager** — `SessionManager` from `pi-coding-agent` handles add/read/branch/compact

### Compaction

When context overflows, the session auto-compacts:

1. Older messages are summarized by the LLM
2. Summary replaces the original messages
3. Up to 3 compaction attempts before failing
4. Tool results can be truncated independently

### Branching

Sessions support branching — creating alternative conversation paths from any point. Useful for exploratory agent behavior.

---

## Error Handling & Failover

### Auth Profile Rotation

OpenClaw maintains multiple auth profiles per provider. On auth failure:

1. Check cooldown period on current profile
2. Advance to next available profile
3. Retry with new credentials
4. If all profiles exhausted → throw `FailoverError`

### Error Classification

| Error Type | Recovery |
|---|---|
| Context overflow | Auto-compact or truncate tool results |
| Auth failure | Rotate to next auth profile |
| Rate limit | Cooldown + backoff retry |
| Thinking unsupported | Fallback to simpler thinking level |
| Prompt format error | Fix role ordering, image sizing |
| Timeout | Abort and return partial results |

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│ OpenClaw Agent Runner                                         │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐  │
│  │ Model Discovery     │    │ Tool Creation                │  │
│  │ ├─ ModelRegistry    │    │ ├─ Coding: Read,Write,Edit,  │  │
│  │ ├─ AuthStorage      │    │ │  Exec,Glob,ApplyPatch      │  │
│  │ └─ Profile rotation │    │ ├─ Custom: Browser,Message,  │  │
│  └──────────┬──────────┘    │ │  WebSearch,Cron,TTS...     │  │
│             │               │ ├─ Plugin tools              │  │
│             │               │ └─ Policy filtering          │  │
│             │               └──────────────┬───────────────┘  │
│             │                              │                  │
│  ┌──────────▼──────────────────────────────▼───────────────┐  │
│  │ createAgentSession(model, tools, systemPrompt)          │  │
│  │                                                         │  │
│  │  session.prompt(userMessage)                            │  │
│  │    ├─ LLM call (streaming)                              │  │
│  │    ├─ Tool execution (local)                            │  │
│  │    ├─ Tool result → LLM (loop)                          │  │
│  │    └─ Final response                                    │  │
│  └──────────┬──────────────────────────────────────────────┘  │
│             │                                                 │
│  ┌──────────▼──────────────────────────────────────────────┐  │
│  │ Event Subscriptions                                     │  │
│  │  onPartialReply() → stream to client                    │  │
│  │  onToolResult()   → notify tool execution               │  │
│  │  onBlockReply()   → stream complete blocks              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                          │
                @mariozechner/pi-* libraries
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     Anthropic         OpenAI          Google
      (Claude)          (GPT)         (Gemini)
```

---

## Lessons for Agentic Backbone

### What OpenClaw proves

1. **You don't need the Claude Agent SDK** to build a full-featured agent with Read/Write/Bash/Glob/Grep/Edit tools. These can be implemented as custom tool handlers (~200-300 lines each).

2. **Multi-provider is achievable** — the same tool set works across Anthropic, OpenAI, Google, and others. Provider quirks are handled in isolated adapter modules.

3. **The tool loop is not magic** — it's a straightforward cycle: send prompt → stream response → if tool_use, execute tool → feed result back → repeat.

4. **Session persistence is independent of the LLM** — JSONL transcripts and session metadata don't depend on any provider-specific format.

### What we would need to build

To replicate OpenClaw's approach without `pi-*` dependencies (which are single-developer libraries), we could:

1. **Use the Vercel AI SDK** (`ai` package) as the provider abstraction layer — it's the most mature multi-provider TypeScript SDK
2. **Implement 6 tool handlers** (Read, Write, Edit, Bash, Glob, Grep) as Vercel AI SDK tool definitions
3. **Use `streamText()` with `maxSteps`** for the tool loop — the Vercel AI SDK handles the tool call → result → continue cycle automatically
4. **Keep our existing session persistence** (SQLite + JSONL) unchanged
5. **Route by cost** — heartbeat/classification on GPT-4o-mini or Gemini Flash, complex reasoning on Claude Sonnet/Opus

### What OpenClaw does that we probably don't need

- Auth profile rotation with multiple keys per provider (we have one key per provider)
- CLI-based LLM backends (subprocess invocation)
- Sandbox isolation per tool (we trust our agent runtime)
- Plugin-based tool registration (our tools are defined in markdown)
- Session branching (we use linear conversations)
