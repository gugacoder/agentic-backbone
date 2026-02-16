# Sistema de Planos de Consumo (LLM)

## Contexto

Os créditos da Claude Agent SDK estão sendo consumidos rapidamente porque o `query()` é chamado **sem especificar modelo** — o SDK usa o modelo padrão (Sonnet), mesmo para heartbeats simples. O objetivo é criar um sistema de **planos de consumo** que permita ao usuário escolher entre perfis econômico/padrão/otimizado, controlando modelo, effort e thinking por função. O plano **econômico** será o padrão.

Descoberta-chave: o SDK aceita `options.model`, `options.effort` e `options.thinking`.

Referência: padrão de `profiles` por função do `codr.studio/agiliza/backbone/config/llm.json`.

---

## Design: Arquivo Único `context/system/llm.json`

Inspirado no `llm.json` do Agiliza, tudo em **um único arquivo JSON** — configuração ativa + definições dos planos. Arquivo vive no filesystem, sobrevive perda de DB.

```json
{
  "active": "economico",
  "plans": {
    "economico": {
      "label": "Econômico",
      "description": "Haiku para tudo. Máxima economia de créditos.",
      "profiles": {
        "conversation": { "model": "claude-haiku-4-5-20251001" },
        "heartbeat":    { "model": "claude-haiku-4-5-20251001" },
        "memory":       { "model": "claude-haiku-4-5-20251001" }
      },
      "effort": "low",
      "thinking": { "type": "disabled" }
    },
    "padrao": {
      "label": "Padrão",
      "description": "Sonnet para conversas, Haiku para heartbeat e memória.",
      "profiles": {
        "conversation": { "model": "claude-sonnet-4-5-20250929" },
        "heartbeat":    { "model": "claude-haiku-4-5-20251001" },
        "memory":       { "model": "claude-haiku-4-5-20251001" }
      },
      "effort": "medium"
    },
    "otimizado": {
      "label": "Otimizado",
      "description": "Sonnet com thinking adaptativo para tudo.",
      "profiles": {
        "conversation": { "model": "claude-sonnet-4-5-20250929" },
        "heartbeat":    { "model": "claude-sonnet-4-5-20250929" },
        "memory":       { "model": "claude-sonnet-4-5-20250929" }
      },
      "effort": "high",
      "thinking": { "type": "adaptive" }
    }
  }
}
```

### Por que esse formato

- **`profiles` por função** — mesmo padrão do Agiliza. Cada função (`conversation`, `heartbeat`, `memory`) pode ter seu próprio modelo. Novas funções são adicionadas sem quebrar nada.
- **`active`** no JSON — a seleção persiste junto com as definições. Um único arquivo para ler/escrever.
- **Extensível** — cada profile pode ganhar campos futuros (ex: `maxTokens`) conforme necessidade. O `effort` e `thinking` ficam no nível do plano (aplicam-se a todas as funções).

---

## Arquitetura

### Fluxo de Resolução

```
llm.json → loadLlmConfig() → getActivePlan() → resolveModel(role)
                                                → resolveEffort()
                                                → resolveThinking()
                                                        ↓
                                               query({ options: { model, effort, thinking } })
```

### Módulos

| Módulo | Função |
|---|---|
| `src/settings/llm.ts` | Leitura/escrita do `llm.json`, resolução de modelo por role |
| `src/routes/settings.ts` | API REST: `GET/PATCH /settings/llm` |
| `src/agent/index.ts` | Usa `resolveModel(role)` ao chamar o SDK |

### Profiles (funções do sistema)

| Profile | Uso |
|---|---|
| `conversation` | Sessões de chat via `/conversations` |
| `heartbeat` | Ticks autônomos do heartbeat (30s) |
| `memory` | Flush de memória (extração de fatos) |

### API

| Método | Path | Descrição |
|---|---|---|
| `GET /settings/llm` | Retorna `llm.json` completo |
| `PATCH /settings/llm` | Atualiza plano ativo: `{ "active": "padrao" }` |

### Frontend

Card "Plano LLM" na System page com seleção visual dos 3 planos.
