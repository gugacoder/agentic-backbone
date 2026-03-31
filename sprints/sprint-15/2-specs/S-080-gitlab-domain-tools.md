# S-080 — GitLab Domain Tools

Criar 10 domain tools que agrupam as 89 tools individuais do GitLab em domínios lógicos via `z.discriminatedUnion("action", [...])`.

**Resolve:** D-001 (GitLab domain tools), D-011 (validar Zod discriminatedUnion + .and()), D-012 (policy check readonly)
**Score de prioridade:** 10
**Dependencia:** Nenhuma — fase 1a da ordem de execução
**PRP:** 18 — Domain Tools: Agrupamento de Tools por Domínio

---

## 1. Objetivo

Reduzir 89 tools individuais do GitLab para 10 domain tools. Cada domain tool agrupa ações relacionadas usando `z.discriminatedUnion("action", [...])` com dispatch interno no `execute`. O campo `adapter` é comum a todas as actions via `.and(z.object({ adapter }))`.

---

## 2. Pattern de Domain Tool

Todas as 10 domain tools seguem este pattern:

```typescript
import { tool } from "ai";
import { z } from "zod";
import { formatError } from "../../utils.js";

// Zod schemas para cada action
const listParams = z.object({
  action: z.literal("list"),
  // ... params específicos
});

const getParams = z.object({
  action: z.literal("get"),
  // ... params específicos
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
      description: "Gerencia issues do GitLab. Ações: list, get, create, update, delete, ...",
      parameters: paramsSchema.and(z.object({
        adapter: z.enum(slugs).optional().describe("Slug do adapter GitLab"),
      })),
      execute: async (args) => {
        try {
          const { connectorRegistry } = await import("../../index.js");
          const client = connectorRegistry.createClient(args.adapter ?? slugs[0]);
          const project = args.project ?? (client as any).defaultProject;

          // Policy check para ações de escrita
          if (["create", "update", "delete"].includes(args.action)) {
            const adapterObj = adapters.find((a) => a.slug === (args.adapter ?? slugs[0]));
            if (adapterObj?.policy === "readonly") {
              return { error: "Adapter está em modo readonly" };
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

---

## 3. Alterações — 10 Arquivos Novos

### 3.1 Arquivo: `apps/backbone/src/connectors/gitlab/tools/issues.ts` (NOVO)

**Tool name:** `gitlab_issues`
**Actions:** list, get, create, update, delete, move, comment, list_comments, update_comment, delete_comment, list_links, add_link, related_mrs (13 actions)
**Substitui:** issue-list.ts, issue-get.ts, issue-create.ts, issue-update.ts, issue-delete.ts, issue-move.ts, issue-comment.ts, issue-list-comments.ts, issue-update-comment.ts, issue-delete-comment.ts, issue-list-links.ts, issue-add-link.ts, issue-related-mrs.ts
**Resource:** `createIssuesResource` de `@agentic-backbone/gitlab-v4`
**Ações readonly:** create, update, delete, move, comment, update_comment, delete_comment, add_link

Parâmetros por action (copiar dos arquivos individuais existentes):
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

### 3.2 Arquivo: `apps/backbone/src/connectors/gitlab/tools/mrs.ts` (NOVO)

**Tool name:** `gitlab_mrs`
**Actions:** list, get, create, update, delete, merge, approve, unapprove, approvals, rebase, diff, pipelines, comment, list_comments, update_comment, delete_comment (16 actions)
**Substitui:** mr-list.ts, mr-get.ts, mr-create.ts, mr-update.ts, mr-delete.ts, mr-merge.ts, mr-approve.ts, mr-unapprove.ts, mr-approvals.ts, mr-rebase.ts, mr-diff.ts, mr-pipelines.ts, mr-comment.ts, mr-list-comments.ts, mr-update-comment.ts, mr-delete-comment.ts
**Resource:** `createMergeRequestsResource`
**Ações readonly:** create, update, delete, merge, approve, unapprove, rebase, comment, update_comment, delete_comment

### 3.3 Arquivo: `apps/backbone/src/connectors/gitlab/tools/repo.ts` (NOVO)

**Tool name:** `gitlab_repo`
**Actions:** get_file, list_files, create_file, update_file, delete_file, list_branches, get_branch, create_branch, delete_branch, list_tags, get_tag, create_tag, delete_tag, list_commits, get_commit, commit_diff, compare (17 actions)
**Substitui:** repo-get-file.ts, repo-list-files.ts, repo-create-file.ts, repo-update-file.ts, repo-delete-file.ts, repo-list-branches.ts, repo-get-branch.ts, repo-create-branch.ts, repo-delete-branch.ts, repo-list-tags.ts, repo-get-tag.ts, repo-create-tag.ts, repo-delete-tag.ts, repo-list-commits.ts, repo-get-commit.ts, repo-commit-diff.ts, repo-compare.ts
**Resource:** `createRepositoryResource`
**Ações readonly:** create_file, update_file, delete_file, create_branch, delete_branch, create_tag, delete_tag

### 3.4 Arquivo: `apps/backbone/src/connectors/gitlab/tools/ci.ts` (NOVO)

**Tool name:** `gitlab_ci`
**Actions:** list_pipelines, get_pipeline, trigger_pipeline, delete_pipeline, retry_pipeline, cancel_pipeline, list_jobs, get_job, job_log, retry_job, cancel_job, play_job (12 actions)
**Substitui:** ci-list-pipelines.ts, ci-get-pipeline.ts, ci-trigger-pipeline.ts, ci-delete-pipeline.ts, ci-retry-pipeline.ts, ci-cancel-pipeline.ts, ci-list-jobs.ts, ci-get-job.ts, ci-job-log.ts, ci-retry-job.ts, ci-cancel-job.ts, ci-play-job.ts
**Resource:** `createCiResource`
**Ações readonly:** trigger_pipeline, delete_pipeline, retry_pipeline, cancel_pipeline, retry_job, cancel_job, play_job

### 3.5 Arquivo: `apps/backbone/src/connectors/gitlab/tools/labels.ts` (NOVO)

**Tool name:** `gitlab_labels`
**Actions:** list, get, create, update, delete (5 actions)
**Substitui:** label-list.ts, label-get.ts, label-create.ts, label-update.ts, label-delete.ts
**Resource:** `createLabelsResource`
**Ações readonly:** create, update, delete

### 3.6 Arquivo: `apps/backbone/src/connectors/gitlab/tools/milestones.ts` (NOVO)

**Tool name:** `gitlab_milestones`
**Actions:** list, get, create, update, delete, issues, mrs (7 actions)
**Substitui:** milestone-list.ts, milestone-get.ts, milestone-create.ts, milestone-update.ts, milestone-delete.ts, milestone-issues.ts, milestone-mrs.ts
**Resource:** `createMilestonesResource`
**Ações readonly:** create, update, delete

### 3.7 Arquivo: `apps/backbone/src/connectors/gitlab/tools/releases.ts` (NOVO)

**Tool name:** `gitlab_releases`
**Actions:** list, get, create, update, delete (5 actions)
**Substitui:** release-list.ts, release-get.ts, release-create.ts, release-update.ts, release-delete.ts
**Resource:** `createReleasesResource`
**Ações readonly:** create, update, delete

### 3.8 Arquivo: `apps/backbone/src/connectors/gitlab/tools/wiki.ts` (NOVO)

**Tool name:** `gitlab_wiki`
**Actions:** list, get, create, update, delete (5 actions)
**Substitui:** wiki-list.ts, wiki-get.ts, wiki-create.ts, wiki-update.ts, wiki-delete.ts
**Resource:** `createWikiResource`
**Ações readonly:** create, update, delete

### 3.9 Arquivo: `apps/backbone/src/connectors/gitlab/tools/users.ts` (NOVO)

**Tool name:** `gitlab_users`
**Actions:** me, get, search (3 actions)
**Substitui:** user-me.ts, user-get.ts, user-search.ts
**Resource:** `createUsersResource`
**Ações readonly:** nenhuma (todas são leitura)

### 3.10 Arquivo: `apps/backbone/src/connectors/gitlab/tools/projects.ts` (NOVO)

**Tool name:** `gitlab_projects`
**Actions:** search, get, list_members, add_member, update_member, remove_member (6 actions)
**Substitui:** project-search.ts, project-get.ts, project-list-members.ts, project-add-member.ts, project-update-member.ts, project-remove-member.ts
**Resource:** `createProjectsResource`
**Ações readonly:** add_member, update_member, remove_member

---

## 4. Regras de Implementação

- **Copiar parâmetros Zod dos arquivos individuais existentes** — não inventar schemas novos
- **`action` é sempre o primeiro campo** de cada schema variant e usa `z.literal()`
- **`adapter` fica no `.and()`** — comum a todas as actions, sempre opcional com default no primeiro slug
- **`description` da tool lista todas as ações** — o modelo precisa saber o que pode fazer sem ver o schema
- **Policy check obrigatório** para ações de escrita: verificar `adapters.find(a => a.slug === slug)?.policy === "readonly"` e retornar `{ error: "Adapter está em modo readonly" }` se positivo
- **`formatError`** para catch genérico — mesmo pattern dos arquivos individuais
- **Import dinâmico de `connectorRegistry`** — mesmo pattern: `const { connectorRegistry } = await import("../../index.js")`
- **Validar que `z.discriminatedUnion().and()` gera JSON Schema compatível** com o Vercel AI SDK antes de finalizar todos os 10 arquivos. Se `allOf` causar problemas, usar alternativa: colocar `adapter` dentro de cada variant

---

## 5. Critérios de Aceite

- [ ] 10 arquivos novos em `apps/backbone/src/connectors/gitlab/tools/`: issues.ts, mrs.ts, repo.ts, ci.ts, labels.ts, milestones.ts, releases.ts, wiki.ts, users.ts, projects.ts
- [ ] Cada arquivo exporta uma factory function `createGitLab{Domain}Tool(adapters)` retornando `Record<string, any>`
- [ ] Total de actions nas 10 domain tools = 89 (mesmo número de tools individuais substituídas)
- [ ] Todas as ações de escrita têm policy check readonly
- [ ] Schemas Zod dos parâmetros são idênticos aos dos arquivos individuais (mesmos campos, tipos, defaults)
- [ ] `z.discriminatedUnion("action", [...]).and(z.object({ adapter }))` funciona com o AI SDK (JSON Schema gerado é válido)
- [ ] Nenhum arquivo individual antigo é modificado nesta spec (serão removidos em S-085)
- [ ] TypeScript compila sem erros nos novos arquivos
