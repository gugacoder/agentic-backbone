# PRP-16F — Limpeza e Integracao Final

Deletar `styles.css`, remover imports orfaos, atualizar Hub, validar zero cor hardcoded e atualizar CHANGELOG.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Apos PRP-16A a PRP-16E, todos os 29 componentes do `@agentic-backbone/ai-chat` foram reescritos para usar componentes shadcn internos e tokens Tailwind semanticos. Porem:

- `src/styles.css` (2345 linhas) ainda existe — contem 77 CSS variables `--ai-chat-*`, classes BEM `.ai-chat-*`, bloco `.dark` proprio, e 3 animacoes customizadas
- O Hub ainda importa `@agentic-backbone/ai-chat/styles.css` no `main.tsx`
- Pode haver imports orfaos de `styles.css` em componentes internos do pacote
- O export `"./styles.css"` do `package.json` pode ou nao ter sido removido em PRP-16A
- CHANGELOG.md nao documenta a reescrita

### Estado desejado

1. Zero arquivo `.css` no pacote
2. Zero import de `styles.css` em qualquer arquivo do pacote ou do Hub
3. Export `"./styles.css"` ausente do `package.json`
4. Zero cor hardcoded (`hsl()`, `oklch()`, `#hex`, `rgb()`) em arquivos `.tsx` do pacote
5. CHANGELOG.md atualizado com entrada 0.2.0
6. `npm run build` compila sem erro

### Dependencias

- **PRP-16A** — infraestrutura shadcn interna
- **PRP-16B** — core do chat reescrito
- **PRP-16C** — parts reescritos
- **PRP-16D** — display simples e medios reescritos
- **PRP-16E** — display complexos reescritos

**IMPORTANTE:** Este PRP so deve ser executado apos TODOS os PRPs anteriores do sprint-14 estarem concluidos. Deletar `styles.css` antes de todos os componentes serem reescritos causa erros visuais.

## Especificacao

### Feature F-231: Deletar styles.css

**Spec:** S-079

Deletar `apps/packages/ai-chat/src/styles.css` — o arquivo inteiro (2345 linhas).

Conteudo eliminado:
- 77 CSS variables `--ai-chat-*` com valores HSL hardcoded
- Classes BEM `.ai-chat-*` para todos os 29 componentes
- Bloco `.dark` com tema escuro proprio
- 3 animacoes (`ai-chat-blink`, `ai-chat-spin`, `ai-chat-fade-in`)

Tudo ja substituido por componentes shadcn + tokens Tailwind (PRP-16A a PRP-16E).

#### Regras

- Verificar que nenhum componente `.tsx` ainda importa `./styles.css` ou `../styles.css` antes de deletar
- Se algum import persistir, remove-lo antes de deletar o arquivo

### Feature F-232: Limpar imports orfaos e validar package.json

**Spec:** S-079

1. Buscar e remover qualquer import de `styles.css` em todos os arquivos `.tsx` do pacote:
```tsx
// Remover linhas como:
import "./styles.css";
import "../styles.css";
```

2. Validar que o campo `exports` do `package.json` nao contem `"./styles.css"`:
```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Se o export `"./styles.css"` ainda existir (deveria ter sido removido em PRP-16A), remove-lo.

3. Verificar que nenhum componente `src/ui/` eh exportado no `src/index.ts` (regra PRP-16A).

### Feature F-233: Atualizar Hub — remover import do stylesheet

**Spec:** S-079

No Hub, encontrar e remover o import do stylesheet em `apps/hub/src/main.tsx` (ou onde estiver):

```tsx
// REMOVER esta linha:
import "@agentic-backbone/ai-chat/styles.css";
```

Nenhuma outra alteracao no Hub. O `<Chat />` continua funcionando com as mesmas props — agora herda o tema shadcn automaticamente.

### Feature F-234: Validacao zero cor hardcoded

**Spec:** S-079

Executar grep nos arquivos `.tsx` do pacote para garantir zero cor hardcoded:

```bash
grep -rn "hsl\|oklch\|rgb(" apps/packages/ai-chat/src/ --include="*.tsx"
grep -rn "#[0-9a-fA-F]\{3,8\}" apps/packages/ai-chat/src/ --include="*.tsx"
```

Resultados **permitidos** (nao sao cores hardcoded):
- `var(--chart-1)` a `var(--chart-5)` no ChartRenderer (CSS variables do host)
- `var(--border)`, `var(--muted-foreground)` no ChartRenderer (CSS variables do host)

Resultados **proibidos** — qualquer `hsl()`, `oklch()`, `#hex`, `rgb()` literal deve ser substituido pelo token shadcn equivalente.

### Feature F-235: CHANGELOG e build

**Spec:** S-079

1. Criar ou atualizar `apps/packages/ai-chat/CHANGELOG.md`:

```markdown
## 0.2.0 — Reescrita shadcn/ui

- Reescrita completa da camada visual com componentes shadcn/ui
- Eliminado styles.css (2345 linhas) — zero CSS proprio
- Zero cor hardcoded — herda 100% do tema shadcn do host
- Removido export ./styles.css (breaking para quem importava)
- Adicionado deps: @radix-ui/react-collapsible, dialog, scroll-area, separator, class-variance-authority, tailwind-merge
- API publica (ChatProps, hooks, exports) inalterada
```

2. Executar build e validar sucesso:
```bash
npm run build
```

O build deve completar sem erros. Nenhum import de `styles.css` deve causar falha.

## Limites

- **NAO** alterar nenhum componente visual — todos ja foram reescritos (PRP-16A a PRP-16E)
- **NAO** alterar a API publica (`ChatProps`, `useBackboneChat`, exports)
- **NAO** alterar hooks ou logica — este PRP eh exclusivamente de limpeza
- **NAO** alterar schemas Zod no ai-sdk
- **NAO** executar `npm install` — deps ja foram declaradas em PRP-16A

## Validacao

- [ ] `src/styles.css` deletado — nenhum arquivo `.css` no pacote
- [ ] Zero import de `styles.css` em nenhum arquivo `.tsx` do pacote
- [ ] Export `"./styles.css"` ausente do `package.json`
- [ ] Import `@agentic-backbone/ai-chat/styles.css` removido do Hub
- [ ] Grep por `hsl(`, `oklch(`, `rgb(` retorna zero resultados em `.tsx` (exceto `var()`)
- [ ] Grep por `#hex` retorna zero resultados em `.tsx`
- [ ] Nenhum componente `src/ui/` exportado no `src/index.ts`
- [ ] `npm run build` completa sem erro
- [ ] CHANGELOG.md atualizado com entrada 0.2.0

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-231 Deletar styles.css | S-079 | D-003 |
| F-232 Limpar imports e validar package.json | S-079 | D-003 |
| F-233 Atualizar Hub | S-079 | D-003 |
| F-234 Validacao zero cor hardcoded | S-079 | D-012 |
| F-235 CHANGELOG e build | S-079 | D-003, D-012 |
