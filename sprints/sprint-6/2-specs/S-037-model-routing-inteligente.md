# S-037 — Model Routing Inteligente

Roteamento automático de LLM por complexidade de tarefa: tasks simples (heartbeats curtos, respostas FAQ) usam modelos econômicos; tasks complexas usam modelos avançados. Redução potencial de 60-80% nos custos.

**Resolve:** D-056 (sem otimização de custo LLM), G-056 (model routing inteligente)
**Score de prioridade:** 8

---

## 1. Objetivo

- Estender o sistema de planos LLM existente (`context/system/llm.json`) com regras de roteamento por complexidade de task
- Cada agente pode definir regras de routing específicas em seu `AGENT.md` (frontmatter)
- Heurísticas de complexidade: tamanho do prompt, modo de operação, tags de task, número de tools disponíveis
- Dashboard mostra economia gerada pelo routing: custo com routing vs. custo sem routing
- Zero quebra de API: `resolveModel(role)` mantém a assinatura, passa a aceitar contexto de routing opcionalmente

---

## 2. Sem Schema DB Adicional

Regras de routing armazenadas em frontmatter de `AGENT.md` e em `context/system/llm.json`. Histórico de routing registrado nos logs existentes de heartbeat_log com nova coluna.

### 2.1 Migração: `heartbeat_log` e `cron_run_log`

```sql
ALTER TABLE heartbeat_log ADD COLUMN model_used TEXT;
ALTER TABLE heartbeat_log ADD COLUMN routing_rule TEXT;   -- qual regra selecionou o modelo
ALTER TABLE cron_run_log ADD COLUMN model_used TEXT;
ALTER TABLE cron_run_log ADD COLUMN routing_rule TEXT;
```

---

## 3. Formato de Configuração

### 3.1 Plano LLM com routing (`context/system/llm.json`)

```json
{
  "active_plan": "padrao",
  "plans": {
    "padrao": {
      "conversation": "openai/gpt-4o",
      "heartbeat": "anthropic/claude-haiku-4-5",
      "memory": "anthropic/claude-haiku-4-5"
    },
    "economico": {
      "conversation": "google/gemini-flash-1.5",
      "heartbeat": "google/gemini-flash-1.5",
      "memory": "google/gemini-flash-1.5"
    }
  },
  "routing": {
    "enabled": true,
    "rules": [
      {
        "id": "simple-heartbeat",
        "description": "Heartbeats curtos usam modelo econômico",
        "conditions": {
          "mode": "heartbeat",
          "prompt_tokens_lte": 800
        },
        "model": "anthropic/claude-haiku-4-5",
        "priority": 10
      },
      {
        "id": "complex-conversation",
        "description": "Conversas com muitas tools usam modelo avançado",
        "conditions": {
          "mode": "conversation",
          "tools_count_gte": 5
        },
        "model": "openai/gpt-4o",
        "priority": 20
      },
      {
        "id": "cron-default",
        "description": "Cron jobs usam modelo econômico por padrão",
        "conditions": {
          "mode": "cron"
        },
        "model": "google/gemini-flash-1.5",
        "priority": 5
      }
    ]
  }
}
```

### 3.2 Override por agente (frontmatter `AGENT.md`)

```yaml
---
label: "Agente de Suporte"
routing:
  rules:
    - id: "suporte-simples"
      description: "Perguntas FAQ usam modelo rápido"
      conditions:
        mode: "conversation"
        prompt_tokens_lte: 500
        tags_any: ["faq", "greeting"]
      model: "anthropic/claude-haiku-4-5"
      priority: 100   # override tem prioridade máxima
---
```

### 3.3 Condições de Routing disponíveis

| Condição | Tipo | Descrição |
|----------|------|-----------|
| `mode` | string | `heartbeat`, `conversation`, `cron`, `webhook` |
| `prompt_tokens_lte` | integer | Estimativa de tokens do prompt ≤ N |
| `prompt_tokens_gte` | integer | Estimativa de tokens do prompt ≥ N |
| `tools_count_gte` | integer | Número de tools disponíveis ≥ N |
| `tools_count_lte` | integer | Número de tools disponíveis ≤ N |
| `tags_any` | string[] | Qualquer uma das tags presentes no contexto do agente |
| `channel_type` | string | `hub`, `whatsapp`, `slack`, `teams`, `email` |

