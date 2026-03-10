# Index Pattern — Dynamic Tool Loading

Substituir monolitos `tool-defs.ts` por uma pasta de arquivos individuais com descoberta automática.

## Problema

Arquivos como `cron/tool-defs.ts` (209 linhas) ou `memory/tool-defs.ts` (165 linhas) acumulam todas as tools num bloco único. Para adicionar uma tool, é preciso editar o arquivo. Para saber quais tools existem, é preciso lê-lo inteiro.

## Solução

Cada tool vira um arquivo. Um loader dinâmico descobre a pasta na inicialização.

```
subsistema/
  tool-defs.ts        ← loader (permanece no mesmo path, callers não mudam)
  defs/
    tool-a.ts
    tool-b.ts
  _utils.ts           ← utilitários compartilhados (opcional)
```

## Convenção de cada arquivo de tool

A assinatura de `create` varia por subsistema:

```typescript
// defs/minha-tool.ts — subsistemas com agrupamento por conector (adapters)
export const connector = "mysql";
export function create(adapters: { slug: string; policy: string }[]): ToolDefinition { ... }

// defs/minha-tool.ts — subsistemas com acesso ao agentId (tools, memory, etc.)
export function create(agentId: string): ToolDefinition { ... }

// defs/minha-tool.ts — subsistemas sem contexto dinâmico (jobs, cron, etc.)
export function create(): ToolDefinition { ... }
```

## Loader (tool-defs.ts)

```typescript
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const defsDir = join(dirname(fileURLToPath(import.meta.url)), "defs");

// top-level await — carrega uma vez na inicialização do módulo
const toolModules = await Promise.all(
  readdirSync(defsDir)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.startsWith("_"))
    .map((f) => import(pathToFileURL(join(defsDir, f)).href))
);

export function createXyzTools(...): ToolDefinition[] {
  // monta tools a partir de toolModules
}
```

- Funciona em dev (`tsx` → `.ts`) e prod (`tsc` → `.js`) sem configuração extra
- Arquivos prefixados com `_` são ignorados (utilitários)
- `createXyzTools()` permanece síncrona para os callers

## Para adicionar uma nova tool

Criar o arquivo em `defs/`. Não editar `tool-defs.ts`.

## Status de migração

| Subsistema | Status |
|---|---|
| `adapters/` | ✅ migrado |
| `channels/` | ✅ migrado |
| `cron/` | ✅ migrado |
| `jobs/` | ✅ migrado |
| `memory/` | ✅ migrado |
| `services/` | ✅ migrado |
| `skills/` | ✅ migrado |
| `tools/` | ✅ migrado |
