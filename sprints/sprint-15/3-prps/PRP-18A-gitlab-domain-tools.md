# PRP-18A — GitLab Domain Tools

Criar 10 domain tools que agrupam as 89 tools individuais do GitLab em dominios logicos via `z.discriminatedUnion("action", [...])`.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O connector GitLab tem 89 tool files individuais em `apps/backbone/src/connectors/gitlab/tools/`: ci-*.ts (12), issue-*.ts (13), label-*.ts (5), milestone-*.ts (7), mr-*.ts (16), project-*.ts (6), release-*.ts (5), repo-*.ts (17), user-*.ts (3), wiki-*.ts (5). Cada arquivo exporta uma factory function `createGitLab*Tool(adapters)` que retorna `Record<string, any>` com uma unica tool.

### Estado desejado

10 arquivos de domain tools, cada um agrupando todas as acoes de um dominio em uma unica tool com parametro `action` discriminado. Total de actions = 89 (mesma cobertura).

### Dependencias

- **Nenhuma** — fase 1a da ordem de execucao, independente de S-081 e S-082

## Especificacao

### Pattern de Domain Tool

Todas as 10 domain tools seguem este pattern:

```typescript
import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../utils.js";

const listParams = z.object({
  action: z.literal("list"),
  // params especificos
});

const getParams = z.object({
  action: z.literal("get"),
  // params especificos
});

const paramsSchema = z.discriminatedUnion("action", [
  listParams,
  getParams,
  // ...
]);

export function createGitLabIssuesTool(adapters: { slug: string; policy: string }[]) {
  const slugs = adapters.map((a) => a.slug) as [string, ...string[]];

  return {
    gitlab_issues: tool({
      description: "Gerencia issues do GitLab. Acoes: list, get, create, update, delete, ...",
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab"),
      })),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? slugs[0]);
          const project = args.project ?? (client as any).defaultProject;

          // Policy check para acoes de escrita
          if (["create", "update", "delete"].includes(args.action)) {
            const adapterObj = adapters.find((a) => a.slug === (args.adapter ?? slugs[0]));
            if (adapterObj?.policy === "readonly") {
              return { error: "Adapter esta em modo readonly" };
            }
          }

          switch (args.action) {
            case "list": return { issues: await resource.list(project, args) };
            case "get": return { issue: await resource.get(project, args.iid) };
            // ... dispatch por action
          }
        } catch (err) {
          return { error: formatError(err) };
        }
      },
    }),
  };
}
```

Regras do pattern:
- `action` eh sempre o primeiro campo e usa `z.literal()`
- `adapter` fica no `.and()` — comum a todas as actions, opcional com default no primeiro slug
- `description` lista todas as acoes disponiveis
- `execute` faz dispatch por `args.action` para handlers individuais
- Policy check para acoes de escrita: verificar `adapter.policy === "readonly"`
- `formatError` no catch generico

### Feature F-300: Domain tool `gitlab_issues` (issues.ts)

**Spec:** S-080 secao 3.1

Criar `apps/backbone/src/connectors/gitlab/tools/issues.ts`.

**Tool name:** `gitlab_issues`
**Actions (13):** list, get, create, update, delete, move, comment, list_comments, update_comment, delete_comment, list_links, add_link, related_mrs
**Resource:** `createIssuesResource` de `@agentic-backbone/gitlab-v4`
**Acoes readonly:** create, update, delete, move, comment, update_comment, delete_comment, add_link

Parametros por action (copiar dos arquivos individuais existentes):
- `list`: project?, state?, labels?, milestone?, assignee_username?, search?, per_page?
- `get`: project?, iid
- `create`: project?, title, description?, labels?, milestone_id?, assignee_ids?
- `update`: project?, iid, title?, description?, state_event?, labels?, milestone_id?, assignee_ids?
- `delete`: project?, iid
- `move`: project?, iid, to_project_id
- `comment`: project?, iid, body
- `list_comments`: project?, iid
- `update_comment`: project?, iid, note_id, body
- `delete_comment`: project?, iid, note_id
- `list_links`: project?, iid
- `add_link`: project?, iid, target_project_id, target_issue_iid, link_type?
- `related_mrs`: project?, iid

### Feature F-301: Domain tool `gitlab_mrs` (mrs.ts)

**Spec:** S-080 secao 3.2

Criar `apps/backbone/src/connectors/gitlab/tools/mrs.ts`.

**Tool name:** `gitlab_mrs`
**Actions (16):** list, get, create, update, delete, merge, approve, unapprove, approvals, rebase, diff, pipelines, comment, list_comments, update_comment, delete_comment
**Resource:** `createMergeRequestsResource`
**Acoes readonly:** create, update, delete, merge, approve, unapprove, rebase, comment, update_comment, delete_comment

### Feature F-302: Domain tool `gitlab_repo` (repo.ts)

**Spec:** S-080 secao 3.3

Criar `apps/backbone/src/connectors/gitlab/tools/repo.ts`.

**Tool name:** `gitlab_repo`
**Actions (17):** get_file, list_files, create_file, update_file, delete_file, list_branches, get_branch, create_branch, delete_branch, list_tags, get_tag, create_tag, delete_tag, list_commits, get_commit, commit_diff, compare
**Resource:** `createRepositoryResource`
**Acoes readonly:** create_file, update_file, delete_file, create_branch, delete_branch, create_tag, delete_tag

