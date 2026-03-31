# S-083 — Ativar Domain Tools nos Connectors

Atualizar os arquivos index dos connectors GitLab, Evolution, Email e Implantação para importar e exportar as domain tools em vez das tools individuais.

**Resolve:** D-004 (gitlab/index.ts), D-005 (evolution/tools/index.ts), D-006 (email/tools/index.ts), D-007 (implantacao/index.ts)
**Score de prioridade:** 8
**Dependencia:** S-080, S-081, S-082 — os domain tools devem existir antes de serem importados
**PRP:** 18 — Domain Tools: Agrupamento de Tools por Domínio

---

## 1. Objetivo

Trocar os imports dos ~137 tool files individuais pelos 15 domain tool imports nos 4 connectors afetados. Após esta spec, os agentes passam a receber domain tools em vez de tools individuais.

---

## 2. Alterações

### 2.1 Alterar: `apps/backbone/src/connectors/gitlab/index.ts`

**Antes:** ~89 imports individuais de `./tools/issue-list.js`, `./tools/mr-create.js`, etc.
**Depois:** 10 imports de domain tools:

```typescript
import { createGitLabIssuesTool } from "./tools/issues.js";
import { createGitLabMrsTool } from "./tools/mrs.js";
import { createGitLabRepoTool } from "./tools/repo.js";
import { createGitLabCiTool } from "./tools/ci.js";
import { createGitLabLabelsTool } from "./tools/labels.js";
import { createGitLabMilestonesTool } from "./tools/milestones.js";
import { createGitLabReleasesTool } from "./tools/releases.js";
import { createGitLabWikiTool } from "./tools/wiki.js";
import { createGitLabUsersTool } from "./tools/users.js";
import { createGitLabProjectsTool } from "./tools/projects.js";
```

O `createTools(adapters)` atualizado:

```typescript
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
```

### 2.2 Alterar: `apps/backbone/src/connectors/evolution/tools/index.ts`

**Antes:** ~37 imports individuais de `./whatsapp-send-text.js`, etc., com `createEvolutionTools(slugs)` retornando spread de todas.
**Depois:** 4 imports de domain tools:

```typescript
import { createWhatsappMessagingTool } from "./messaging.js";
import { createWhatsappGroupsTool } from "./groups.js";
import { createWhatsappContactsTool } from "./contacts.js";
import { createWhatsappAdminTool } from "./admin.js";

export function createEvolutionTools(slugs: [string, ...string[]]) {
  return {
    ...createWhatsappMessagingTool(slugs),
    ...createWhatsappGroupsTool(slugs),
    ...createWhatsappContactsTool(slugs),
    ...createWhatsappAdminTool(slugs),
  };
}
```

A assinatura de `createEvolutionTools` permanece idêntica — recebe `slugs`, retorna `Record<string, any>`.

### 2.3 Alterar: `apps/backbone/src/connectors/email/tools/index.ts`

**Antes:** 10 exports individuais de `./send.js`, `./search.js`, etc.
**Depois:** 1 re-export da domain tool:

```typescript
export { createEmailTool } from "./email.js";
```

O connector `email/index.ts` que consome este index deve ser atualizado para chamar `createEmailTool(slugs)` em vez dos creators individuais.

### 2.4 Alterar: `apps/backbone/src/connectors/implantacao/index.ts`

**Antes:** 28 imports individuais de `../gitlab/tools/issue-list.js`, etc.
**Depois:** Importar as domain tools relevantes do GitLab:

```typescript
import { createGitLabIssuesTool } from "../gitlab/tools/issues.js";
import { createGitLabMrsTool } from "../gitlab/tools/mrs.js";
import { createGitLabRepoTool } from "../gitlab/tools/repo.js";
import { createGitLabCiTool } from "../gitlab/tools/ci.js";
```

O `createTools(adapters)` passa a retornar as domain tools completas. Isso expande o subset anterior (28 tools → todas as actions dos 4 domínios), comportamento aceitável conforme TASK.md.

---

## 3. Regras de Implementação

- **Não alterar a interface de `ConnectorDef.createTools()`** — continua retornando `Record<string, any>`
- **Não alterar `composeAgentTools()`** — ele continua compondo tudo
- **`createEvolutionTools` mantém mesma assinatura** — apenas muda o conteúdo interno
- **Email `index.ts`**: verificar como o connector `email/index.ts` consome o `tools/index.ts` — pode ser import nomeado ou factory. Adaptar conforme pattern existente
- **Implantação**: se o connector expunha apenas subsets do GitLab, agora expõe domínios completos. Não filtrar actions — o TASK.md aceita essa expansão

---

## 4. Critérios de Aceite

- [ ] `gitlab/index.ts` importa 10 domain tools, zero imports individuais
- [ ] `evolution/tools/index.ts` importa 4 domain tools, zero imports individuais
- [ ] `email/tools/index.ts` exporta 1 domain tool, zero exports individuais
- [ ] `implantacao/index.ts` importa domain tools do GitLab, zero imports individuais
- [ ] `createEvolutionTools(slugs)` mantém mesma assinatura
- [ ] `ConnectorDef.createTools()` continua retornando `Record<string, any>`
- [ ] TypeScript compila sem erros
- [ ] Nenhum import referencia arquivos individuais antigos (issue-*.ts, mr-*.ts, whatsapp-*.ts, etc.)
