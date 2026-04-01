# @agentic-backbone/gitlab-v4

Client TypeScript para a API REST GitLab v4 com cobertura completa de recursos.

## Por que este pacote existe

A API REST do GitLab identifica projetos de dois modos: pelo path completo
(`owner/group/project`) ou pelo ID numérico (`123`). Quando o path contém subgrupos,
a barra separadora precisa ser codificada (`owner%2Fgroup%2Fproject`) para que o servidor
diferencie o separador de path da URL do separador do namespace GitLab.

Essa codificação é frágil em ambientes com proxies ou gateways entre o client e o GitLab,
pois intermediários podem decodificar URLs antes de repassar a requisição, causando erros 404.

Este pacote resolve o problema convertendo o path do projeto em seu ID numérico *antes* de
compor qualquer URL. Toda chamada à API usa `/projects/123/...` — nunca o path como segmento
de URL.

## Resolução de projeto

Ao receber um nome de projeto (ex: `nic/automacao/implantacao`), o client:

1. Verifica se é um número inteiro → usa direto como ID
2. Extrai o último segmento (`implantacao`) para usar como termo de busca
3. Consulta `GET /projects?search=implantacao&search_namespaces=true`
4. Encontra o match exato por `path_with_namespace === "nic/automacao/implantacao"`
5. Cacheia o ID em memória para chamadas subsequentes do mesmo processo

## Uso

```ts
import { createGitLabClient, createIssuesResource, createIssueNotesResource } from "@agentic-backbone/gitlab-v4";

const client = createGitLabClient(
  { base_url: "https://gitlab.example.com", token: "glpat-xxxx" },
  { default_project: "nic/automacao/implantacao" }
);

const issues = createIssuesResource(client);
const issue = await issues.get("nic/automacao/implantacao", 3);
console.log(issue.title, issue.description);

const notes = createIssueNotesResource(client);
const comments = await notes.list("nic/automacao/implantacao", 3);
```

## Recursos cobertos

| Dimensão | Operações |
|---|---|
| Issues | list, get, create, update, delete, move, links, related MRs |
| Issue Notes | list, create, update, delete |
| Merge Requests | list, get, create, update, merge, delete, diff, approve, unapprove, approvals, rebase, pipelines |
| MR Notes | list, create, update, delete |
| Repo Files | get, create, update, delete |
| Repo Branches | list, get, create, delete |
| Repo Tags | list, get, create, delete |
| Repo Commits | list, get, diff, listFiles (tree) |
| Repo Compare | compare branches/refs |
| CI Pipelines | list, get, create, retry, cancel, delete |
| CI Jobs | list, get, log, retry, cancel, play |
| Labels | list, get, create, update, delete |
| Milestones | list, get, create, update, delete, issues, mrs |
| Releases | list, get, create, update, delete |
| Wiki | list, get, create, update, delete |
| Projects | search, get, members CRUD |
| Users | me, search, get |
