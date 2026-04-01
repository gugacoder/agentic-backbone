# PRP-18D — Ativacao das Domain Tools nos Connectors

Atualizar os arquivos index dos connectors GitLab, Evolution, Email e Implantacao para importar e exportar as domain tools em vez das tools individuais.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Os connectors importam tools individuais:
- `gitlab/index.ts`: ~89 imports individuais
- `evolution/tools/index.ts`: ~37 imports individuais
- `email/tools/index.ts`: 10 exports individuais
- `implantacao/index.ts`: 28 imports do GitLab individual

### Estado desejado

- `gitlab/index.ts`: 10 imports de domain tools
- `evolution/tools/index.ts`: 4 imports de domain tools
- `email/tools/index.ts`: 1 re-export da domain tool
- `implantacao/index.ts`: imports das domain tools do GitLab

### Dependencias

- **PRP-18A** — domain tools GitLab devem existir
- **PRP-18B** — domain tools WhatsApp devem existir
- **PRP-18C** — domain tool Email deve existir

## Especificacao

### Feature F-315: Atualizar `gitlab/index.ts`

**Spec:** S-083 secao 2.1

Alterar `apps/backbone/src/connectors/gitlab/index.ts`:
- Substituir ~89 imports individuais por 10 imports de domain tools
- Atualizar `createTools(adapters)` para retornar spread das 10 domain tools

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

// createTools(adapters):
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
```

### Feature F-316: Atualizar `evolution/tools/index.ts`

**Spec:** S-083 secao 2.2

Alterar `apps/backbone/src/connectors/evolution/tools/index.ts`:
- Substituir ~37 imports por 4 imports de domain tools
- Manter assinatura de `createEvolutionTools(slugs)` identica

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

### Feature F-317: Atualizar `email/tools/index.ts`

**Spec:** S-083 secao 2.3

Alterar `apps/backbone/src/connectors/email/tools/index.ts`:
- Substituir 10 exports individuais por 1 re-export da domain tool

```typescript
export { createEmailTool } from "./email.js";
```

Verificar como `email/index.ts` consome o `tools/index.ts` e adaptar conforme necessario.

### Feature F-318: Atualizar `implantacao/index.ts`

**Spec:** S-083 secao 2.4

Alterar `apps/backbone/src/connectors/implantacao/index.ts`:
- Substituir 28 imports individuais do GitLab por imports das domain tools relevantes

```typescript
import { createGitLabIssuesTool } from "../gitlab/tools/issues.js";
import { createGitLabMrsTool } from "../gitlab/tools/mrs.js";
import { createGitLabRepoTool } from "../gitlab/tools/repo.js";
import { createGitLabCiTool } from "../gitlab/tools/ci.js";
```

Implantacao passa a expor todas as actions de cada dominio (antes era subset de 28). Comportamento expandido mas aceitavel conforme TASK.md.

## Limites

- **NAO** alterar a interface de `ConnectorDef.createTools()` — continua retornando `Record<string, any>`
- **NAO** alterar `composeAgentTools()` — ele continua compondo tudo
- **NAO** filtrar actions no implantacao — TASK.md aceita expansao
- **NAO** remover arquivos individuais — sera feito no PRP-18F

## Validacao

- [ ] `gitlab/index.ts` importa 10 domain tools, zero imports individuais
- [ ] `evolution/tools/index.ts` importa 4 domain tools, zero imports individuais
- [ ] `email/tools/index.ts` exporta 1 domain tool, zero exports individuais
- [ ] `implantacao/index.ts` importa domain tools do GitLab, zero imports individuais
- [ ] `createEvolutionTools(slugs)` mantem mesma assinatura
- [ ] `ConnectorDef.createTools()` continua retornando `Record<string, any>`
- [ ] TypeScript compila sem erros
- [ ] Nenhum import referencia arquivos individuais antigos

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-315 gitlab/index.ts | S-083 | D-004 |
| F-316 evolution/tools/index.ts | S-083 | D-005 |
| F-317 email/tools/index.ts | S-083 | D-006 |
| F-318 implantacao/index.ts | S-083 | D-007 |
