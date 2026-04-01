# PRP-09 — Configuracoes de LLM e Sistema

Interface visual para gerenciar planos LLM, trocar modelo ativo, ajustar web search e visualizar info do sistema sem editar arquivos.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem pagina `/settings` como placeholder. O backbone expoe:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/settings/llm` | Config completa: `active` + `plans` |
| PATCH | `/settings/llm` | Atualiza plano ativo: `{ active: "economico" }` |
| GET | `/settings/web-search` | Config de web search: `{ provider }` |
| PATCH | `/settings/web-search` | Atualiza provedor |
| GET | `/system/info` | Info do sistema (versao, node, platform) |
| GET | `/system/env` | Status das env vars (presenca, nao valores) |

### Estado desejado

1. Pagina `/settings` com tabs: LLM, Web Search, Sistema
2. Tab LLM: cards de planos com botao "Ativar"
3. Tab Web Search: selector de provedor
4. Tab Sistema: info somente leitura (versao, node, API keys status)
5. Tabs controladas por URL (sub-rotas)

## Especificacao

### Feature F-035: Tab LLM com selector de plano

**Reestruturar `/settings`** com sub-rotas via TanStack Router:

| Tab | Rota | Conteudo |
|-----|------|----------|
| LLM | `/settings` ou `/settings/llm` | Planos LLM e modelo ativo |
| Web Search | `/settings/web-search` | Provedor de busca |
| Usuarios | `/settings/users` | Gestao de usuarios (PRP-10) — placeholder |
| Sistema | `/settings/system` | Info do sistema |

**components/settings/llm-plan-card.tsx — LlmPlanCard:**

```typescript
interface LlmPlanCardProps {
  slug: string;
  plan: LlmPlan;
  isActive: boolean;
  onActivate: (slug: string) => void;
  isLoading?: boolean;
}
```

Cada card de plano mostra:

| Elemento | Descricao |
|----------|-----------|
| Titulo | `plan.label` (ex: "Economico") |
| Descricao | `plan.description` |
| Badge | "Ativo" se `plan === config.active` |
| Modelos | Lista de roles com modelo: "Conversa: gemini-2.0-flash" |
| Effort | Badge com nivel: "low", "medium", "high" |
| Thinking | Indicador: "Adaptativo", "Habilitado (8K tokens)", "Desabilitado" |
| Botao | "Ativar este plano" (desabilitado se ja ativo) |

- shadcn Card com borda destacada quando ativo
- Acao "Ativar": `PATCH /settings/llm` com `{ active: planSlug }`, toast de sucesso, invalida `["settings", "llm"]`
- Cards lado a lado (desktop), empilhados (mobile)

**API module — expandir `api/settings.ts`:**

```typescript
export const llmSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ["settings", "llm"],
    queryFn: () => request<LlmConfig>("/settings/llm"),
  });
```

### Feature F-036: Tab Web Search

**components/settings/web-search-settings.tsx:**

- Select com opcoes: DuckDuckGo, Brave, Nenhum
- Save automatico ao mudar selecao via `PATCH /settings/web-search`
- Toast de confirmacao
- Fetch via `webSearchSettingsQueryOptions()`

### Feature F-037: Tab Sistema (info + env vars)

**components/settings/system-info.tsx:**

Cards informativos (somente leitura):

| Card | Dados |
|------|-------|
| Versao | `system.version` |
| Node.js | `system.nodeVersion` |
| Plataforma | `system.platform` |
| API Keys | Status (presente/ausente): OpenRouter, OpenAI |
| Diretorio de Contexto | `system.contextDir` |

- Fetch via `systemInfoQueryOptions()` e `systemEnvQueryOptions()`
- Nao exibe valores de chaves — apenas presenca/ausencia

## Limites

- **NAO** implementar edicao de modelos individuais por role — apenas troca de plano completo.
- **NAO** implementar criacao de planos customizados — apenas selecao dos existentes.
- **NAO** criar APIs novas no backbone — todas existem.
- **NAO** implementar conteudo da tab Usuarios — placeholder para PRP-10.

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.

## Validacao

- [ ] Pagina `/settings` exibe planos LLM como cards
- [ ] Plano ativo tem indicacao visual (badge + borda)
- [ ] Clicar "Ativar" troca o plano ativo no backend
- [ ] Toast confirma troca de plano
- [ ] Cada card mostra modelos por role (conversa, heartbeat, memoria)
- [ ] Tab Web Search permite trocar provedor de busca
- [ ] Tab Sistema mostra info do sistema e status de API keys
- [ ] Navegacao por tabs preserva estado na URL (sub-rotas)
- [ ] Layout responsivo: cards lado a lado (desktop), empilhados (mobile)
- [ ] Apenas sysuser pode acessar (auth guard)
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-035 LLM selector | S-009 sec 4.2 | D-021, G-020 |
| F-036 Web Search | S-009 sec 4.3 | G-007 |
| F-037 Sistema info | S-009 sec 4.4 | G-003 |
