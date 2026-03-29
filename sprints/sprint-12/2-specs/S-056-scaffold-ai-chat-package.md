# S-056 — Scaffold do Pacote ai-chat

Criar o pacote `@agentic-backbone/ai-chat` com estrutura de diretórios, configuração TypeScript e package.json.

**Resolve:** AC-001 (pacote apps/packages/ai-chat/ não existe — GAP CRÍTICO)
**Score de prioridade:** 10
**Dependência:** Nenhuma — pré-requisito de todas as outras specs do sprint-12
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar o diretório `apps/packages/ai-chat/` com scaffold completo do pacote
- Configurar `package.json` com nome `@agentic-backbone/ai-chat`, peer deps (react, react-dom) e deps de build
- Configurar `tsconfig.json` alinhado ao padrão do monorepo (ES2022, ESNext, bundler resolution)
- Criar estrutura `src/` com subpastas organizacionais: `hooks/`, `parts/`, `display/`, `components/`
- Criar `src/index.ts` vazio (será populado incrementalmente pelas demais specs)

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/package.json` (NOVO)

```json
{
  "name": "@agentic-backbone/ai-chat",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@ai-sdk/react": "^1.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0",
    "lucide-react": "^0.400.0",
    "recharts": "^2.12.0",
    "embla-carousel-react": "^8.0.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

> Versões exatas devem ser alinhadas às já usadas no monorepo (hub, chat).

### 2.2 Arquivo: `apps/packages/ai-chat/tsconfig.json` (NOVO)

Estender o padrão do monorepo. Target ES2022, module ESNext, jsx react-jsx, moduleResolution bundler.

### 2.3 Estrutura de diretórios (NOVOS)

```
apps/packages/ai-chat/src/
  index.ts           # barrel export (vazio inicialmente)
  hooks/             # useBackboneChat e outros hooks
  parts/             # PartRenderer, ReasoningBlock, ToolActivity, ToolResult
  display/           # 19 display renderers + registry
  components/        # Chat, MessageBubble, MessageList, MessageInput, Markdown, StreamingIndicator
```

### 2.4 Arquivo: `package.json` raiz — adicionar ao `workspaces`

Adicionar `"apps/packages/ai-chat"` ao array `workspaces` (se não coberto pelo glob `apps/packages/*`).

---

## 3. Regras de Implementação

- **Não instalar dependências nesta spec** — apenas declarar no package.json. S-071 cuida do install
- **Estrutura de pastas é organizacional** — criar apenas diretórios e arquivos index vazios
- **Alinhar versões** ao que já existe no monorepo (verificar hub/package.json e chat/package.json)
- **Não criar componentes** — esta spec cobre apenas scaffold

---

## 4. Critérios de Aceite

- [ ] Diretório `apps/packages/ai-chat/` existe com package.json e tsconfig.json
- [ ] `src/index.ts` existe (pode estar vazio ou com comentário placeholder)
- [ ] Subpastas `hooks/`, `parts/`, `display/`, `components/` existem
- [ ] package.json declara nome `@agentic-backbone/ai-chat` com peer deps react/react-dom
- [ ] tsconfig.json está configurado com jsx react-jsx e moduleResolution bundler
- [ ] Pacote está referenciado no workspace raiz
