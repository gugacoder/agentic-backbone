# Guia de Contexto — Arquivos de Metadados

> **A verdade vive em `context/.skeleton.md` e `apps/backbone/src/context/schemas.ts`.**
> Este guia consolida os tipos de arquivo, seus caminhos, schemas e como o sistema os lê.

---

## Estrutura de diretórios

```
context/
├── settings.yml                              # metadata (config global)
├── plans/{slug}.yml                          # metadata (planos de LLM)
│
├── shared/
│   ├── skills/{slug}/SKILL.md               # prompt+metadata
│   ├── adapters/{slug}/ADAPTER.yml          # metadata (encriptado)
│   └── services/{slug}/SERVICE.md           # prompt+metadata
│
├── users/{slug}/
│   ├── USER.md                               # prompt+metadata
│   ├── credential.yml                        # metadata (encriptado)
│   ├── channels/{slug}/CHANNEL.yml          # metadata
│   ├── skills/{slug}/SKILL.md               # prompt+metadata (user-scoped)
│   ├── hooks/{slug}/HOOK.md                 # prompt+metadata (user-scoped)
│   └── adapters/{slug}/ADAPTER.yml          # metadata (encriptado, user-scoped)
│
└── agents/{owner.slug}/
    ├── AGENT.yml                             # metadata
    ├── SOUL.md                               # prompt
    ├── HEARTBEAT.md                          # prompt
    ├── CONVERSATION.md                       # prompt
    ├── REQUEST.md                            # prompt
    ├── MEMORY.md                             # prompt
    ├── cron/{slug}.yml                       # metadata
    ├── skills/{slug}/SKILL.md               # prompt+metadata (agent-scoped)
    ├── adapters/{slug}/ADAPTER.yml          # metadata (encriptado)
    ├── services/{slug}/SERVICE.md           # prompt+metadata
    ├── journal/{day}/MEMORY.md             # prompt
    └── conversations/{uuid}/
        ├── SESSION.yml                       # metadata
        └── messages.jsonl                    # dados
```

---

## Tipos de arquivo

O sistema usa três tipos de arquivo distintos:

| Tipo | Extensão | Leitura | Uso |
|------|----------|---------|-----|
| **YAML puro** | `.yml` | `readYaml()` / `readYamlAs()` | Configuração estruturada, sem narrativa |
| **Markdown híbrido** | `.md` | `readMarkdown()` / `parseFrontmatter()` | Frontmatter YAML + corpo de prompt |
| **Markdown puro** | `.md` | `readContextFile()` | Só conteúdo narrativo, sem frontmatter |

---

## Arquivos YAML puros

Configuração estruturada. Campos sensíveis (`key`, `secret`, `token`, `password`, `pass`) são auto-encriptados em AES-256-GCM na forma `ENC(base64...)` e decriptados transparentemente por `readYaml()`.

### `AGENT.yml`
**Caminho:** `context/agents/{owner.slug}/AGENT.yml`
**Schema:** `AgentYmlSchema`

```yaml
id: guga.multicanal          # opcional, inferido do nome da pasta
owner: guga                  # opcional, inferido
slug: multicanal             # opcional, inferido
delivery: ""                 # canal de entrega padrão
enabled: false               # habilita o agente
heartbeat-enabled: false     # habilita o heartbeat autônomo
heartbeat-interval: 30000    # intervalo em ms
description: ""
# campos extras são preservados (passthrough)
```

### `CHANNEL.yml`
**Caminho:** `context/users/{owner}/channels/{slug}/CHANNEL.yml`
**Schema:** `ChannelYmlSchema`

```yaml
slug: meu-canal              # opcional, inferido
owner: guga                  # opcional, inferido
type: generic                # tipo do canal
description: ""
# campos extras são preservados (passthrough)
```

### `ADAPTER.yml`
**Caminho:** `context/{shared,users/{u},agents/{id}}/adapters/{slug}/ADAPTER.yml`
**Schema:** `AdapterYmlSchema`

```yaml
connector: mysql             # obrigatório — slug do conector
name: ""                     # opcional
description: ""              # opcional
policy: readonly             # readonly | readwrite
credential:                  # opcional — campos auto-encriptados
  host: localhost
  password: ENC(...)
params: {}                   # opcional
options: {}                  # opcional
# campos extras são preservados (passthrough)
```

### `credential.yml`
**Caminho:** `context/users/{slug}/credential.yml`
**Schema:** `CredentialYmlSchema`

```yaml
type: user-password
email: usuario@mail.com
password: ENC(...)           # auto-encriptado
```

### `SESSION.yml`
**Caminho:** `context/agents/{id}/conversations/{uuid}/SESSION.yml`
**Schema:** `SessionYmlSchema`

```yaml
session-id: uuid
user-id: guga
agent-id: guga.multicanal
created-at: "2025-01-01T00:00:00Z"
message-count: 0
```

### `cron/{slug}.yml`
**Caminho:** `context/agents/{id}/cron/{slug}.yml`
**Schema:** `CronYmlSchema`

