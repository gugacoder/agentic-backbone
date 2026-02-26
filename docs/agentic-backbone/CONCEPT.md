# Agentic Backbone — Concept

Documento vivo que descreve o conceito do sistema como ele está sendo construído.

---

## O que é

O Agentic Backbone é um servidor **Node.js + Hono** que funciona como infraestrutura para um agente autônomo persistente. Construído com o **Claude Agent SDK**, expõe uma interface **REST + SSE**.

Qualquer sistema que adote o backbone ganha automaticamente um agente inteligente interno — o **System Heartbeat** — que opera continuamente executando tarefas sistêmicas.

---

## Entidades Fundamentais

### Agent = Heartbeat

Um agent e um heartbeat são inseparáveis. Não existe agent sem heartbeat. Não existe heartbeat sem agent.

O agent é a entidade que tem identidade, memória, skills, tools, adapters e conversas. O heartbeat é o ciclo autônomo que mantém o agent vivo — a cada tick, o agent acorda, lê suas instruções, e age.

Todo agent pertence a um **user** (system ou regular).

### User

Usuários são identificados no sistema. Podem ser:
- **system** — o próprio sistema, dono dos agents sistêmicos
- **users regulares** — pessoas que interagem com o backbone

Usuários possuem recursos (skills, tools, adapters) que são compartilhados entre todos os seus agents. Podem criar agents (se tiverem permissão) e registrar channels.

### Channel

Canal é um **tubo de comunicação**. Não tem recursos, não tem heartbeat, não tem memória. Apenas roteia mensagens entre users e agents.

Channels pertencem a users. O System Channel é o canal built-in do sistema.

---

## Conceito Central: System Heartbeat + System Channel

O núcleo do backbone é composto por duas partes inseparáveis:

```
Agentic Backbone = System Heartbeat + System Channel
                   (sempre ativo)     (sempre existe)
```

### System Heartbeat

O System Heartbeat (`agents/system.main`) é o backbone propriamente dito. A cada intervalo (default: 30s), ele acorda, lê suas instruções, consulta o LLM, e age. Ele:

- Executa ações em nome do sistema
- Avança no trabalho a ser feito
- É o primeiro a existir e funciona independentemente de qualquer usuário
- Pode criar outros agents do sistema conforme necessidade

### System Channel

O System Channel é o canal de comunicação do sistema. Tudo que o System Heartbeat faz, comunica, decide — trafega por este canal.

Funciona como WhatsApp multi-device: múltiplas interfaces (console, VS Code, web, app de monitoramento), mas um único canal. Uma mensagem enviada ou recebida aparece em todos os clients conectados.

```
System Channel (único)
    │
    ├── SSE stream ──▶ Console
    ├── SSE stream ──▶ VS Code
    ├── SSE stream ──▶ App de monitoramento
    └── SSE stream ──▶ Qualquer client futuro

    ◀── REST POST ── qualquer um desses clients
```

O System Channel permite:
- Acompanhar tudo que o sistema está fazendo em tempo real
- Enviar comandos ao sistema
- Logging automático de toda comunicação
- Observabilidade total do agente

---

## Comunicação via REST + SSE

Todos os channels seguem o mesmo contrato:

```
POST /channels/:channelId/messages    ← envia mensagem ao canal
GET  /channels/:channelId/events      ← SSE stream de eventos
```

Para o System Channel especificamente:
```
POST /system/messages                 ← envia mensagem ao sistema
GET  /system/events                   ← SSE stream do sistema
```

---

## Agents

### Naming Convention

Agents seguem a convenção `{owner}.{agent-slug}`:

```
agents/
  system.main/          ← System Heartbeat (sempre ativo)
  system.monitor/       ← agent de monitoramento do sistema
  joao.assistant/       ← agent do João
  joao.work/            ← outro agent do João
  maria.personal/       ← agent da Maria
```

O owner é identificável direto pelo nome do diretório.

### Delivery Target

Cada agent define para onde entrega suas mensagens (configurado no AGENT.md):
- `"last"` — último canal em que o user conversou
- `"{channel-slug}"` — canal específico
- `"system-channel"` — o System Channel (para agents do sistema)

### Múltiplos Agents do Sistema

O `system.main` é o principal, mas o sistema pode ter outros agents:

```
agents/
  system.main/          ← o core, sempre ativo
  system.monitor/       ← monitora saúde do sistema
  system.cleanup/       ← limpa dados antigos
```

Todos com `owner: system`. O `system.main` pode inclusive criar e gerenciar os outros.

### Agents de Usuário

