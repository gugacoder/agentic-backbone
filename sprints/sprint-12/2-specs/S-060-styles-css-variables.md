# S-060 — styles.css com CSS Variables

Criar stylesheet base do pacote com CSS variables no namespace `.ai-chat`, compatível com shadcn tokens.

**Resolve:** AC-004 (styles.css com CSS variables ausente)
**Score de prioridade:** 7
**Dependência:** S-056 (scaffold)
**PRP:** 15 — ai-chat: Pacote React de Chat Rico

---

## 1. Objetivo

- Criar `styles.css` com CSS variables sob o seletor `.ai-chat` (ou `:root` com prefixo `--ai-chat-`)
- Definir tokens de cor, tipografia, espaçamento e animação usados por todos os componentes
- Garantir compatibilidade com shadcn: mapear variáveis para `hsl(var(--...))` quando possível
- Incluir estilos base para markdown, reasoning, tool activity, streaming cursor e display renderers
- Consumidor pode sobrescrever variáveis sem fork

---

## 2. Alterações

### 2.1 Arquivo: `apps/packages/ai-chat/src/styles.css` (NOVO)

#### CSS Variables (tokens)

```css
.ai-chat {
  /* Cores */
  --ai-chat-bg: hsl(0 0% 100%);
  --ai-chat-fg: hsl(0 0% 9%);
  --ai-chat-muted: hsl(0 0% 96%);
  --ai-chat-muted-fg: hsl(0 0% 45%);
  --ai-chat-border: hsl(0 0% 90%);
  --ai-chat-accent: hsl(221 83% 53%);
  --ai-chat-accent-fg: hsl(0 0% 100%);
  --ai-chat-destructive: hsl(0 84% 60%);
  --ai-chat-success: hsl(142 71% 45%);
  --ai-chat-warning: hsl(38 92% 50%);

  /* Tipografia */
  --ai-chat-font-family: inherit;
  --ai-chat-font-size: 0.875rem;
  --ai-chat-line-height: 1.5;
  --ai-chat-code-font: ui-monospace, monospace;

  /* Espaçamento */
  --ai-chat-radius: 0.5rem;
  --ai-chat-gap: 0.75rem;
  --ai-chat-padding: 1rem;

  /* Reasoning */
  --ai-chat-reasoning-max-height: 200px;
  --ai-chat-reasoning-border: hsl(221 83% 53% / 0.3);

  /* Bubble */
  --ai-chat-bubble-user-bg: hsl(221 83% 53%);
  --ai-chat-bubble-user-fg: hsl(0 0% 100%);
  --ai-chat-bubble-assistant-bg: hsl(0 0% 96%);
  --ai-chat-bubble-assistant-fg: hsl(0 0% 9%);
}
```

#### Dark mode

```css
.ai-chat.dark, .dark .ai-chat {
  --ai-chat-bg: hsl(0 0% 9%);
  --ai-chat-fg: hsl(0 0% 96%);
  --ai-chat-muted: hsl(0 0% 15%);
  --ai-chat-muted-fg: hsl(0 0% 60%);
  --ai-chat-border: hsl(0 0% 20%);
  /* ... demais overrides */
}
```

#### Animações

```css
@keyframes ai-chat-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.ai-chat-cursor::after {
  content: "▊";
  animation: ai-chat-blink 1s step-end infinite;
}
```

#### Estilos de componentes

Classes base para: `.ai-chat-markdown`, `.ai-chat-code-block`, `.ai-chat-inline-code`, `.ai-chat-reasoning`, `.ai-chat-tool-activity`, `.ai-chat-bubble`, `.ai-chat-input`, `.ai-chat-display-*`.

---

## 3. Regras de Implementação

- **Todas as cores via CSS variables** — nenhuma cor hardcoded nos componentes
- **Namespace `.ai-chat`** obrigatório em todas as classes
- **Compatível com shadcn** — usar formato `hsl(...)` e nomes alinhados
- **Dark mode via classe** `.dark` no pai ou no próprio `.ai-chat`
- **Não incluir Tailwind** — este arquivo é CSS puro

---

## 4. Critérios de Aceite

- [ ] Arquivo `src/styles.css` existe com CSS variables documentadas
- [ ] Tokens cobrem: cores, tipografia, espaçamento, reasoning, bubbles
- [ ] Dark mode funciona via classe `.dark`
- [ ] Animação do cursor de streaming está definida
- [ ] Nenhuma cor hardcoded nos componentes (validar grep por `#` e `rgb` em `.tsx`)
- [ ] Export em `package.json` via `"./styles.css": "./src/styles.css"`