```yaml
name: ""                     # opcional
enabled: true
schedule-kind: cron          # at | every | cron
schedule-expr: "0 9 * * 1-5" # para kind=cron
# schedule-at: "2025-06-01T09:00:00Z"   # para kind=at
# schedule-everyMs: 3600000              # para kind=every
# schedule-anchorMs: 0
schedule-tz: America/Sao_Paulo
payload-kind: heartbeat      # heartbeat | conversation | request
payload-message: ""          # para kind=conversation ou request
deleteAfterRun: false
description: ""
```

### `settings.yml`
**Caminho:** `context/settings.yml`
**Leitura:** `readYaml()` via `settingsPath()`
Estrutura livre — lido pelo módulo `apps/backbone/src/settings/`.

---

## Arquivos Markdown híbridos (frontmatter + prompt)

O frontmatter YAML entre `---` é parseado por `parseFrontmatter()`. O corpo abaixo é o prompt enviado ao LLM.

### `USER.md`
**Caminho:** `context/users/{slug}/USER.md`
**Schema do frontmatter:** `UserMdSchema`

```md
---
slug: guga
displayName: Guga
email: guga@mail.com
canCreateAgents: true
canCreateChannels: true
maxAgents: 5
---

Perfil narrativo do usuário para contexto dos agentes.
```

### `SKILL.md`
**Caminho:** `context/{shared,users/{u},agents/{id}}/skills/{slug}/SKILL.md`
**Schema do frontmatter:** `SkillMdSchema`
**Precedência:** shared → user → agent (último vence)

```md
---
name: Nome da Skill
description: O que esta skill faz
enabled: true
user-invocable: false        # aparece como /nome no chat
trigger: ""                  # condição de ativação automática
# campos extras são preservados (passthrough)
---

Instruções da skill enviadas como contexto ao agente.
```

### `SERVICE.md`
**Caminho:** `context/{shared,users/{u},agents/{id}}/services/{slug}/SERVICE.md`
**Schema do frontmatter:** `ServiceMdSchema`
**Precedência:** shared → user → agent (último vence)

```md
---
name: Nome do Serviço
description: O que este serviço faz
enabled: true
skip-agent: false            # true = executa direto, sem LLM
# campos extras são preservados (passthrough)
---

Instruções do serviço.
```

---

## Arquivos Markdown puros (só prompt)

Lidos por `readContextFile()`. Não têm frontmatter — são integralmente passados como contexto ao LLM.

| Arquivo | Modo de uso |
|---------|-------------|
| `SOUL.md` | Identidade permanente do agente (todos os modos) |
| `HEARTBEAT.md` | Instruções específicas do modo heartbeat |
| `CONVERSATION.md` | Instruções específicas do modo conversação |
| `REQUEST.md` | Instruções específicas do modo request |
| `MEMORY.md` | Memórias extraídas automaticamente a cada 20 mensagens |
| `journal/{day}/MEMORY.md` | Memórias diárias de journaling |

---

## Schemas Zod — referência

Todos em `apps/backbone/src/context/schemas.ts`.

| Arquivo | Schema | Tipo TypeScript | passthrough |
|---------|--------|-----------------|-------------|
| `AGENT.yml` | `AgentYmlSchema` | `AgentYml` | sim |
| `USER.md` frontmatter | `UserMdSchema` | `UserMd` | não |
| `credential.yml` | `CredentialYmlSchema` | `CredentialYml` | não |
| `CHANNEL.yml` | `ChannelYmlSchema` | `ChannelYml` | sim |
| `SESSION.yml` | `SessionYmlSchema` | `SessionYml` | não |
| `cron/{slug}.yml` | `CronYmlSchema` | `CronYml` | não |
| `SKILL.md` frontmatter | `SkillMdSchema` | `SkillMd` | sim |
| `SERVICE.md` frontmatter | `ServiceMdSchema` | `ServiceMd` | sim |
| `ADAPTER.yml` | `AdapterYmlSchema` | `AdapterYml` | sim |

**Estratégia de parsing:**
- `Schema.parse()` — nos managers (leitura dirigida, falha ruidosa)
- `Schema.safeParse()` — nos scans de diretório (skip do arquivo inválido + `console.warn`)

---

## Encriptação automática

Campos em `.yml` cujo nome case-insensitivo contém `key`, `secret`, `token`, `password` ou `pass` são encriptados automaticamente:
- **Na inicialização** — `apps/backbone/src/watchers/` escaneia todos os `.yml` e encripta campos em texto plano
- **Em mudança de arquivo** — watcher chokidar re-encripta após salvar
- **Na leitura** — `readYaml()` decripta transparentemente antes de retornar

Algoritmo: AES-256-GCM. Chave derivada de `JWT_SECRET` via scrypt. Valores encriptados têm formato `ENC(base64...)`.

---

## Precedência de recursos (skills, services, adapters)

```
shared/ → users/{owner}/ → agents/{owner.slug}/
```

O último que define um slug vence. Isso permite que recursos globais sejam sobrescritos por configurações de usuário ou de agente específico.

## Aprovação de tools

A configuração de aprovação de tools fica no `AGENT.yml` do agente, no campo `tool-approvals`:

```yaml
tool-approvals:
  whatsapp_send_text:
    label: "Enviar mensagem WhatsApp"
    timeout: 300
  make_call:
    label: "Fazer ligação"
    timeout: 120
```

- `label` — texto exibido ao operador no pedido de aprovação (default: nome da tool)
- `timeout` — segundos até expirar automaticamente (default: 300)