Usuários com permissão podem criar agents. Cada agent tem seu próprio heartbeat e memória. Herda recursos do user.

---

## Contexto como Filesystem Markdown

O contexto é um repositório de arquivos Markdown. Os dados são legíveis por humanos, versionáveis com git, e portáveis.

**Markdown é source of truth. SQLite é índice descartável.**

**Nada importante vai em SQLite.** Estado real vive em arquivos planos: PIDs, sessões, memória, tasks.

### Estrutura de Diretórios

```
context/
  shared/                              ← recursos base (herdados por todos)
    skills/{slug}/SKILL.md
    tools/{slug}/TOOL.md
    connectors/{slug}/                 ← modelos reutilizáveis para adapters
      adapter.mjs                      ← factory Node.js do engine (core)
      ADAPTER.schema.yaml              ← schema dos parâmetros (core)
      exec.mjs                         ← executor CLI (opcional)
      query.sh                         ← interface shell read-only (opcional, SQL)
      mutate.sh                        ← interface shell write (opcional, SQL)
    adapters/{slug}/
      ADAPTER.yaml                     ← config puro (connector + params)

  system/                              ← recursos do sistema (não necessariamente compartilhados)
    SOUL.md                            ← identidade base do sistema
    skills/{slug}/SKILL.md
    tools/{slug}/TOOL.md
    connectors/{slug}/                 ← connectors do sistema
    adapters/{slug}/ADAPTER.yaml

  users/{user-slug}/
    USER.md                            ← quem é esse usuário
    skills/{slug}/SKILL.md             ← compartilhados entre agents do user
    tools/{slug}/TOOL.md
    connectors/{slug}/                 ← connectors do usuário
    adapters/{slug}/ADAPTER.yaml
    channels/{channel-slug}/
      CHANNEL.md                       ← tipo, config

  agents/{owner}.{agent-slug}/
    AGENT.md                           ← owner, delivery target, config
    SOUL.md                            ← identidade deste agent
    HEARTBEAT.md                       ← instruções do heartbeat
    MEMORY.md                          ← memória de longo prazo
    memory/{day}/MEMORY.md             ← logs diários
    cron/                              ← tarefas agendadas
      {slug}.md                        ← definição do job (frontmatter)
      .state.json                      ← estado runtime (reconstruível)
    skills/{slug}/SKILL.md             ← overrides
    tools/{slug}/TOOL.md
    adapters/{slug}/ADAPTER.yaml
    conversations/{session_id}/
      SESSION.md                       ← metadata (started_at, status)
      messages.jsonl                   ← transcript
```

### Precedência de Recursos

```
shared/ → system/ → agents/system.*       (para agents do sistema)
shared/ → users/{user}/ → agents/{user}.* (para agents de users)
```

Uma skill com o mesmo nome em nível mais específico sobrescreve a do nível mais genérico.

### Connectors

Connectors são **modelos reutilizáveis** que definem como conectar a um tipo específico de sistema externo. **Connector é o tipo, adapter é a instância.**

Um connector tem dois arquivos core:
1. **`adapter.mjs`** — engine de conexão (factory que cria instâncias a partir de config)
2. **`ADAPTER.schema.yaml`** — schema dos parâmetros que um adapter precisa preencher

Opcionalmente, o connector pode declarar outros arquivos — ferramentas shell, executors CLI, documentação:

```
connectors/{slug}/
  adapter.mjs            ← engine (core) — createAdapter(dir) → interface do connector
  ADAPTER.schema.yaml    ← schema dos parâmetros (core)
  exec.mjs               ← executor CLI (opcional)
  query.sh               ← interface shell read-only (opcional, ex: SQL connectors)
  mutate.sh              ← interface shell write (opcional, ex: SQL connectors)
  send.sh                ← interface shell envio (opcional, ex: messaging connectors)
```

A interface que o connector expõe depende do tipo. Um connector MySQL expõe `query`/`mutate`. Um connector Evolution (WhatsApp) expõe `send`. Não há vocabulário fixo — o connector define o que faz sentido.

Connectors seguem a cadeia de precedência: `shared/` (MySQL, PostgreSQL) → `system/` → `users/{user}/` (connectors customizados do usuário).

#### Schema simplificado (`ADAPTER.schema.yaml`)

O schema usa uma notação com `<type>` tags — **o schema é o template**. Valores fixos são constantes, valores variáveis são tipados:

```yaml
name: <string>
connector: mysql
policy: <string>
params:
  host: <string>
  port: <number>
  database: <string>
  user: <string>
  password: <secret>
```

