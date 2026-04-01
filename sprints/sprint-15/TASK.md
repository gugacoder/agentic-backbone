# PRP 18 — Domain Tools: Agrupamento de Tools por Dominio

Agrupar tools de connectors com muitas acoes individuais (gitlab ~89, whatsapp ~37, email ~11) em "domain tools" — uma tool por dominio com parametro `action` discriminado via zod. Reduz de ~168 para ~45 tools por agente.

## Execution Mode

`implementar`

---

## Contexto

### Estado atual

Cada acao de connector eh uma tool separada com seu proprio schema zod. O agente `guga.kai` tem 168 tools:

| Grupo | Tools | Exemplo |
|---|---|---|
| GitLab | 89 | `gitlab_issue_list`, `gitlab_mr_create`, `gitlab_repo_get_file` |
| WhatsApp | 37 | `whatsapp_send_text`, `whatsapp_create_group`, `whatsapp_find_chats` |
| Email | 11 | `email_send`, `email_search`, `email_draft_create` |
| Twilio | 9 | `make_call`, `send_sms`, `list_calls` |
| Jobs | 8 | `submit_job`, `list_jobs`, `poll_job` |
| Cron | 7 | `cron_add`, `cron_list`, `cron_run` |
| GitHub | 5 | `github_search`, `github_create_issue` |
| Memory | 4 | `memory_save`, `memory_search` |
| ElevenLabs | 2 | `elevenlabs_speak`, `elevenlabs_list_voices` |
| Outros | 6 | `emit_event`, `sysinfo`, `send_message`, `list_messages`, `whatsapp_api_raw` |

Tools sao criadas em `apps/backbone/src/connectors/{slug}/tools/{tool-name}.ts`, cada uma usando `tool()` do Vercel AI SDK. O `connectorRegistry.composeTools(agentId)` monta todas as tools dos adapters habilitados e retorna `Record<string, any>`.

### Problema / Motivacao

1. **Groq limita a 128 tools** por request — agente com 168 tools nao funciona
2. **Qualidade de selecao** — quanto mais tools, pior o modelo escolhe a correta
3. **Context window** — 168 schemas de tools consomem tokens significativos do contexto

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| GitLab | 89 tools individuais | 10 domain tools |
| WhatsApp | 37 tools individuais | 4 domain tools |
| Email | 11 tools individuais | 2 domain tools |
| Total guga.kai | ~168 tools | ~45 tools |
| Schema de cada tool | Flat zod object | Discriminated union no `action` |
| Arquivos por dominio | 1 por acao (89 arquivos no gitlab) | 1 por dominio (10 arquivos no gitlab) |
| Tools pequenas (memory, cron, etc) | Individuais | Sem mudanca |

### Dependencias

- **PRP 10 (AI Provider Registry)** — ja implementado. O `maxTools` do provider determina quando o corte eh necessario.

---

## Especificacao

### 1. Pattern de domain tool

Uma domain tool agrupa acoes relacionadas em uma unica tool com `action` como discriminador.

#### 1.1 Estrutura do schema

```typescript
import { tool } from "ai";
import { z } from "zod";

const listParams = z.object({
  action: z.literal("list"),
  project: z.string().optional().describe("Projeto (path ou ID). Default do adapter se omitido."),
  state: z.enum(["opened", "closed", "all"]).optional().default("opened"),
  labels: z.string().optional().describe("Labels separadas por virgula"),
  per_page: z.number().optional().default(20),
});

const getParams = z.object({
  action: z.literal("get"),
  project: z.string().optional(),
  iid: z.number().describe("Numero da issue"),
});

const createParams = z.object({
  action: z.literal("create"),
  project: z.string().optional(),
  title: z.string().describe("Titulo da issue"),
  description: z.string().optional(),
  labels: z.string().optional(),
});

// ... demais acoes

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  createParams,
  // ...
]);

export function createGitLabIssuesTool(adapters: { slug: string; policy: string }[]) {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];
  const defaultSlug = slugs[0];

  return {
    gitlab_issues: tool({
      description: [
        "Gerencia issues do GitLab.",
        "Acoes: list, get, create, update, delete, move, comment, list_comments, update_comment, delete_comment, list_links, add_link, related_mrs.",
      ].join(" "),
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab"),
      })),
      execute: async (args) => {
        // dispatch por action
      },
    }),
  };
}
```

