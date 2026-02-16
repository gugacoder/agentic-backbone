# What is OpenClaw?

OpenClaw is a **self-hosted, multi-channel AI gateway** that bridges your favorite messaging apps to an always-available personal AI assistant. You run a single Gateway process on your own machine (or server), and it becomes the bridge between messaging platforms and AI agents — keeping your data private and under your control.

## The Problem OpenClaw Solves

Using AI assistants today means switching between isolated apps and interfaces. You talk to ChatGPT in a browser, Copilot in your IDE, and have no unified way to reach an AI from WhatsApp, Telegram, Discord, or Slack. Each has its own context, memory, and limitations.

OpenClaw eliminates this fragmentation. One AI agent responds on **any** messaging platform simultaneously — WhatsApp, Telegram, Slack, Discord, iMessage, Google Chat, Signal, and more — with shared memory, consistent personality, and full data sovereignty.

## Core Architecture

```
Chat apps (WhatsApp / Telegram / Slack / Discord / Signal / iMessage / ...)
    │
    ▼
┌──────────────────────────────────┐
│     Gateway  (Control Plane)     │
│     ws://127.0.0.1:18789         │
│                                  │
│  ┌───────────┐  ┌─────────────┐  │
│  │  Channels  │  │   Router    │  │
│  │  Registry  │  │  Dispatcher │  │
│  └─────┬─────┘  └──────┬──────┘  │
│        │               │         │
│  ┌─────▼───────────────▼──────┐  │
│  │     Session Manager        │  │
│  └────────────┬───────────────┘  │
│               │                  │
│  ┌────────────▼───────────────┐  │
│  │   Agent Runtime (RPC)      │  │
│  │   Pi embedded process      │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
    │
    ▼
 Clients: CLI, Web UI, macOS app, iOS/Android nodes
```

### Gateway (Control Plane)

The Gateway is the single always-on process at the heart of OpenClaw. It:

- Maintains all channel connections (WhatsApp, Telegram, etc.)
- Exposes a WebSocket API for clients (CLI, web UI, mobile apps)
- Routes inbound messages to the correct agent via bindings
- Manages sessions, presence, typing indicators, and health
- Streams agent responses back to the originating channel

### Channels

Channels are messaging platform integrations. OpenClaw supports them in two tiers:

**Built-in channels:** WhatsApp (via Baileys), Telegram (via grammY), Slack (via Bolt), Discord (via discord.js), Google Chat, Signal, iMessage, and WebChat.

**Plugin-based channels:** Mattermost, Matrix, Zalo, Feishu, IRC, Line, BlueBubbles, Nextcloud Talk, Microsoft Teams, Twitch, and more.

Each channel connector translates platform-specific events into a common message format that the Gateway understands.

### Agent Runtime

Agents run as isolated RPC subprocesses based on the Pi agent runtime. Each agent gets:

- Its own **workspace** with configuration files (AGENTS.md, SOUL.md, USER.md, IDENTITY.md)
- **Tool access** — file execution, browser control (Playwright), image processing, code execution
- **Session-aware context** — conversation history, compaction, and memory flush
- **LLM flexibility** — Anthropic Claude, OpenAI, AWS Bedrock, Ollama, or any compatible provider

### Session Model

OpenClaw isolates conversations to prevent context leakage:

- **`main` session** — default continuity across DMs with a single user
- **Per-peer isolation** — separate context per contact (`per-channel-peer`, `per-account-channel-peer`)
- **Group/thread isolation** — unique session keys per group conversation
- **Secure DM mode** — strict isolation when multiple users share one Gateway

Sessions auto-reset daily (4 AM), on idle timeout, or via explicit `/new` command. Long sessions auto-compact by summarizing older context when approaching token limits.

### Multi-Agent Routing

A single Gateway can host **multiple isolated agents**, each with its own personality, workspace, memory, and tool permissions. Bindings match inbound messages to agents by channel, peer, or group — so you could have a "work assistant" on Slack and a "personal assistant" on WhatsApp, both running from the same Gateway.

## Message Flow

```
1. User sends a message on WhatsApp/Telegram/Discord/etc.
       ↓
2. Channel connector receives the platform event
       ↓
3. Gateway routes to the target agent via bindings
       ↓
4. Agent RPC process receives the message with session context
       ↓
5. Agent executes tool calls (code, browser, file I/O) as needed
       ↓
6. Agent generates a response, streamed in chunks
       ↓
7. Gateway delivers the response back through the channel connector
```

## Memory and Persistence

Agents maintain long-term memory through workspace files:

- **MEMORY.md** — long-term facts and preferences
- **memory/YYYY-MM-DD.md** — daily interaction logs
- **Session transcripts** — stored as JSONL files
- **Vector search** — SQLite-vec and LanceDB for semantic memory retrieval

Before session compaction, a silent "memory flush" turn lets the agent persist important context to disk.

## Plugin System

OpenClaw is extensible via a plugin architecture:

- **Discovery**: workspace extensions, global extensions, and bundled extensions are loaded in order
- **Manifest**: each plugin declares its ID, skills, permissions, and config schema in `openclaw.plugin.json`
- **Runtime API**: plugins receive an `api` object with access to the gateway, config, runtime, and logger
- **Skills**: plugins can contribute skill directories, discoverable via the ClawHub registry

## Security Model

- **DM policies**: pairing (approval required), open (allowlist-based), or closed
- **Auth tokens**: optional gateway token for remote access
- **Secure DM mode**: `dmScope` isolation prevents cross-user context leakage
- **Sandbox mode**: restricted workspace access for multi-agent setups

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Runtime | Node.js (>=22.12.0), TypeScript |
| AI/LLM | Anthropic SDK, OpenAI API, AWS Bedrock, Ollama |
| Agent core | Pi agent runtime (`@mariozechner/pi-*`) |
| Messaging | Baileys (WhatsApp), grammY (Telegram), Bolt (Slack), discord.js |
| Transport | WebSocket (ws), Express (HTTP) |
| Storage | SQLite (sqlite-vec), LanceDB, JSONL transcripts |
| Media | Sharp (images), Playwright (browser), PDFJS |
| TTS | OpenAI TTS, ElevenLabs, Edge TTS |
| Apps | Swift (macOS/iOS), Kotlin (Android), Lit (Web UI) |

## Configuration

OpenClaw uses a single configuration file at `~/.openclaw/openclaw.json` with:

- **Hot reload**: safe changes apply live; breaking changes trigger a restart
- **Environment overrides**: `OPENCLAW_*` variables
- **Profiles**: `OPENCLAW_PROFILE=work` loads `~/.openclaw/openclaw-work.json`
- **Schema validation**: TypeBox-based JSON Schema validation

## Deployment Options

- **Local**: run directly on your machine via CLI (`openclaw gateway`)
- **Docker**: containerized deployment
- **Remote access**: Tailscale VPN integration
- **Service management**: launchd (macOS) or systemd (Linux) supervision
