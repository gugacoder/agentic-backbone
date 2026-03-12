# Context Skeleton

```
context/
├── settings.yml                       # metadata (global config)
├── plans/{slug}.yml                   # metadata (LLM plan definitions)
│
├── shared/
│   ├── skills/{slug}/SKILL.md           # prompt+metadata
│   ├── adapters/{slug}/ADAPTER.yml      # metadata (encrypted)
│   └── services/{slug}/SERVICE.md       # prompt+metadata
│
├── users/{slug}/
│   ├── USER.md                          # prompt+metadata (sem password)
│   ├── credential.yml                   # metadata (encrypted)
│   ├── channels/{slug}/
│   │   └── CHANNEL.yml                  # metadata
│   ├── skills/{slug}/SKILL.md           # prompt+metadata (user-scoped)
│   ├── hooks/{slug}/HOOK.md             # prompt+metadata (user-scoped)
│   └── adapters/{slug}/ADAPTER.yml      # metadata (encrypted, user-scoped)
│
├── agents/{owner.slug}/
│   ├── AGENT.yml                        # metadata
│   ├── SOUL.md                          # prompt
│   ├── HEARTBEAT.md                     # prompt
│   ├── CONVERSATION.md                  # prompt
│   ├── REQUEST.md                       # prompt
│   ├── MEMORY.md                        # prompt
│   ├── cron/{slug}.yml                  # metadata
│   ├── skills/{slug}/SKILL.md           # prompt+metadata
│   ├── adapters/{slug}/ADAPTER.yml      # metadata (encrypted)
│   ├── services/{slug}/SERVICE.md       # prompt+metadata
│   ├── journal/{day}/MEMORY.md          # prompt
│   ├── workspace/                       # diretório de trabalho do agente (rascunhos, clones, projetos)
│   └── conversations/{uuid}/
│       ├── SESSION.yml                  # metadata
│       └── messages.jsonl               # data
```

## Schemas

Zod schemas centralizados em `apps/backbone/src/context/schemas.ts`.

| Arquivo | Schema | Tipo TypeScript |
|---------|--------|-----------------|
| `AGENT.yml` | `AgentYmlSchema` | `AgentYml` |
| `USER.md` frontmatter | `UserMdSchema` | `UserMd` |
| `credential.yml` | `CredentialYmlSchema` | `CredentialYml` |
| `CHANNEL.yml` | `ChannelYmlSchema` | `ChannelYml` |
| `SESSION.yml` | `SessionYmlSchema` | `SessionYml` |
| `cron/{slug}.yml` | `CronYmlSchema` | `CronYml` |
| `SKILL.md` frontmatter | `SkillMdSchema` | `SkillMd` |
| `SERVICE.md` frontmatter | `ServiceMdSchema` | `ServiceMd` |
| `ADAPTER.yml` | `AdapterYmlSchema` | `AdapterYml` |

**Nota:** Schemas com `.passthrough()` (`AgentYmlSchema`, `ChannelYmlSchema`, `SkillMdSchema`, `ServiceMdSchema`, `AdapterYmlSchema`) preservam campos extras por design.

**Estratégia de uso:**
- `Schema.parse()` — em managers (leitura dirigida, falha ruidosa)
- `Schema.safeParse()` — em scans de diretório (skip do arquivo inválido + warn no console)