#### 1.2 Regras do pattern

- O parametro `action` eh sempre o primeiro campo e usa `z.literal()`
- Cada action tem seus proprios parametros via discriminated union
- O campo `adapter` (ou `instance` para whatsapp) eh comum a todas as actions e fica no `.and()`
- A `description` da tool lista todas as acoes disponiveis — o modelo precisa saber o que pode fazer
- O `execute` faz dispatch por `args.action` para handlers individuais
- Policy check (readonly) eh feito no execute para acoes de escrita

#### 1.3 Handlers

Os handlers reutilizam a logica existente dos tool files atuais. Cada domain tool tem um arquivo que importa os resources do connector e despacha:

```typescript
execute: async (args) => {
  try {
    const { connectorRegistry } = await import("../../index.js");
    const client = connectorRegistry.createClient(args.adapter ?? defaultSlug);
    const project = args.project ?? (client as any).defaultProject;

    switch (args.action) {
      case "list": return { issues: await issuesResource.list(project, args) };
      case "get": return { issue: await issuesResource.get(project, args.iid) };
      case "create": {
        if (isReadonly(args.adapter)) return { error: "Adapter readonly" };
        return { issue: await issuesResource.create(project, args) };
      }
      // ...
    }
  } catch (err) {
    return { error: formatError(err) };
  }
}
```

### 2. Dominos GitLab — 10 domain tools

Arquivo base: `apps/backbone/src/connectors/gitlab/tools/`

Cada domain tool substitui os tool files individuais do dominio.

| Domain Tool | Actions | Tools substituidas |
|---|---|---|
| `gitlab_issues` | list, get, create, update, delete, move, comment, list_comments, update_comment, delete_comment, list_links, add_link, related_mrs | 13 |
| `gitlab_mrs` | list, get, create, update, delete, merge, approve, unapprove, approvals, rebase, diff, pipelines, comment, list_comments, update_comment, delete_comment | 16 |
| `gitlab_repo` | get_file, list_files, create_file, update_file, delete_file, list_branches, get_branch, create_branch, delete_branch, list_tags, get_tag, create_tag, delete_tag, list_commits, get_commit, commit_diff, compare | 17 |
| `gitlab_ci` | list_pipelines, get_pipeline, trigger_pipeline, delete_pipeline, retry_pipeline, cancel_pipeline, list_jobs, get_job, job_log, retry_job, cancel_job, play_job | 12 |
| `gitlab_labels` | list, get, create, update, delete | 5 |
| `gitlab_milestones` | list, get, create, update, delete, issues, mrs | 7 |
| `gitlab_releases` | list, get, create, update, delete | 5 |
| `gitlab_wiki` | list, get, create, update, delete | 5 |
| `gitlab_users` | me, get, search | 3 |
| `gitlab_projects` | search, get, list_members, add_member, update_member, remove_member | 6 |

**Total: 89 tools → 10 domain tools**

#### 2.1 Arquivo: `apps/backbone/src/connectors/gitlab/tools/issues.ts` (novo)

Substitui: `issue-list.ts`, `issue-get.ts`, `issue-create.ts`, `issue-update.ts`, `issue-delete.ts`, `issue-move.ts`, `issue-comment.ts`, `issue-list-comments.ts`, `issue-update-comment.ts`, `issue-delete-comment.ts`, `issue-list-links.ts`, `issue-add-link.ts`, `issue-related-mrs.ts`

Seguir pattern descrito em 1.1. Importar `createIssuesResource` de `@agentic-backbone/gitlab-v4`.

#### 2.2 Arquivo: `apps/backbone/src/connectors/gitlab/tools/mrs.ts` (novo)

Substitui os 16 tool files de MR. Importar `createMergeRequestsResource`.

#### 2.3-2.10 Demais dominios

