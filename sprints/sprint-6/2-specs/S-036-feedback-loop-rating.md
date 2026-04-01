# S-036 — Feedback Loop com Rating de Usuário

Rating in-chat de respostas do agente (thumbs up/down + motivo opcional) com dashboard de qualidade percebida. Fecha o ciclo: LLM-as-judge interno + sinal humano real.

**Resolve:** D-051 (ausência de feedback loop de qualidade com rating), G-052 (feedback loop + dashboard de melhoria)
**Score de prioridade:** 8

---

## 1. Objetivo

- Usuário final pode avaliar respostas do agente com thumbs up/down + motivo opcional
- Dashboard mostra taxa de aprovação por agente, histórico e distribuição de categorias de falha
- Mensagens baixo-avaliadas são exportáveis como golden sets para eval runs
- Integra com eval runs existentes (LLM-as-judge já implementado em sprint anterior)
- Disponível em todos os canais: chat Hub, WhatsApp, Slack, Teams, Email

---

## 2. Schema DB

### 2.1 Tabela `message_ratings`

```sql
CREATE TABLE IF NOT EXISTS message_ratings (
  id            TEXT PRIMARY KEY,          -- uuid v4
  session_id    TEXT NOT NULL,
  message_index INTEGER NOT NULL,          -- posição da mensagem na sessão (0-based)
  agent_id      TEXT NOT NULL,
  channel_type  TEXT NOT NULL,             -- hub | whatsapp | slack | teams | email | webhook
  rating        TEXT NOT NULL,             -- 'up' | 'down'
  reason        TEXT,                      -- motivo livre (opcional)
  reason_cat    TEXT,                      -- categoria: 'wrong_info' | 'off_topic' | 'too_long' | 'rude' | 'other'
  user_ref      TEXT,                      -- identificador do usuário (anônimo OK)
  rated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ratings_agent ON message_ratings(agent_id);
CREATE INDEX idx_ratings_session ON message_ratings(session_id);
CREATE INDEX idx_ratings_rating ON message_ratings(rating);
CREATE INDEX idx_ratings_rated_at ON message_ratings(rated_at);
```

---

## 3. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/conversations/:sessionId/messages/:index/rate` | Submeter rating de mensagem |
| GET | `/agents/:agentId/ratings` | Listar ratings do agente (paginado) |
| GET | `/agents/:agentId/ratings/summary` | Resumo: taxa aprovação, breakdown por categoria |
| POST | `/agents/:agentId/ratings/export-golden-set` | Exportar mensagens baixo-avaliadas como golden set |

### 3.1 POST `/conversations/:sessionId/messages/:index/rate`

**Request:**
```json
{
  "rating": "down",
  "reason": "A resposta estava incorreta sobre prazos de entrega",
  "reasonCategory": "wrong_info"
}
```

**Response 201:**
```json
{
  "id": "rat_abc123",
  "sessionId": "sess_xyz",
  "messageIndex": 4,
  "rating": "down",
  "ratedAt": "2026-03-07T15:30:00Z"
}
```

**Validações:**
- `messageIndex` deve referenciar mensagem do agente (role: `assistant`), não do usuário
- Rating duplicado para mesma mensagem: atualiza o rating existente (upsert por `session_id + message_index`)

### 3.2 GET `/agents/:agentId/ratings/summary`

**Query params:** `from`, `to` (ISO date), `channelType`

**Response:**
```json
{
  "agentId": "system.main",
  "period": { "from": "2026-03-01", "to": "2026-03-07" },
  "total": 142,
  "approvalRate": 0.84,
  "upCount": 119,
  "downCount": 23,
  "byCategory": {
    "wrong_info": 8,
    "off_topic": 5,
    "too_long": 4,
    "rude": 2,
    "other": 4
  },
  "byChannel": {
    "whatsapp": { "total": 90, "approvalRate": 0.87 },
    "hub": { "total": 52, "approvalRate": 0.79 }
  },
  "trend": [
    { "date": "2026-03-01", "approvalRate": 0.81, "total": 18 },
    { "date": "2026-03-02", "approvalRate": 0.85, "total": 22 }
  ]
}
```