---

## 4. Implementação

### 4.1 `src/settings/llm.ts` — Extensão de `resolveModel()`

```typescript
export interface RoutingContext {
  mode: 'heartbeat' | 'conversation' | 'cron' | 'webhook'
  estimatedPromptTokens?: number
  toolsCount?: number
  channelType?: string
  tags?: string[]
}

// Nova assinatura (compatível com uso existente)
export function resolveModel(
  role: 'conversation' | 'heartbeat' | 'memory',
  context?: RoutingContext,
  agentRoutingRules?: RoutingRule[]
): string

// Lógica:
// 1. Combina regras globais (system/llm.json) + regras do agente
// 2. Ordena por prioridade (maior primeiro)
// 3. Retorna model da primeira regra cujas condições são satisfeitas
// 4. Fallback: plan[role] padrão
```

### 4.2 Estimativa de tokens

Função `estimateTokens(text: string): number` usando heurística simples (chars / 4) sem dependência de biblioteca externa. Suficientemente precisa para decisões de routing (±20% aceitável).

### 4.3 Propagação do modelo usado

`runAgent()` recebe o modelo resolvido e registra `model_used` + `routing_rule` nos logs de execução.

---

## 5. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/settings/routing` | Obter configuração global de routing |
| PUT | `/settings/routing` | Atualizar regras globais de routing |
| GET | `/agents/:id/routing-stats` | Estatísticas de routing do agente (distribuição de modelos, economia) |
| POST | `/settings/routing/simulate` | Simular qual modelo seria selecionado para um contexto |

### 5.1 GET `/agents/:id/routing-stats`

**Query params:** `from`, `to`

**Response:**
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
  "ruleHits": {
    "simple-heartbeat": 180,
    "complex-conversation": 80,
    "fallback": 80
  }
}
```

### 5.2 POST `/settings/routing/simulate`

**Request:**
```json
{
  "agentId": "system.main",
  "mode": "heartbeat",
  "estimatedPromptTokens": 600,
  "toolsCount": 2
}
```

**Response:**
```json
{
  "selectedModel": "anthropic/claude-haiku-4-5",
  "matchedRule": "simple-heartbeat",
  "fallback": false
}
```

---

## 6. Telas (Hub)

### 6.1 `/settings` — Seção "Model Routing"

- Toggle "Habilitar routing automático"
- Lista de regras globais com: nome, condições resumidas, modelo selecionado, prioridade
- Botão "Adicionar regra" → modal com editor de condições (form visual)
- Botão "Simular" → abre painel de simulação com formulário de contexto e resultado

### 6.2 `/agents/:id/settings` — Seção "Routing"

- Toggle "Override de regras globais"
- Lista de regras específicas do agente (mesma UI das regras globais)
- Botão "Simular para este agente"

### 6.3 `/agents/:id/analytics` — Aba "Model Routing"

- Gauge: "Economia estimada este mês — R$ X / USD Y"
- Gráfico de pizza: distribuição de execuções por modelo
- Gráfico de barras: regras mais acionadas
- Tabela de simulação: últimas 20 execuções com modelo selecionado e regra aplicada

---

## 7. Critérios de Aceite

- [ ] `resolveModel()` com `RoutingContext` retorna modelo correto baseado nas regras configuradas
- [ ] Regra com maior prioridade vence em caso de múltiplas condições satisfeitas
- [ ] Sem regras configuradas: comportamento identico ao anterior (fallback para plan[role])
- [ ] `heartbeat_log.model_used` registra o modelo efetivamente usado em cada execução
- [ ] `GET /agents/:id/routing-stats` retorna distribuição correta de modelos e economia estimada
- [ ] `POST /settings/routing/simulate` retorna modelo e regra para contexto fornecido
- [ ] Editor visual de regras no Hub permite criar/editar/remover regras sem editar JSON
- [ ] Gauge de economia exibe diferença estimada USD/BRL entre uso com e sem routing
- [ ] Override de agente (frontmatter) tem prioridade maior que regras globais
- [ ] Estimativa de tokens funciona sem dependências externas