### Feature F-303: Domain tool `gitlab_ci` (ci.ts)

**Spec:** S-080 secao 3.4

Criar `apps/backbone/src/connectors/gitlab/tools/ci.ts`.

**Tool name:** `gitlab_ci`
**Actions (12):** list_pipelines, get_pipeline, trigger_pipeline, delete_pipeline, retry_pipeline, cancel_pipeline, list_jobs, get_job, job_log, retry_job, cancel_job, play_job
**Resource:** `createCiResource`
**Acoes readonly:** trigger_pipeline, delete_pipeline, retry_pipeline, cancel_pipeline, retry_job, cancel_job, play_job

### Feature F-304: Domain tool `gitlab_labels` (labels.ts)

**Spec:** S-080 secao 3.5

Criar `apps/backbone/src/connectors/gitlab/tools/labels.ts`.

**Tool name:** `gitlab_labels`
**Actions (5):** list, get, create, update, delete
**Resource:** `createLabelsResource`
**Acoes readonly:** create, update, delete

### Feature F-305: Domain tool `gitlab_milestones` (milestones.ts)

**Spec:** S-080 secao 3.6

Criar `apps/backbone/src/connectors/gitlab/tools/milestones.ts`.

**Tool name:** `gitlab_milestones`
**Actions (7):** list, get, create, update, delete, issues, mrs
**Resource:** `createMilestonesResource`
**Acoes readonly:** create, update, delete

### Feature F-306: Domain tool `gitlab_releases` (releases.ts)

**Spec:** S-080 secao 3.7

Criar `apps/backbone/src/connectors/gitlab/tools/releases.ts`.

**Tool name:** `gitlab_releases`
**Actions (5):** list, get, create, update, delete
**Resource:** `createReleasesResource`
**Acoes readonly:** create, update, delete

### Feature F-307: Domain tool `gitlab_wiki` (wiki.ts)

**Spec:** S-080 secao 3.8

Criar `apps/backbone/src/connectors/gitlab/tools/wiki.ts`.

**Tool name:** `gitlab_wiki`
**Actions (5):** list, get, create, update, delete
**Resource:** `createWikiResource`
**Acoes readonly:** create, update, delete

### Feature F-308: Domain tool `gitlab_users` (users.ts)

**Spec:** S-080 secao 3.9

Criar `apps/backbone/src/connectors/gitlab/tools/users.ts`.

**Tool name:** `gitlab_users`
**Actions (3):** me, get, search
**Resource:** `createUsersResource`
**Acoes readonly:** nenhuma (todas sao leitura)

### Feature F-309: Domain tool `gitlab_projects` (projects.ts)

**Spec:** S-080 secao 3.10

Criar `apps/backbone/src/connectors/gitlab/tools/projects.ts`.

**Tool name:** `gitlab_projects`
**Actions (6):** search, get, list_members, add_member, update_member, remove_member
**Resource:** `createProjectsResource`
**Acoes readonly:** add_member, update_member, remove_member

## Limites

- **NAO** alterar o `@agentic-backbone/gitlab-v4` package — os resources continuam iguais
- **NAO** modificar os tool files individuais existentes — serao removidos no PRP-18F
- **NAO** alterar `gitlab/index.ts` — sera feito no PRP-18D
- **NAO** inventar schemas novos — copiar parametros Zod dos arquivos individuais existentes
- **NAO** alterar a interface de `ConnectorDef.createTools()`

## Validacao

- [ ] 10 arquivos novos em `apps/backbone/src/connectors/gitlab/tools/`: issues.ts, mrs.ts, repo.ts, ci.ts, labels.ts, milestones.ts, releases.ts, wiki.ts, users.ts, projects.ts
- [ ] Cada arquivo exporta factory function `createGitLab{Domain}Tool(adapters)` retornando `Record<string, any>`
- [ ] Total de actions nas 10 domain tools = 89
- [ ] Todas as acoes de escrita tem policy check readonly
- [ ] Schemas Zod identicos aos dos arquivos individuais (mesmos campos, tipos, defaults)
- [ ] `z.discriminatedUnion("action", [...]).and(z.object({ adapter }))` funciona com o AI SDK
- [ ] Nenhum arquivo individual antigo eh modificado
- [ ] TypeScript compila sem erros nos novos arquivos

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-300 gitlab_issues | S-080 | D-001, D-011, D-012 |
| F-301 gitlab_mrs | S-080 | D-001, D-011, D-012 |
| F-302 gitlab_repo | S-080 | D-001, D-011, D-012 |
| F-303 gitlab_ci | S-080 | D-001, D-011, D-012 |
| F-304 gitlab_labels | S-080 | D-001, D-012 |
| F-305 gitlab_milestones | S-080 | D-001, D-012 |
| F-306 gitlab_releases | S-080 | D-001, D-012 |
| F-307 gitlab_wiki | S-080 | D-001, D-012 |
| F-308 gitlab_users | S-080 | D-001 |
| F-309 gitlab_projects | S-080 | D-001, D-012 |
