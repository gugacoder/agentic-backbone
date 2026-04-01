# S-079 — Limpeza e Integracao Final

Deletar `styles.css`, atualizar package.json, remover import no Hub, e validar zero cor hardcoded.

**Resolve:** D-003 (remover styles.css + export), D-012 (validacao zero cor hardcoded)
**Score de prioridade:** 9
**Dependencia:** S-074, S-075, S-076, S-077, S-078 (todos os componentes ja reescritos)
**PRP:** 16 — ai-chat: Reescrever com shadcn/ui (zero cor customizada)

---

## 1. Objetivo

- Deletar `src/styles.css` (2345 linhas) — nenhum CSS proprio no pacote
- Remover export `"./styles.css"` do `package.json` (ja feito em S-073, validar)
- Remover import `@agentic-backbone/ai-chat/styles.css` no Hub (`main.tsx`)
- Validar que nenhum arquivo `.tsx` contem cor hardcoded
- Atualizar CHANGELOG.md

---

## 2. Alteracoes

### 2.1 Deletar: `apps/packages/ai-chat/src/styles.css`

Arquivo inteiro (2345 linhas) deletado. Contem:
- 77 CSS variables `--ai-chat-*` com valores HSL hardcoded
- Classes BEM `.ai-chat-*` para todos os 29 componentes
- Bloco `.dark` com tema escuro proprio
- 3 animacoes (`ai-chat-blink`, `ai-chat-spin`, `ai-chat-fade-in`)

Tudo substituido por componentes shadcn + tokens Tailwind nas specs S-074 a S-078.

### 2.2 Validar: `apps/packages/ai-chat/package.json`

O export `"./styles.css"` deve ter sido removido em S-073. Validar que o campo `exports` contem apenas:
```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

### 2.3 Atualizar: Hub — `apps/hub/src/main.tsx` (ou arquivo que importa o CSS)

**Remover** a linha:
```tsx
import "@agentic-backbone/ai-chat/styles.css";
```

Nenhuma outra alteracao no Hub. O `<Chat />` continua funcionando com as mesmas props — agora herda o tema shadcn automaticamente.

### 2.4 Validar: Remover imports de `styles.css` em qualquer arquivo do pacote

Buscar e remover qualquer:
```tsx
import "./styles.css";
import "../styles.css";
```

### 2.5 Validacao: Zero cor hardcoded

Executar grep nos arquivos `.tsx` do pacote:
```bash
grep -rn "hsl\|oklch\|rgb(" apps/packages/ai-chat/src/ --include="*.tsx"
grep -rn "#[0-9a-fA-F]\{3,8\}" apps/packages/ai-chat/src/ --include="*.tsx"
```

Os unicos resultados permitidos sao:
- Nenhum resultado (ideal)
- `var(--chart-1)` etc. no ChartRenderer (CSS variables do host, nao cores hardcoded)
- `var(--border)` etc. no ChartRenderer (CSS variables do host)

Se qualquer `hsl()`, `oklch()`, `#hex`, `rgb()` literal for encontrado, deve ser substituido pelo token shadcn equivalente.

### 2.6 Atualizar: `CHANGELOG.md` (NOVO ou MODIFICAR)

Adicionar entrada:
```markdown
## 0.2.0 — Reescrita shadcn/ui

- Reescrita completa da camada visual com componentes shadcn/ui
- Eliminado styles.css (2345 linhas) — zero CSS proprio
- Zero cor hardcoded — herda 100% do tema shadcn do host
- Removido export ./styles.css (breaking para quem importava)
- Adicionado deps: @radix-ui/react-collapsible, dialog, scroll-area, separator, class-variance-authority, tailwind-merge
- API publica (ChatProps, hooks, exports) inalterada
```

### 2.7 Validacao: Build

```bash
npm run build
```

O build deve completar sem erros. Nenhum import de `styles.css` deve causar falha.

---

## 3. Regras de Implementacao

- **Esta spec so deve ser executada APOS todas as specs de componentes (S-074 a S-078)**
- **Deletar `styles.css` e so seguro quando nenhum componente o referencia**
- **A validacao de cor hardcoded eh obrigatoria** — nao pular
- **O Hub nao precisa de nenhuma alteracao alem de remover o import de CSS**

---

## 4. Criterios de Aceite

- [ ] `src/styles.css` deletado — nenhum arquivo `.css` no pacote
- [ ] Export `"./styles.css"` ausente do `package.json`
- [ ] Nenhum import de `styles.css` em nenhum arquivo do pacote
- [ ] Import `@agentic-backbone/ai-chat/styles.css` removido do Hub
- [ ] Grep por `hsl(`, `oklch(`, `rgb(`, `#hex` retorna zero resultados em `.tsx` (exceto `var()`)
- [ ] `npm run build` completa sem erro
- [ ] CHANGELOG.md atualizado com entrada 0.2.0
