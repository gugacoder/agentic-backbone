# PRP-15B — Parts: Reasoning, ToolActivity e ToolResult

Criar os componentes React que renderizam parts tipados do stream: raciocinio do agente, atividade de tool calls em tempo real e resultados de tools funcionais.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O stream rico (PRP-13) emite parts com `type === "reasoning"` e `type === "tool-invocation"`, mas nenhum componente React os renderiza:

- Reasoning eh descartado silenciosamente — o usuario nao ve o raciocinio do agente
- Tool calls operam como caixa preta — sem visibilidade de qual tool esta executando
- Resultados de tools funcionais nao sao exibidos de forma inspecionavel

### Estado desejado

1. `ReasoningBlock` — bloco colapsavel com auto-expand durante streaming e auto-colapso apos
2. `ToolActivity` — card compacto com icone contextual e spinner durante execucao
3. `ToolResult` — painel colapsavel com JSON formatado e diferenciacao sucesso/erro

### Dependencias

- **PRP-15A** — scaffold, styles.css (CSS variables) e index.ts devem existir

## Especificacao

### Feature F-184: ReasoningBlock

**Spec:** S-059

Criar `apps/packages/ai-chat/src/parts/ReasoningBlock.tsx`:

```typescript
export interface ReasoningBlockProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}
```

Comportamento:
- **Header clicavel:** icone Brain (lucide-react) + "Raciocinio" + chevron de toggle
- **Estado `expanded`:** `true` enquanto `isStreaming`, transiciona para `false` quando streaming para
- **Auto-colapso** controlado por `useEffect` que observa transicao `isStreaming: true → false`
- **Body:** texto simples (NAO markdown) com scroll vertical se ultrapassar `--ai-chat-reasoning-max-height` (200px)
- **Estilo:** borda lateral esquerda sutil, background diferenciado (`.ai-chat-reasoning`)

#### Regras

- Nao usar markdown — reasoning eh texto interno do modelo
- CSS classes com namespace `.ai-chat-reasoning-*`

### Feature F-185: ToolActivity

**Spec:** S-061

Criar `apps/packages/ai-chat/src/parts/ToolActivity.tsx`:

```typescript
export interface ToolActivityProps {
  toolName: string;
  state: "call" | "partial-call" | "result";
  args?: Record<string, unknown>;
  className?: string;
}
```

Comportamento:
- **Layout:** `[icone da tool] [nome da tool] [spinner ou check]`
- **State call/partial-call:** spinner (Loader2 com rotate animation)
- **State result:** check verde (Check)
- **Nome:** formatado human-readable (snake_case → Title Case)
- **Args:** NAO exibidos (evitar poluicao visual) — ficam no ToolResult

Mapa de icones exportado como `defaultToolIconMap`:

| Tool | Icone |
|------|-------|
| WebSearch | Globe |
| Bash | Terminal |
| Read | FileText |
| Edit | Pencil |
| Write | FilePlus |
| Grep | Search |
| Glob | FolderSearch |
| WebFetch | Download |
| default | Wrench |

#### Regras

- `defaultToolIconMap` exportado e extensivel pelo consumidor
- CSS classes `.ai-chat-tool-activity-*`

### Feature F-186: ToolResult

**Spec:** S-062

Criar `apps/packages/ai-chat/src/parts/ToolResult.tsx`:

```typescript
export interface ToolResultProps {
  toolName: string;
  result: unknown;
  isError?: boolean;
  className?: string;
}
```

Comportamento:
- **Header:** `[CheckCircle/AlertCircle] [toolName] [chevron toggle]` — clicavel
- **Body:** `<pre>` com `JSON.stringify(result, null, 2)` e classe `.ai-chat-code-block`
- **Colapsado por padrao** — `expanded = false`
- **Erro:** header com cor `--ai-chat-destructive`, icone AlertCircle
- **Sucesso:** header com cor `--ai-chat-success`, icone CheckCircle
- **Max-height** no body com scroll quando JSON eh grande

#### Regras

- `JSON.stringify` com try/catch — result pode nao ser serializavel
- Fallback para `String(result)` quando nao eh JSON
- CSS classes `.ai-chat-tool-result-*`

## Limites

- **NAO** criar PartRenderer (switch central) — responsabilidade do PRP-15D
- **NAO** criar display renderers — responsabilidade do PRP-15C
- **NAO** renderizar args no ToolActivity — args ficam no ToolResult quando expandido
- **NAO** usar markdown no ReasoningBlock — reasoning eh texto interno

## Validacao

- [ ] `ReasoningBlock` renderiza texto de reasoning com icone Brain
- [ ] Bloco expandido durante streaming, auto-colapsa apos
- [ ] Header clicavel para toggle manual
- [ ] Scroll vertical quando conteudo excede max-height
- [ ] `ToolActivity` renderiza nome da tool com icone contextual
- [ ] Spinner durante `state === "call"`, check em `state === "result"`
- [ ] Mapa de icones cobre pelo menos 8 tools comuns
- [ ] `defaultToolIconMap` exportado e extensivel
- [ ] `ToolResult` renderiza resultado formatado como JSON
- [ ] Colapsado por padrao, expansivel via click
- [ ] Header diferencia sucesso (verde) de erro (vermelho)
- [ ] Trata gracefully resultados nao-serializaveis
- [ ] Todos os componentes usam CSS variables de `styles.css`
- [ ] Exports no `index.ts` do pacote
- [ ] Typecheck passa

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-184 ReasoningBlock | S-059 | AC-005 |
| F-185 ToolActivity | S-061 | AC-006 |
| F-186 ToolResult | S-062 | AC-007 |