Mesmo pattern. Um arquivo por dominio, cada um importando o resource correspondente do `@agentic-backbone/gitlab-v4`.

#### 2.11 Arquivo: `apps/backbone/src/connectors/gitlab/index.ts` (alterar)

Substituir os ~89 imports individuais por 10 imports de domain tool:

```typescript
import { createGitLabIssuesTool } from "./tools/issues.js";
import { createGitLabMrsTool } from "./tools/mrs.js";
import { createGitLabRepoTool } from "./tools/repo.js";
// ...

export const gitlabConnector: ConnectorDef = {
  // ...
  createTools(adapters) {
    if (adapters.length === 0) return null;
    return {
      ...createGitLabIssuesTool(adapters),
      ...createGitLabMrsTool(adapters),
      ...createGitLabRepoTool(adapters),
      ...createGitLabCiTool(adapters),
      ...createGitLabLabelsTool(adapters),
      ...createGitLabMilestonesTool(adapters),
      ...createGitLabReleasesTool(adapters),
      ...createGitLabWikiTool(adapters),
      ...createGitLabUsersTool(adapters),
      ...createGitLabProjectsTool(adapters),
    };
  },
};
```

### 3. Dominios WhatsApp — 4 domain tools

Arquivo base: `apps/backbone/src/connectors/evolution/tools/`

| Domain Tool | Actions | Tools substituidas |
|---|---|---|
| `whatsapp_messaging` | send_text, send_media, send_audio, send_location, send_contact, send_reaction, send_poll, send_sticker, send_list, send_buttons, delete_message, mark_as_read, send_presence | 13 |
| `whatsapp_groups` | create, list, info, participants, invite_code, send_invite, update_participant, update_setting, update_subject, update_description, leave | 11 |
| `whatsapp_contacts` | check_numbers, find_contacts, find_messages, find_chats, fetch_profile, block, archive_chat | 7 |
| `whatsapp_admin` | connection_state, list_instances, list_labels, handle_label, api_raw | 5 |

**Total: 37 tools → 4 domain tools** (+ `whatsapp_api_raw` migra para `whatsapp_admin` action `api_raw`)

#### 3.1 Arquivo: `apps/backbone/src/connectors/evolution/tools/messaging.ts` (novo)

Substitui: `whatsapp-send-text.ts`, `whatsapp-send-media.ts`, etc. Usa `connectorRegistry.createClient(instance)` e despacha para o endpoint correto via `client.send()`.

#### 3.2-3.4 Demais dominios

Mesmo pattern.

#### 3.5 Arquivo: `apps/backbone/src/connectors/evolution/tools/index.ts` (alterar)

Substituir ~37 imports por 4 imports de domain tool.

### 4. Dominios Email — 2 domain tools

Arquivo base: `apps/backbone/src/connectors/email/tools/`

| Domain Tool | Actions | Tools substituidas |
|---|---|---|
| `email_messages` | send, search, read, download_attachment, manage_flags, move, delete, list_mailboxes | 8 |
| `email_drafts` | create, send | 2 |

**Total: 11 tools → 2 domain tools** (ou 1 se `email_drafts` for incorporado em `email_messages` como actions `draft_create` e `draft_send`)

**Decisao:** 1 domain tool `email` com todas as 10 actions. Email nao tem volume suficiente para justificar 2 tools.

### 5. Connector implantacao

O connector `implantacao` (`apps/backbone/src/connectors/implantacao/index.ts`) eh um wrapper que importa e re-exporta tools do gitlab. Apos a migracao do gitlab para domain tools, o implantacao deve importar as novas domain tools.

Alterar para importar de `../gitlab/tools/issues.js`, `../gitlab/tools/mrs.js`, etc.

### 6. maxTools no provider config

#### 6.1 Arquivo: `apps/backbone/src/settings/llm.ts`

Adicionar `maxTools` ao `PROVIDER_CONFIGS`:

```typescript
const PROVIDER_CONFIGS: Record<LlmProvider, { baseURL: string; apiKeyEnv: string; maxTools?: number }> = {
  openrouter: { baseURL: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  groq:       { baseURL: "https://api.groq.com/openai/v1", apiKeyEnv: "GROQ_API_KEY", maxTools: 128 },
};
```