| Notação | Tipo |
|---------|------|
| `<string>` | texto livre |
| `<number>` | inteiro |
| `<real>` | decimal |
| `<bool>` | true/false |
| `<secret>` | string mascarada no UI |
| `<array>` | lista |
| `valor` | constante (copiado direto) |
| Nesting | objeto (YAML nativo) |

O schema é usado pelo Hub para gerar formulários dinâmicos, pelo backbone para validar configurações, e por agentes para entender que parâmetros um connector requer.

---

## Heartbeat — Mecânica

Cada agent tem seu heartbeat. O ciclo envolve três camadas:

1. **AGENT.md** determina **quando acordar**: `heartbeat-interval`, `active-hours`, `enabled`. É o marca-passo — define ritmo e horário de funcionamento.
2. **Guard checks** decidem **se executa**: ao acordar, o sistema verifica condições (arquivo vazio? tick anterior ainda rodando? resposta duplicada?). Se algum guard falhar, o tick é descartado sem chamar o LLM.
3. **HEARTBEAT.md** é **o que o agente faz** quando o coração pulsa. As instruções concretas do que verificar e como agir.

### Guard Checks (antes de chamar o LLM)

| Guard | Condição de skip |
|---|---|
| `already-running` | Outro tick deste heartbeat ainda está executando |
| `empty-instructions` | HEARTBEAT.md efetivamente vazio (só headers/whitespace/checkboxes) |
| `duplicate` | Resposta idêntica à anterior dentro de 24h |
| `no-listeners` | Nenhum client SSE conectado ao canal de delivery (para agents de user) |

### Ciclo de Execução

```
Timer dispara
    │
    ▼
Guard checks ──(skip)──▶ log razão, agendar próximo
    │ (pass)
    ▼
Montar prompt (SOUL.md + HEARTBEAT.md + contexto)
    │
    ▼
Chamar Claude Agent SDK via query()
    │
    ▼
Normalizar resposta (strip HEARTBEAT_OK token, markup)
    │
    ▼
Deduplicar (comparar com última mensagem, janela 24h)
    │
    ▼
Entregar via canal de delivery do agent
```

### HEARTBEAT_OK Token

Se o agent não tem nada a fazer, responde `HEARTBEAT_OK`. O sistema:
1. Normaliza markup (`**HEARTBEAT_OK**`, `<b>HEARTBEAT_OK</b>`)
2. Remove o token das bordas
3. Se texto restante ≤ 300 chars → trata como ack silencioso
4. Se texto restante > 300 chars → entrega como conteúdo real

### Prompt Restritivo

```
Follow the heartbeat instructions strictly.
Do not infer or repeat old tasks from prior context.
If nothing needs attention, reply with exactly: HEARTBEAT_OK
```

Intencionalmente apertado para evitar que o LLM alucine tarefas do histórico.

---

## Skills, Tools, Connectors, Adapters

Cada recurso é um diretório com um arquivo principal que usa **YAML frontmatter** (metadata) + conteúdo (instruções pro LLM ou config).

### Skills

```yaml
---
name: minha-skill
description: O que ela faz
user-invocable: true
---
# Instruções completas para o LLM...
```

Skills são habilidades do agent. O LLM vê **nome + descrição** no system prompt e só lê o SKILL.md completo quando decide que é relevante (lazy reading — controle de custo).

### Tools

```yaml
---
name: sql-query
description: Consultar banco de dados SQL
---
# Como usar, regras, permissões...
```

Tools são instruções para executar ferramentas externas.

### Adapters

Adapters são **instâncias concretas** de um connector — encapsulam credenciais, política de acesso, e configuração de conexão a um recurso externo específico. Cada adapter é criado a partir de um connector.

```
adapters/{slug}/
  ADAPTER.yaml     ← config puro (connector + params preenchidos)
```

O adapter é só dados — por padrão é apenas o `ADAPTER.yaml`. Pode conter outros arquivos se necessário, mas o core é o YAML.

O `ADAPTER.yaml` declara de qual connector veio e quais parâmetros foram preenchidos:

```yaml
name: SampleDB
connector: mysql
policy: readwrite
description: Base de negócio — exemplo
params:
  host: 127.0.0.1
  port: 3306
  database: myapp
  user: root
  password: root
```

As interfaces de uso (query.sh, mutate.sh, send.sh) são providas pelo **connector**, não pelo adapter. O agent resolve o connector do adapter e usa as ferramentas do connector:

- **Agente via Bash:** `bash <connector_dir>/query.sh <adapter_dir> "SELECT ..."`
- **Agente lê ADAPTER.yaml** para entender restrições e schema disponível

