# S-061 — ToolActivity

Componente que mostra atividade de tool calls em tempo real durante execução do agente.

**Resolve:** AC-006 (ToolActivity.tsx ausente)
**Score de prioridade:** 8
**Dependência:** S-056 (scaffold)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `ToolActivity.tsx` — card compacto que exibe tool calls em andamento
- Spinner animado durante `state === "call"`, ícone de check quando `state === "result"`
- Mapa de ícones por nome de tool: WebSearch → Globe, Bash → Terminal, Read → FileText, Edit → Pencil, Write → FilePlus, Grep → Search, Glob → FolderSearch, etc.
- Fallback para ícone genérico (Wrench) quando tool não está no mapa

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/parts/ToolActivity.tsx` (NOVO)

```typescript
import { Loader2, Check, Globe, Terminal, FileText, Pencil, Search, Wrench, ... } from "lucide-react";

export interface ToolActivityProps {
  toolName: string;
  state: "call" | "partial-call" | "result";
  args?: Record<string, unknown>;
  className?: string;
}
```

Comportamento:
- **Layout:** linha horizontal — `[ícone da tool] [nome da tool] [spinner ou check]`
- **State call/partial-call:** spinner (Loader2 com rotate animation)
- **State result:** check verde (Check)
- **Nome da tool:** formatado human-readable (snake_case → Title Case)
- **Args:** não exibidos por padrão (evita poluição visual) — ficam em ToolResult

Mapa de ícones (pelo menos):

| Tool | Ícone |
|------|-------|
| `WebSearch` | Globe |
| `Bash` | Terminal |
| `Read` | FileText |
| `Edit` | Pencil |
| `Write` | FilePlus |
| `Grep` | Search |
| `Glob` | FolderSearch |
| `WebFetch` | Download |
| default | Wrench |

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `ToolActivity`.

---

## 3. Regras de Implementação

- **Mapa de ícones é extensível** — exportar `defaultToolIconMap` para que consumidor possa estender
- **Sem markdown** — nomes e labels são texto plano
- **CSS classes** `.ai-chat-tool-activity-*`

---

## 4. Critérios de Aceite

- [ ] `ToolActivity` renderiza nome da tool com ícone contextual
- [ ] Spinner durante `state === "call"`, check em `state === "result"`
- [ ] Mapa de ícones cobre pelo menos 8 tools comuns
- [ ] Fallback para ícone genérico quando tool não está no mapa
- [ ] `defaultToolIconMap` é exportado e extensível
- [ ] Export no `index.ts`
