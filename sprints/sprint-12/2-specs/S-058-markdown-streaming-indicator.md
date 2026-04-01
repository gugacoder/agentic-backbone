# S-058 — Markdown + StreamingIndicator Portáveis

Criar componentes atômicos portáveis para renderização de markdown rico e indicador de streaming.

**Resolve:** AC-003 (Markdown.tsx + StreamingIndicator.tsx não são portáveis)
**Score de prioridade:** 8
**Dependência:** S-056 (scaffold deve existir)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `Markdown.tsx` — renderiza markdown com `react-markdown` + `remark-gfm` + `rehype-highlight`
- Criar `StreamingIndicator.tsx` — cursor piscante que indica que o agente ainda está gerando texto
- Ambos usam CSS variables (namespace `.ai-chat`) para estilização, sem dependência de Tailwind

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/components/Markdown.tsx` (NOVO)

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <ReactMarkdown
      className={clsx("ai-chat-markdown", className)}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
    >
      {content}
    </ReactMarkdown>
  );
}
```

Customizações de componentes (links abrem em nova aba, tabelas com overflow, code blocks com estilo):
- `a` → `target="_blank" rel="noopener noreferrer"`
- `table` → wrapper com overflow-x auto
- `pre` / `code` → classes `.ai-chat-code-block` e `.ai-chat-inline-code`

### 2.2 Arquivo: `apps/packages/ai-chat/src/components/StreamingIndicator.tsx` (NOVO)

Cursor piscante com animação CSS:

```typescript
export function StreamingIndicator({ className }: { className?: string }) {
  return <span className={clsx("ai-chat-cursor", className)} aria-label="Gerando resposta..." />;
}
```

Animação via CSS keyframes no `styles.css` (spec S-060).

### 2.3 Atualizar: `apps/packages/ai-chat/src/index.ts`

Exportar `Markdown` e `StreamingIndicator`.

---

## 3. Regras de Implementação

- **Sem Tailwind** — usar CSS classes com namespace `.ai-chat-*`
- **Plugins são fixos** — remark-gfm e rehype-highlight sempre ativos
- **Não recriar lógica existente** — usar react-markdown como está, apenas configurar

---

## 4. Critérios de Aceite

- [ ] `Markdown` renderiza GFM (tabelas, checkboxes, strikethrough) e syntax highlighting
- [ ] Links abrem em nova aba com `rel="noopener noreferrer"`
- [ ] `StreamingIndicator` exibe cursor piscante via CSS animation
- [ ] Ambos usam classes `.ai-chat-*` sem dependência de Tailwind
- [ ] Exports no `index.ts`
- [ ] Typecheck passa
