# S-062 — ToolResult

Componente colapsável que exibe o resultado de tool calls funcionais com formatação JSON.

**Resolve:** AC-007 (ToolResult.tsx ausente)
**Score de prioridade:** 7
**Dependência:** S-056 (scaffold)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `ToolResult.tsx` — painel colapsável que mostra resultado de uma tool funcional
- Header com status (sucesso em verde, erro em vermelho) e nome da tool
- Body com JSON formatado (pretty-print) quando expandido
- Colapsado por padrão para não poluir a UI — usuário expande sob demanda
- Erros exibidos com destaque visual (borda vermelha, ícone AlertCircle)

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/parts/ToolResult.tsx` (NOVO)

```typescript
import { ChevronDown, CheckCircle, AlertCircle } from "lucide-react";

export interface ToolResultProps {
  toolName: string;
  result: unknown;
  isError?: boolean;
  className?: string;
}
```

Comportamento:
- **Header:** `[CheckCircle/AlertCircle] [toolName] [chevron toggle]` — clicável
- **Body:** `<pre>` com `JSON.stringify(result, null, 2)` e classe `.ai-chat-code-block`
- **Colapsado por padrão** — `expanded = false`
- **Erro:** header com cor `.ai-chat-destructive`, ícone AlertCircle
- **Sucesso:** header com cor `.ai-chat-success`, ícone CheckCircle
- **Max-height** no body com scroll quando JSON é grande

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `ToolResult`.

---

## 3. Regras de Implementação

- **JSON.stringify com try/catch** — result pode não ser serializável
- **Fallback para String(result)** quando não é JSON
- **CSS classes** `.ai-chat-tool-result-*`

---

## 4. Critérios de Aceite

- [ ] `ToolResult` renderiza resultado formatado como JSON
- [ ] Colapsado por padrão, expansível via click no header
- [ ] Header diferencia sucesso (verde) de erro (vermelho)
- [ ] Scroll vertical quando JSON é grande
- [ ] Trata gracefully resultados não-serializáveis
- [ ] Export no `index.ts`