#### Políticas de acesso

O campo `policy` controla as permissões. O significado exato depende do connector:

| Policy | Descrição |
|--------|-----------|
| `readonly` | Apenas operações de leitura |
| `readwrite` | Leitura + escrita |
| `full` | Leitura + escrita + operações estruturais |

---

## Hooks

Hooks são **funções de extensão** que executam em resposta a eventos do ciclo de vida do backbone. Permitem customizar comportamento sem modificar o core.

Seguem o mesmo padrão de filesystem dos outros recursos:

```
context/
  shared/hooks/{slug}/          ← hooks globais (menor precedência)
    HOOK.md                     ← metadata + documentação
    handler.mjs                 ← código executável
  system/hooks/{slug}/          ← hooks do sistema
  agents/{owner}.{slug}/hooks/  ← hooks específicos do agent (maior precedência)
```

### HOOK.md

```yaml
---
name: meu-hook
description: O que ele faz
enabled: true
events: "heartbeat:after, message:sent"
priority: 0
---
# Documentação do hook...
```

### Eventos Disponíveis

| Evento | Quando dispara |
|---|---|
| `startup` | Servidor pronto, após heartbeat e watchers iniciados |
| `heartbeat:before` | Antes de cada tick do heartbeat (guards já passaram) |
| `heartbeat:after` | Após cada tick completar |
| `agent:before` | Antes de executar o LLM (heartbeat ou conversa) |
| `agent:after` | Após resposta completa do LLM |
| `message:received` | Mensagem do usuário persistida |
| `message:sent` | Resposta do assistant persistida |
| `registry:changed` | Registry de agents ou channels atualizado |

### Execução

Hooks do mesmo evento executam **sequencialmente**, ordenados por **priority** (maior primeiro). Erros em um hook são logados mas não impedem os demais de executar.

Hooks são **fire-and-forget** — não modificam o fluxo principal. Servem para logging, métricas, notificações, side-effects.

---

## Sessões de Conversa

As sessões são **agênticas** — durante a conversa, o agent pode sob demanda levantar tarefas, usar skills, tools e adapters.

Conversas acontecem **COM agents, ATRAVÉS de channels**. Pertencem ao agent, não ao channel.

- Cada sessão tem um identificador único
- A sessão armazena memória conversacional
- O Claude Agent SDK gerencia continuidade via `resume: sessionId`
- O Claude Agent SDK gerencia compaction internamente (compressão de contexto ao se aproximar do limite de tokens)

### Session Lifecycle

- **Criação**: ao iniciar uma conversa com um agent
- **Continuação**: via `resume` do SDK (contexto preservado)
- **Memory flush**: antes de reset ou em sessões longas, turn silencioso para salvar fatos importantes em `MEMORY.md` do agent
- **Auto-reset**: idle timeout configurável + comando `/new` + reset diário opcional
- **Encerramento**: explícito ou por timeout

### Três modos de operação

| Modo | Quem age | Quando |
|---|---|---|
| **Heartbeat** | O agent age autonomamente | A cada tick (30s) |
| **Conversação** | O agent age sob demanda | Quando o usuário envia mensagem |
| **Agendado** | O agent age por schedule | Em horário programado (cron/at/every) |

---

## Cron — Tarefas Agendadas

Scheduler persistente de jobs por agent. Cada job é um arquivo `.md` com frontmatter dentro de `agents/{id}/cron/`.

### Três tipos de schedule

| Tipo | Uso | Exemplo |
|---|---|---|
| `at` | One-shot, horário absoluto | `schedule-kind: at`, `schedule-at: 2026-03-01T09:00:00` |
| `every` | Intervalo fixo | `schedule-kind: every`, `schedule-everyMs: 60000` |
| `cron` | Expressão cron 5-field | `schedule-kind: cron`, `schedule-expr: "0 7 * * *"` |

### Dois payloads

| Payload | O que faz |
|---|---|
| `heartbeat` | Dispara o heartbeat do agent |
| `agentTurn` | Roda o agent com um prompt específico |

### Estrutura no filesystem

```
agents/{owner}.{agent-slug}/
  cron/
    {slug}.md                    ← definição do job (frontmatter)
    .state.json                  ← estado runtime (reconstruível)
```

### Comportamento

- **Error backoff**: 30s → 1m → 5m → 15m → 60m
- **One-shot** (`at`): auto-desabilita após execução (controlável por `deleteAfterRun`)
- **Stuck detection**: jobs rodando há mais de 2h são marcados como error e liberados
- **`.state.json` é reconstruível** — se deletado, o scheduler recalcula os schedules a partir dos `.md`