#### 6.2 Arquivo: `apps/backbone/src/agent/index.ts`

Apos `composeAgentTools`, se `maxTools` esta definido e o numero de tools excede, logar warning:

```typescript
const maxTools = providerConf.maxTools;
if (maxTools && tools && Object.keys(tools).length > maxTools) {
  console.warn(`[agent] ${Object.keys(tools).length} tools exceeds provider limit of ${maxTools}`);
}
```

Nao cortar automaticamente — o agrupamento por dominio resolve. O warning serve como alerta para novos connectors que possam inflar o total.

### 7. Limpeza de arquivos antigos

Apos a migracao, remover os tool files individuais substituidos:

- `apps/backbone/src/connectors/gitlab/tools/issue-*.ts` (13 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/mr-*.ts` (16 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/repo-*.ts` (17 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/ci-*.ts` (12 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/label-*.ts` (5 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/milestone-*.ts` (7 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/release-*.ts` (5 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/wiki-*.ts` (5 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/user-*.ts` (3 arquivos)
- `apps/backbone/src/connectors/gitlab/tools/project-*.ts` (6 arquivos)
- `apps/backbone/src/connectors/evolution/tools/whatsapp-*.ts` (35 arquivos)
- `apps/backbone/src/connectors/evolution/tools/evolution-api.ts` (1 arquivo)
- `apps/backbone/src/connectors/email/tools/*.ts` individuais (10 arquivos)

---

## Limites

### NAO fazer

- NAO agrupar tools pequenas (memory, cron, jobs, github, twilio, elevenlabs) — ja sao poucas e o agrupamento nao traz ganho
- NAO alterar a interface de `ConnectorDef.createTools()` — ela continua retornando `Record<string, any>`
- NAO alterar `composeAgentTools` — ele continua compondo tudo, o agrupamento eh interno ao connector
- NAO implementar corte automatico por priority — o agrupamento resolve o limite
- NAO alterar o `@agentic-backbone/gitlab-v4` package — os resources continuam iguais
- NAO mudar nomes de connectors ou adapters
- NAO quebrar conversas existentes — tool calls antigos com nomes individuais nao serao restaurados, mas isso eh aceitavel (projeto nao esta em producao)

### Observacoes

- O connector `implantacao` expoe um subconjunto do gitlab (28 de 89 tools). Apos migracao, ele importa as domain tools do gitlab e o agente recebe todas as actions de cada dominio, mesmo que antes tivesse apenas um subset. Isso eh aceitavel — ter actions extras no schema nao causa problemas
- Discord (3 tools), Slack (2 tools), GitHub (5 tools), Twilio (9 tools) sao pequenos demais para agrupar. Se no futuro crescerem, aplicar o mesmo pattern
- O `whatsapp_api_raw` (fallback generico da Evolution API) migra para action `api_raw` dentro de `whatsapp_admin`

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1a | GitLab domain tools: criar 10 arquivos em `gitlab/tools/` | nada |
| 1b | WhatsApp domain tools: criar 4 arquivos em `evolution/tools/` | nada |
| 1c | Email domain tool: criar 1 arquivo em `email/tools/` | nada |
| 2a | `gitlab/index.ts`: trocar imports para domain tools | 1a |
| 2b | `evolution/tools/index.ts`: trocar imports para domain tools | 1b |
| 2c | `email/tools/index.ts`: trocar imports para domain tool | 1c |
| 2d | `implantacao/index.ts`: trocar imports para gitlab domain tools | 1a |
| 3 | `llm.ts`: adicionar `maxTools` ao `PROVIDER_CONFIGS` | nada |
| 4 | `agent/index.ts`: warning quando tools excedem `maxTools` | 3 |
| 5 | Remover tool files individuais substituidos | 2a, 2b, 2c |
| 6 | Build + teste com plano free (Groq) | 5 |

Fases 1a, 1b, 1c sao independentes e podem ser executadas em paralelo.
Fases 2a, 2b, 2c, 2d sao independentes e podem ser executadas em paralelo.
