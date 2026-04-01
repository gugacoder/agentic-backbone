# PRP 22 — Rename: ai-sdk → agentic-sdk, ai-chat → agentic-chat

Renomear os pacotes publicaveis para eliminar confusao com o Vercel AI SDK. O nome `ai-sdk` colide com o ecossistema Vercel; `agentic-sdk` e `agentic-chat` carregam identidade propria fora do contexto do monorepo.

Execution Mode: `implementar`

---

## Contexto

### Problema

- `@agentic-backbone/ai-sdk` e confundido com o `ai` SDK da Vercel em discussoes, docs e imports
- `@agentic-backbone/ai-chat` herda a mesma ambiguidade
- Esses pacotes sao publicados no npm e usados em projetos externos — o nome precisa ter identidade propria

### O que muda

| Antes | Depois |
|---|---|
| `@agentic-backbone/ai-sdk` | `@agentic-backbone/agentic-sdk` |
| `@agentic-backbone/ai-chat` | `@agentic-backbone/agentic-chat` |
| `apps/packages/ai-sdk/` | `apps/packages/agentic-sdk/` |
| `apps/packages/ai-chat/` | `apps/packages/agentic-chat/` |

### Impacto

~80 arquivos fonte com imports, 7 `package.json`, docs e PRPs historicos.

---

## Especificacao

### 1. Renomear diretorios

```
apps/packages/ai-sdk/   → apps/packages/agentic-sdk/
apps/packages/ai-chat/  → apps/packages/agentic-chat/
```

Usar `git mv` para preservar historico.

### 2. package.json dos pacotes

**`apps/packages/agentic-sdk/package.json`:**
- `"name"`: `"@agentic-backbone/ai-sdk"` → `"@agentic-backbone/agentic-sdk"`
- `"directory"`: `"apps/packages/ai-sdk"` → `"apps/packages/agentic-sdk"`

**`apps/packages/agentic-chat/package.json`:**
- `"name"`: `"@agentic-backbone/ai-chat"` → `"@agentic-backbone/agentic-chat"`
- `"directory"`: `"apps/packages/ai-chat"` → `"apps/packages/agentic-chat"`
- Dependencia interna: `"@agentic-backbone/ai-sdk": "*"` → `"@agentic-backbone/agentic-sdk": "*"`

### 3. package.json dos consumidores

| Workspace | Dependencia antiga | Dependencia nova |
|---|---|---|
| `apps/backbone` | `@agentic-backbone/ai-sdk` | `@agentic-backbone/agentic-sdk` |
| `apps/hub` | `@agentic-backbone/ai-chat` | `@agentic-backbone/agentic-chat` |
| `apps/chat` | `@agentic-backbone/ai-chat` | `@agentic-backbone/agentic-chat` |

### 4. Root package.json (scripts)

Atualizar todos os scripts que referenciam os paths antigos:

- `build:packages` — `--workspace=apps/packages/ai-sdk` → `--workspace=apps/packages/agentic-sdk`
- `build:packages` (chat) — `--workspace=apps/packages/ai-chat` → `--workspace=apps/packages/agentic-chat`
- `bump:packages` — idem
- `publish:packages` — idem

### 5. Imports no codigo-fonte (~80 arquivos)

Search-and-replace global:

| De | Para |
|---|---|
| `from "@agentic-backbone/ai-sdk"` | `from "@agentic-backbone/agentic-sdk"` |
| `from "@agentic-backbone/ai-chat"` | `from "@agentic-backbone/agentic-chat"` |
| `from '@agentic-backbone/ai-sdk'` | `from '@agentic-backbone/agentic-sdk'` |
| `from '@agentic-backbone/ai-chat'` | `from '@agentic-backbone/agentic-chat'` |

**Arquivos principais afetados:**

- `apps/backbone/src/agent/index.ts` — import de `runAgent`, `AgentEvent`, `UsageData`
- `apps/backbone/src/memory/flush.ts` — import de `aiGenerateObject`
- `apps/hub/src/components/conversations/conversation-chat.tsx` — import de `Chat`
- `apps/packages/agentic-chat/src/display/*.tsx` (~19 renderers) — type imports de `agentic-sdk`
- `apps/packages/agentic-chat/src/display/registry.ts` — import de `DisplayToolName`
- `apps/packages/agentic-chat/src/components/Chat.tsx` — re-exports
- `tests/probe-ai.mjs`, `tests/probe-skill-direct.mjs` — imports de teste

### 6. Documentacao

**Atualizar:**

- `CLAUDE.md` (raiz) — tabela de arquitetura, comandos de build
- `apps/packages/agentic-chat/README.md` — instrucoes de instalacao e exemplos
- `apps/packages/agentic-chat/CHANGELOG.md` — referencia historica

**NAO atualizar PRPs historicos** (milestones 1-21). Eles documentam decisoes no momento em que foram escritos.

### 7. npm: deprecar pacotes antigos

Apos publicar os novos pacotes:

```bash
npm deprecate "@agentic-backbone/ai-sdk" "Renamed to @agentic-backbone/agentic-sdk"
npm deprecate "@agentic-backbone/ai-chat" "Renamed to @agentic-backbone/agentic-chat"
```

### 8. package-lock.json

Rodar `npm install` apos todas as mudancas para regenerar o lockfile.

---

## Limites

### NAO fazer

- Nao renomear o monorepo (`agentic-backbone` permanece)
- Nao renomear workspaces que nao sao pacotes publicaveis (`backbone`, `hub`, `chat`)
- Nao alterar PRPs historicos (milestones 1-21)
- Nao mudar exports ou API publica dos pacotes — apenas o nome
- Nao criar aliases/re-exports do nome antigo — corte limpo

---

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | `git mv` dos diretorios | — |
| 2 | Atualizar todos os `package.json` (pacotes + consumidores + root) | Fase 1 |
| 3 | Search-and-replace de imports no codigo-fonte | Fase 1 |
| 4 | Atualizar `CLAUDE.md` e READMEs | Fase 1 |
| 5 | `npm install` para regenerar lockfile | Fase 2 |
| 6 | Build completo (`npm run build`) para validar | Fase 3, 5 |
| 7 | Deprecar pacotes antigos no npm | Apos publicacao |

Fases 2, 3 e 4 podem rodar em paralelo apos fase 1.

---

## Validacao

- [ ] `npm run build` passa sem erros
- [ ] `npm run dev:all` inicia normalmente
- [ ] Hub carrega e exibe chat (confirma que `agentic-chat` resolve)
- [ ] Chat standalone funciona
- [ ] Backbone responde a mensagens (confirma que `agentic-sdk` resolve)
- [ ] Nenhum import antigo (`@agentic-backbone/ai-sdk` ou `@agentic-backbone/ai-chat`) no codigo-fonte
- [ ] `package-lock.json` nao contem referencias aos nomes antigos
- [ ] Testes existentes passam (`npm run test:conversation`)