### 3.3 POST `/agents/:agentId/ratings/export-golden-set`

**Request:**
```json
{
  "rating": "down",
  "from": "2026-02-01T00:00:00Z",
  "to": "2026-03-07T23:59:59Z",
  "limit": 100
}
```

**Response:** Cria novo eval set em `context/agents/{agentId}/evals/golden-from-ratings-{date}/` com as mensagens baixo-avaliadas no formato de golden set existente.

**Response 201:**
```json
{
  "evalSetId": "golden-from-ratings-2026-03-07",
  "casesExported": 23,
  "path": "context/agents/system.main/evals/golden-from-ratings-2026-03-07/"
}
```

---

## 4. Rating via Canais Externos

### 4.1 Chat Hub
- Ícones 👍/👎 abaixo de cada mensagem do agente no componente de chat
- Ao clicar 👎: exibe dropdown com categorias + campo de texto livre (opcional)
- Estado visual: ícone preenchido após rating, possibilidade de alterar

### 4.2 WhatsApp
- Após cada resposta do agente: "Essa resposta foi útil? Responda *SIM* ou *NÃO*"
- Se NÃO: "Pode nos dizer o motivo? (opcional)"
- Rating registrado associado à sessão e mensagem correspondente

### 4.3 Slack/Teams
- Mensagem do agente incluí botões interativos "👍 Útil" / "👎 Não útil"
- Slack: Block Kit com action buttons
- Teams: Adaptive Card com actions
- Botão acionado → chama endpoint de rating via webhook do connector

### 4.4 Email
- Rodapé do email de resposta: "Esta resposta foi útil? [Sim] [Não]" (links HTTP)
- Links com token assinado (HMAC) que submetem rating via GET request autenticado

---

## 5. Telas (Hub)

### 5.1 `/agents/:id/ratings`

- Resumo no topo: taxa de aprovação (gauge circular), total de ratings, período selecionável
- Gráfico de linha: aprovação ao longo do tempo (últimos 30 dias)
- Gráfico de pizza: distribuição de categorias de falha
- Tabela de ratings recentes: data, canal, rating (badge), motivo, link para a conversa
- Botão "Exportar como Golden Set" (chama export endpoint)
- Filtros: período, canal, rating (up/down/todos)

### 5.2 `/agents/:id` — Card de qualidade percebida

- Badge na sidebar do agente: "Taxa de aprovação: 84%" com cor (verde ≥80%, amarelo 60-79%, vermelho <60%)
- Link "Ver ratings" para a página de ratings

### 5.3 Dashboard global `/ratings` (novo)

- Tabela comparativa de todos os agentes: taxa de aprovação, total ratings, tendência (↑↓)
- Destaque: agentes com aprovação <70% nas últimas 24h
- Filtro por canal, período

---

## 6. Critérios de Aceite

- [ ] POST de rating com `rating: "up"` ou `"down"` persiste em `message_ratings`
- [ ] Rating duplicado para mesma mensagem atualiza o existente (sem duplicatas)
- [ ] `GET /agents/:agentId/ratings/summary` retorna taxa de aprovação, breakdown por categoria e tendência diária
- [ ] Export de golden set cria diretório no formato de eval sets existentes com casos corretos
- [ ] Chat Hub exibe botões 👍/👎 abaixo de mensagens do agente com estado visual após rating
- [ ] Canal WhatsApp envia pergunta de rating após resposta e registra SIM/NÃO como up/down
- [ ] Dashboard `/agents/:id/ratings` exibe gráficos e tabela de ratings
- [ ] Badge de taxa de aprovação aparece na página do agente
- [ ] Filtro por período retorna apenas ratings do intervalo solicitado
- [ ] Ratings de canais externos (WhatsApp, Slack) são associados corretamente à sessão e mensagem
