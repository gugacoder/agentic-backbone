# AB Hub - Configuracoes de LLM

Interface visual para gerenciar planos LLM, trocar modelo ativo e ajustar configuracoes de provedor sem editar arquivos.

---

## 1. Objetivo

- Visualizar planos LLM disponiveis com modelos, roles e custos estimados
- Trocar o plano ativo (economico, padrao, otimizado) com um clique
- Visualizar e editar configuracoes de web search
- Resolver D-021 (config manual de LLM), G-020 (selector de plano pela interface)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/settings/llm` | Retorna config completa: `active` + `plans` |
| PATCH | `/settings/llm` | Atualiza plano ativo: `{ active: "economico" }` |
| GET | `/settings/web-search` | Retorna config de web search: `{ provider }` |
| PATCH | `/settings/web-search` | Atualiza provedor: `{ provider: "duckduckgo" }` |
| GET | `/system/info` | Info do sistema (versao, node, platform) |
| GET | `/system/env` | Status das env vars (presenca, nao valores) |

**Nao requer endpoints novos.** Backend ja expoe tudo necessario.

---

## 3. Modelo de Dados

### 3.1 LlmConfig (ja existente no backend)

```typescript
interface LlmConfig {
  active: string;                    // slug do plano ativo
  plans: Record<string, LlmPlan>;   // planos disponiveis
}

interface LlmPlan {
  label: string;                     // "Economico", "Padrao", "Otimizado"
  description: string;               // descricao do plano
  profiles: Record<string, LlmProfile>; // roles: conversation, heartbeat, memory
  effort?: "low" | "medium" | "high" | "max";
  thinking?: { type: "adaptive" } | { type: "enabled"; budgetTokens: number } | { type: "disabled" };
}

interface LlmProfile {
  model: string;                     // ex: "google/gemini-2.0-flash-001"
}
```

---

## 4. Telas

### 4.1 Pagina de Configuracoes (`/settings`)

A rota `/settings` ja existe. Expandir para conter duas secoes:

**Sub-rotas (tabs):**

| Tab | Rota | Conteudo |
|-----|------|----------|
| LLM | `/settings` ou `/settings/llm` | Planos LLM e modelo ativo |
| Web Search | `/settings/web-search` | Provedor de busca |
| Sistema | `/settings/system` | Info do sistema e env vars |

### 4.2 Tab LLM — Selector de Plano

**Layout:** Cards lado a lado (desktop), empilhados (mobile).

Cada card de plano:

| Elemento | Descricao |
|----------|-----------|
| Titulo | `plan.label` (ex: "Economico") |
| Descricao | `plan.description` |
| Badge | "Ativo" se `plan === config.active` |
| Modelos | Lista de roles com modelo: "Conversa: gemini-2.0-flash", "Heartbeat: gemini-2.0-flash" |
| Effort | Badge com nivel: "low", "medium", "high" |
| Thinking | Indicador: "Adaptativo", "Habilitado (8K tokens)", "Desabilitado" |
| Botao | "Ativar este plano" (desabilitado se ja ativo) |

**Acao "Ativar":**
1. `PATCH /settings/llm` com `{ active: planSlug }`
2. Toast de sucesso: "Plano alterado para Economico"
3. Invalidar query `["settings", "llm"]`

### 4.3 Tab Web Search

**Formulario simples:**

| Campo | Tipo | Opcoes |
|-------|------|--------|
| Provedor | Select | DuckDuckGo, Brave, Nenhum |

- Save automatico ao mudar selecao
- Toast de confirmacao

### 4.4 Tab Sistema

**Cards informativos (somente leitura):**

| Card | Dados |
|------|-------|
| Versao | `system.version` |
| Node.js | `system.nodeVersion` |
| Plataforma | `system.platform` |
| API Keys | Status (presente/ausente): OpenRouter, OpenAI |
| Diretorio de Contexto | `system.contextDir` |

---

## 5. Componentes

### 5.1 LlmPlanCard

**Localizacao:** `components/settings/llm-plan-card.tsx`

```typescript
interface LlmPlanCardProps {
  slug: string;
  plan: LlmPlan;
  isActive: boolean;
  onActivate: (slug: string) => void;
  isLoading?: boolean;
}
```

- shadcn Card com borda destacada quando ativo
- Botao primario "Ativar" ou badge "Ativo"

### 5.2 WebSearchSettings

**Localizacao:** `components/settings/web-search-settings.tsx`

### 5.3 SystemInfo

**Localizacao:** `components/settings/system-info.tsx`

### 5.4 API Module

**Localizacao:** `api/settings.ts` (ja existe, expandir)

```typescript
export const llmSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ["settings", "llm"],
    queryFn: () => request<LlmConfig>("/settings/llm"),
  });

export const webSearchSettingsQueryOptions = () =>
  queryOptions({
    queryKey: ["settings", "web-search"],
    queryFn: () => request<{ provider: string }>("/settings/web-search"),
  });

export const systemInfoQueryOptions = () =>
  queryOptions({
    queryKey: ["system", "info"],
    queryFn: () => request<SystemInfo>("/system/info"),
  });
```

---

## 6. Criterios de Aceite

- [ ] Pagina `/settings` exibe planos LLM como cards
- [ ] Plano ativo tem indicacao visual (badge + borda)
- [ ] Clicar "Ativar" troca o plano ativo no backend
- [ ] Toast confirma troca de plano
- [ ] Cada card mostra modelos por role (conversa, heartbeat, memoria)
- [ ] Tab Web Search permite trocar provedor de busca
- [ ] Tab Sistema mostra info do sistema e status de API keys
- [ ] Navegacao por tabs preserva estado na URL
- [ ] Layout responsivo: cards lado a lado (desktop), empilhados (mobile)
- [ ] Apenas sysuser pode acessar (auth guard)

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| LlmPlanCard + Selector | D-021 (config manual), G-020 (selector pela interface) |
| SystemInfo | G-003 (visao unificada do sistema) |
| WebSearchSettings | G-007 (independencia tecnica) |