---

## Jobs — Processos Supervisionados

O agent é efêmero — acorda no heartbeat, age, dorme. Quando precisa rodar um processo longo (ex: `classificar.mjs`), não pode ficar bloqueado esperando. Delega ao backbone a supervisão desse processo.

O backbone funciona como **supervisor de processos**: spawna child processes, captura output, aplica timeout, e **acorda o agent** quando o job termina.

### Fluxo

O agent roda **dentro** do backbone. Acessa o motor de jobs via **MCP tools nativas** do Claude Agent SDK — sem HTTP round-trip.

```
Agente (heartbeat)
  → submit_job(command: "node classificar.mjs", timeout: 300)
    → Backbone spawna child process
    → Retorna { id, pid, status: "running" }
      → Agente responde HEARTBEAT_OK, dorme

Backbone supervisiona:
  - Captura stdout/stderr em memória (cap 200k chars)
  - Aplica timeout (SIGKILL se exceder)
  - Propaga sinais de shutdown
  - Quando processo termina:
    → Emite evento job:status
    → Chama triggerManualHeartbeat(agentId)
    → Agente acorda, usa get_job(jobId) para consultar resultado
```

### Características

- **In-memory** — sem persistência em disco. Jobs são voláteis, coerente com o padrão OpenClaw
- **Output buffering** — stdout/stderr capturados até 200k chars. `tail` sempre contém os últimos 2k chars
- **Timeout** — default 30min. Se exceder, SIGKILL + status `"timeout"`
- **Wake-on-complete** — ao finalizar, dispara `triggerManualHeartbeat()` para acordar o agent
- **Sweeper** — finished jobs são limpos da memória após 30min TTL
- **Graceful shutdown** — SIGTERM/SIGINT mata todos os running jobs

### MCP Tools (acesso interno)

O agent acessa jobs via MCP tools nativas, injetadas pelo backbone no Claude Agent SDK:

| Tool | Descrição |
|------|-----------|
| `submit_job` | Submete processo (command, timeout) |
| `list_jobs` | Lista jobs do agent atual |
| `get_job` | Detalhe de um job (output, status, exit code) |
| `kill_job` | Mata job em execução |

O `AGENT_ID` é injetado automaticamente — o agent não precisa se identificar.

### REST API (acesso externo)

Para clients externos (Hub UI, curl, monitoramento):

```
POST   /jobs           → submeter job (agentId, command, timeout)
GET    /jobs           → listar jobs (?agentId para filtrar)
GET    /jobs/:id       → detalhe de um job
POST   /jobs/:id/kill  → matar job em execução
DELETE /jobs/:id       → limpar finished job da memória
```

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js, TypeScript |
| HTTP | Hono + @hono/node-server |
| AI/LLM | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) |
| Database | SQLite (better-sqlite3) — índice apenas, não source of truth |
| Transporte | REST + SSE |
| Dados | Markdown filesystem (source of truth) |
| Cron | croner (cron expressions com timezone) |
| Container | Docker (opcional) |

---

## Princípios

1. **Markdown é source of truth** — SQLite é índice descartável, reconstruível
2. **Nada importante em SQLite** — sessões e memória vivem em arquivos planos
3. **Agent = Heartbeat** — inseparáveis, todo agent tem heartbeat, todo heartbeat é um agent
4. **System Heartbeat é o core** — o sistema opera inteiro sem usuários
5. **Channel é tubo** — não tem recursos, só roteia mensagens
6. **Lazy reading** — listar nomes/descrições, carregar conteúdo sob demanda
7. **Cost awareness** — guard checks, deduplicação, ackMaxChars — evitar LLM calls desnecessárias
8. **Claude Agent SDK como motor** — o backbone é um orquestrador, não um engine de tools
9. **Hooks são side-effects** — observam o ciclo de vida, não modificam o fluxo principal

---

## Embeddings

Providers de embedding para o memory system:

| Provider | Modelo Default | Lib/API |
|----------|---------------|---------|
| **OpenAI** | `text-embedding-3-small` | OpenAI API |
| **Gemini** | `gemini-embedding-001` | Gemini API |
| **Voyage** | `voyage-4-large` | Voyage API |
| **Local** | `embeddinggemma-300M` (GGUF) | `node-llama-cpp` |

Config: `provider: "openai" | "local" | "gemini" | "voyage" | "auto"`

Fallback chains suportadas (ex: local -> OpenAI).
