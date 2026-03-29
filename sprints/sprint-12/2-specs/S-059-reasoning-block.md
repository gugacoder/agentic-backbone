# S-059 — ReasoningBlock

Componente colapsável que renderiza o raciocínio intermediário do agente (`part.type === "reasoning"`).

**Resolve:** AC-005 (ReasoningBlock.tsx ausente)
**Score de prioridade:** 9
**Dependência:** S-056 (scaffold)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `ReasoningBlock.tsx` — bloco colapsável que mostra o raciocínio do agente
- Ícone Brain (lucide-react) no header com label "Raciocínio"
- Expandido durante streaming, auto-colapsa quando `part.reasoning` para de receber deltas
- Agrupa deltas consecutivos de reasoning numa única seção
- Conteúdo renderizado como texto simples (não markdown — reasoning é texto interno)

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/parts/ReasoningBlock.tsx` (NOVO)

```typescript
import { Brain, ChevronDown } from "lucide-react";

export interface ReasoningBlockProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}
```

Comportamento:
- **Estado:** `expanded` — `true` enquanto `isStreaming`, transiciona para `false` quando streaming para
- **Header:** clicável, com ícone Brain + "Raciocínio" + chevron de toggle
- **Body:** texto com scroll vertical se ultrapassar `max-height` (CSS variable `--ai-chat-reasoning-max-height`, default `200px`)
- **Estilo:** borda lateral esquerda em cor sutil (`.ai-chat-reasoning`), background ligeiramente diferenciado

### 2.2 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `ReasoningBlock`.

---

## 3. Regras de Implementação

- **Não usar markdown** — reasoning é texto interno do modelo, não formatado
- **Auto-colapso** controlado por `useEffect` que observa transição de `isStreaming: true → false`
- **CSS classes** com namespace `.ai-chat-reasoning-*`

---

## 4. Critérios de Aceite

- [ ] `ReasoningBlock` renderiza texto de reasoning com ícone Brain
- [ ] Bloco é expandido durante streaming e auto-colapsa após
- [ ] Header é clicável para toggle manual
- [ ] Scroll vertical quando conteúdo excede max-height
- [ ] Estilizado com classes `.ai-chat-reasoning-*`
- [ ] Export no `index.ts`
