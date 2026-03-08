# PRP-36 — Feedback Loop com Rating de Usuário

Rating in-chat de respostas do agente (thumbs up/down + motivo opcional) com dashboard de qualidade percebida. Fecha o ciclo entre LLM-as-judge interno e sinal humano real.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha mecanismo de rating de respostas por usuarios. O sistema possui LLM-as-judge (eval runs) mas nenhum canal de feedback humano direto. Nao existe tabela de ratings nem API para submetê-los.

### Estado desejado

1. Tabela `message_ratings` no SQLite para persistir ratings de usuarios
2. API REST para submeter e consultar ratings por agente
3. Botoes 👍/👎 no chat Hub abaixo de cada mensagem do agente
4. Dashboard `/agents/:id/ratings` com taxa de aprovacao, breakdown por categoria e tendencia
5. Dashboard global `/ratings` comparando todos os agentes
6. Export de golden sets a partir de mensagens baixo-avaliadas

## Especificacao

### Feature F-127: Tabela message_ratings + API de Rating

**Nova tabela em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS message_ratings (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  message_index INTEGER NOT NULL,
  agent_id      TEXT NOT NULL,
  channel_type  TEXT NOT NULL,
  rating        TEXT NOT NULL,       -- 'up' | 'down'
  reason        TEXT,
  reason_cat    TEXT,                -- 'wrong_info' | 'off_topic' | 'too_long' | 'rude' | 'other'
  user_ref      TEXT,
  rated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ratings_agent ON message_ratings(agent_id);
CREATE INDEX idx_ratings_session ON message_ratings(session_id);
CREATE INDEX idx_ratings_rating ON message_ratings(rating);
CREATE INDEX idx_ratings_rated_at ON message_ratings(rated_at);
```

Adicionar migracao no startup do backbone.

**Endpoints:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/conversations/:sessionId/messages/:index/rate` | Submeter rating (upsert) |
| GET | `/agents/:agentId/ratings` | Listar ratings do agente (paginado) |
| GET | `/agents/:agentId/ratings/summary` | Taxa de aprovacao, breakdown e tendencia |
| POST | `/agents/:agentId/ratings/export-golden-set` | Exportar mensagens baixo-avaliadas como golden set |
| GET | `/ratings` | Dashboard global — todos os agentes |

**POST `/conversations/:sessionId/messages/:index/rate`:**

```json
// Request
{ "rating": "down", "reason": "Resposta incorreta", "reasonCategory": "wrong_info" }

// Response 201
{ "id": "rat_abc123", "sessionId": "sess_xyz", "messageIndex": 4, "rating": "down", "ratedAt": "..." }
```

Validacoes: `messageIndex` deve referenciar mensagem do agente (role: `assistant`). Rating duplicado para mesma mensagem: upsert por `session_id + message_index`.

**GET `/agents/:agentId/ratings/summary`:**

Query params: `from`, `to` (ISO date), `channelType`

```json
{
  "agentId": "system.main",
  "period": { "from": "2026-03-01", "to": "2026-03-07" },
  "total": 142,
  "approvalRate": 0.84,
  "upCount": 119,
  "downCount": 23,
  "byCategory": { "wrong_info": 8, "off_topic": 5, "too_long": 4, "rude": 2, "other": 4 },
  "byChannel": { "whatsapp": { "total": 90, "approvalRate": 0.87 } },
  "trend": [{ "date": "2026-03-01", "approvalRate": 0.81, "total": 18 }]
}
```

**POST `/agents/:agentId/ratings/export-golden-set`:**

```json
// Request
{ "rating": "down", "from": "2026-02-01T00:00:00Z", "to": "2026-03-07T23:59:59Z", "limit": 100 }

// Response 201
{
  "evalSetId": "golden-from-ratings-2026-03-07",
  "casesExported": 23,
  "path": "context/agents/system.main/evals/golden-from-ratings-2026-03-07/"
}
```

### Feature F-128: Hub — Botoes de Rating no Chat + Pagina /agents/:id/ratings

**Componente de chat — botoes 👍/👎:**

- Icones abaixo de cada mensagem do agente no componente de chat
- Ao clicar 👎: exibe dropdown com categorias (`wrong_info`, `off_topic`, `too_long`, `rude`, `other`) + campo de texto livre opcional
- Estado visual: icone preenchido apos rating; possibilidade de alterar

**Pagina `/agents/:id/ratings`:**

- Resumo no topo: taxa de aprovacao (gauge circular), total de ratings, periodo selecionavel
- Grafico de linha: aprovacao ao longo do tempo (ultimos 30 dias)
- Grafico de pizza: distribuicao de categorias de falha
- Tabela de ratings recentes: data, canal, rating (badge), motivo, link para a conversa
- Botao "Exportar como Golden Set" (chama export endpoint)
- Filtros: periodo, canal, rating (up/down/todos)

**Badge na pagina `/agents/:id`:**

- Badge na sidebar: "Taxa de aprovacao: 84%" com cor (verde ≥80%, amarelo 60-79%, vermelho <60%)
- Link "Ver ratings" para a pagina de ratings

### Feature F-129: Dashboard Global /ratings + Rating via Canais Externos

**Dashboard global `/ratings` (nova pagina no Hub):**

- Tabela comparativa de todos os agentes: taxa de aprovacao, total ratings, tendencia (seta cima/baixo)
- Destaque: agentes com aprovacao <70% nas ultimas 24h
- Filtro por canal, periodo

**Rating via WhatsApp (canal externo):**

- Apos cada resposta do agente: mensagem "Essa resposta foi util? Responda SIM ou NAO"
- Se NAO: "Pode nos dizer o motivo? (opcional)"
- Rating registrado associado a sessao e mensagem correspondente

**Nota:** Rating via Slack/Teams (Block Kit / Adaptive Card) e Email (links HMAC) podem ser implementados como extensao futura; esta feature entrega canal WhatsApp como prova de conceito de rating via canal externo.

## Limites

- **NAO** implementar rating de mensagens do usuario (apenas respostas do agente)
- **NAO** implementar integracoes Slack/Teams/Email nesta feature (somente WhatsApp como piloto)
- **NAO** exportar dados para servicos externos de analytics

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova pagina adicionada
- Sistema de sessoes e conversas deve estar funcionando
- WhatsApp connector (Sprint 5) deve estar implementado para rating via WhatsApp

## Validacao

- [ ] POST de rating com `rating: "up"` ou `"down"` persiste em `message_ratings`
- [ ] Rating duplicado para mesma mensagem atualiza o existente (sem duplicatas)
- [ ] `GET /agents/:agentId/ratings/summary` retorna taxa de aprovacao, breakdown por categoria e tendencia diaria
- [ ] Export de golden set cria diretorio no formato de eval sets existentes com casos corretos
- [ ] Chat Hub exibe botoes 👍/👎 abaixo de mensagens do agente com estado visual apos rating
- [ ] Canal WhatsApp envia pergunta de rating apos resposta e registra SIM/NAO como up/down
- [ ] Dashboard `/agents/:id/ratings` exibe graficos e tabela de ratings
- [ ] Badge de taxa de aprovacao aparece na pagina do agente
- [ ] Filtro por periodo retorna apenas ratings do intervalo solicitado
- [ ] Dashboard global `/ratings` lista todos os agentes com metricas comparativas
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-127 Tabela message_ratings + API | S-036 sec 2-3 | D-051, G-052 |
| F-128 Hub chat rating + /ratings | S-036 sec 4.1, 5.1-5.2 | G-052 |
| F-129 Dashboard global + WhatsApp | S-036 sec 4.2, 5.3 | D-051, G-052 |
