# PRP-37 — Model Routing Inteligente

Roteamento automatico de LLM por complexidade de tarefa: tasks simples (heartbeats curtos, FAQ) usam modelos economicos; tasks complexas usam modelos avancados. Reducao potencial de 60-80% nos custos de LLM.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O sistema usa um plano LLM fixo por role (`conversation`, `heartbeat`, `memory`) definido em `context/system/llm.json`. Nao ha diferenciacao de modelo por complexidade da task. Custos sao subotimos: heartbeats simples usam o mesmo modelo que conversas complexas.

### Estado desejado

1. Migracoes em `heartbeat_log` e `cron_run_log` para registrar modelo usado e regra de routing
2. `resolveModel()` estendido com `RoutingContext` — compativel com uso existente via parametros opcionais
3. API de routing com endpoints de estatisticas e simulacao
4. Hub com editor visual de regras e dashboard de economia estimada

## Especificacao

### Feature F-130: Migracao DB + resolveModel() com RoutingContext

**Migracoes em `apps/backbone/src/db/`:**

```sql
ALTER TABLE heartbeat_log ADD COLUMN model_used TEXT;
ALTER TABLE heartbeat_log ADD COLUMN routing_rule TEXT;
ALTER TABLE cron_run_log ADD COLUMN model_used TEXT;
ALTER TABLE cron_run_log ADD COLUMN routing_rule TEXT;
```

**Extensao de `src/settings/llm.ts`:**

```typescript
export interface RoutingContext {
  mode: 'heartbeat' | 'conversation' | 'cron' | 'webhook'
  estimatedPromptTokens?: number
  toolsCount?: number
  channelType?: string
  tags?: string[]
}

export interface RoutingRule {
  id: string
  description?: string
  conditions: {
    mode?: string
    prompt_tokens_lte?: number
    prompt_tokens_gte?: number
    tools_count_gte?: number
    tools_count_lte?: number
    tags_any?: string[]
    channel_type?: string
  }
  model: string
  priority: number
}

// Nova assinatura — compativel com chamadas existentes (context e agentRules opcionais)
export function resolveModel(
  role: 'conversation' | 'heartbeat' | 'memory',
  context?: RoutingContext,
  agentRoutingRules?: RoutingRule[]
): string
// Logica: combina regras globais (llm.json) + regras do agente, ordena por prioridade decrescente,
// retorna model da primeira regra cujas condicoes sao satisfeitas. Fallback: plan[role] padrao.
```

**Funcao auxiliar `estimateTokens(text: string): number`:**

Heuristica simples (chars / 4) sem dependencia externa. Precisao de ±20% e suficiente para decisoes de routing.

**Formato de configuracao em `context/system/llm.json`:**

```json
{
  "active_plan": "padrao",
  "plans": { ... },
  "routing": {
    "enabled": true,
    "rules": [
      {
        "id": "simple-heartbeat",
        "conditions": { "mode": "heartbeat", "prompt_tokens_lte": 800 },
        "model": "anthropic/claude-haiku-4-5",
        "priority": 10
      },
      {
        "id": "complex-conversation",
        "conditions": { "mode": "conversation", "tools_count_gte": 5 },
        "model": "openai/gpt-4o",
        "priority": 20
      },
      {
        "id": "cron-default",
        "conditions": { "mode": "cron" },
        "model": "google/gemini-flash-1.5",
        "priority": 5
      }
    ]
  }
}
```

**Override por agente (frontmatter `AGENT.md`):**

```yaml
routing:
  rules:
    - id: "suporte-simples"
      conditions:
        mode: "conversation"
        prompt_tokens_lte: 500
      model: "anthropic/claude-haiku-4-5"
      priority: 100
```

**Propagacao em `runAgent()`:** passa `RoutingContext` para `resolveModel()`, registra `model_used` e `routing_rule` nos logs de execucao.

### Feature F-131: API de Routing — Estatisticas e Simulacao

**Endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/settings/routing` | Obter configuracao global de routing |
| PUT | `/settings/routing` | Atualizar regras globais de routing |
| GET | `/agents/:id/routing-stats` | Distribuicao de modelos e economia estimada |
| POST | `/settings/routing/simulate` | Simular modelo selecionado para contexto dado |

**GET `/agents/:id/routing-stats`:**

Query params: `from`, `to`

```json
{
  "agentId": "system.main",
  "period": { "from": "2026-03-01", "to": "2026-03-07" },
  "totalExecutions": 340,
  "modelDistribution": {
    "anthropic/claude-haiku-4-5": { "count": 210, "pct": 0.62 },
    "openai/gpt-4o": { "count": 130, "pct": 0.38 }
  },
  "estimatedSavings": {
    "without_routing_usd": 4.82,
    "with_routing_usd": 1.94,
    "saved_usd": 2.88,
    "saved_pct": 0.60
  },
  "ruleHits": { "simple-heartbeat": 180, "complex-conversation": 80, "fallback": 80 }
}
```

**POST `/settings/routing/simulate`:**

```json
// Request
{ "agentId": "system.main", "mode": "heartbeat", "estimatedPromptTokens": 600, "toolsCount": 2 }

// Response
{ "selectedModel": "anthropic/claude-haiku-4-5", "matchedRule": "simple-heartbeat", "fallback": false }
```

### Feature F-132: Hub — Editor de Regras + Dashboard de Economia

**`/settings` — Secao "Model Routing":**

- Toggle "Habilitar routing automatico"
- Lista de regras globais com: nome, condicoes resumidas, modelo selecionado, prioridade
- Botao "Adicionar regra" → modal com editor de condicoes (form visual com campos condicionais por tipo)
- Botao "Simular" → painel de simulacao com formulario de contexto e resultado (modelo + regra aplicada)
- Sem editar JSON diretamente — tudo via UI

**`/agents/:id/settings` — Secao "Routing":**

- Toggle "Override de regras globais para este agente"
- Lista de regras especificas do agente (mesma UI das regras globais)
- Botao "Simular para este agente"

**`/agents/:id` — Aba "Analytics / Model Routing":**

- Gauge: "Economia estimada este mes — USD X"
- Grafico de pizza: distribuicao de execucoes por modelo
- Grafico de barras: regras mais acionadas
- Tabela: ultimas 20 execucoes com modelo selecionado e regra aplicada (via `heartbeat_log.routing_rule`)

## Limites

- **NAO** implementar precificacao em tempo real via API dos provedores (usar tabela de precos estatica)
- **NAO** implementar routing baseado em conteudo semantico (apenas heuristicas estruturais)
- **NAO** alterar a assinatura publica de `resolveModel()` de forma incompativel

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-09** (Heartbeat) deve estar implementado — `heartbeat_log` precisa existir
- **PRP-14** (Settings LLM) deve estar implementado — `llm.json` e `resolveModel()` existem

## Validacao

- [ ] `resolveModel()` com `RoutingContext` retorna modelo correto baseado nas regras configuradas
- [ ] Regra com maior prioridade vence em caso de multiplas condicoes satisfeitas
- [ ] Sem regras configuradas: comportamento identico ao anterior (fallback para plan[role])
- [ ] `heartbeat_log.model_used` registra o modelo efetivamente usado em cada execucao
- [ ] `GET /agents/:id/routing-stats` retorna distribuicao correta de modelos e economia estimada
- [ ] `POST /settings/routing/simulate` retorna modelo e regra para contexto fornecido
- [ ] Editor visual de regras no Hub permite criar/editar/remover regras sem editar JSON
- [ ] Gauge de economia exibe diferenca estimada USD entre uso com e sem routing
- [ ] Override de agente (frontmatter) tem prioridade maior que regras globais
- [ ] Estimativa de tokens funciona sem dependencias externas
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-130 DB migration + resolveModel() | S-037 sec 2-4 | D-056, G-056 |
| F-131 API routing stats + simulate | S-037 sec 5 | G-056 |
| F-132 Hub editor + dashboard | S-037 sec 6 | G-056 |
