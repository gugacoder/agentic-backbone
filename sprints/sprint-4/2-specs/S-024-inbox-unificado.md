# S-024 — Inbox Unificado Multi-Canal

Pagina `/inbox` com visao panoramica de todas as conversas ativas de todos os canais (WhatsApp, chat web, voz) em um so lugar, com filtros, metricas consolidadas e atualizacao em tempo real via SSE.

---

## 1. Objetivo

- Centralizar conversas de todos os canais numa unica tela sem precisar navegar por agente/canal separadamente
- Filtros por canal, agente, status (com agente, com operador, aguardando)
- Metricas consolidadas: conversas abertas, volume por canal, tempo medio de resposta
- Atualizacao em tempo real via SSE (evento `channel:message` ja existente)
- Resolver D-040 (canais fragmentados), G-041 (hub unificado de mensagens)

---

## 2. Sem Schema DB

As conversas ja existem no filesystem (`sessions.jsonl`, `messages.jsonl`) e no SQLite de sessoes. O inbox agrega dados ja existentes — sem novas tabelas.

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/inbox` | Listar todas as sessoes ativas de todos os agentes/canais |
| GET | `/inbox/metrics` | Metricas consolidadas multi-canal |

### 3.1 GET `/inbox` — Query Params

| Param | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `channel` | string | — | Filtrar por tipo de canal (`whatsapp`, `web`, `voice`) |
| `agent_id` | string | — | Filtrar por agente |
| `status` | string | — | `agent` (com agente), `operator` (operador ativo), `waiting` (sem resposta > 5min) |
| `limit` | number | 50 | Quantidade de sessoes |
| `offset` | number | 0 | Paginacao |

**Response:**

```json
{
  "sessions": [
    {
      "sessionId": "sess_abc",
      "agentId": "system.main",
      "agentLabel": "Assistente Principal",
      "channelType": "whatsapp",
      "channelId": "channel-wpp-01",
      "status": "agent",
      "lastMessage": {
        "role": "assistant",
        "content": "Claro! O prazo de entrega e de 3 dias uteis.",
        "timestamp": "2026-03-07T14:22:00Z"
      },
      "unreadCount": 0,
      "waitingSince": null,
      "operatorId": null,
      "startedAt": "2026-03-07T14:10:00Z",
      "messageCount": 12
    }
  ],
  "total": 24,
  "offset": 0,
  "limit": 50
}
```

`status` calculado em runtime:
- `operator` — se sessao tem `operatorId` ativo (takeover, de S-017)
- `waiting` — ultima mensagem eh do usuario e tem mais de 5 minutos sem resposta
- `agent` — caso padrao

### 3.2 GET `/inbox/metrics` — Response

```json
{
  "totalActive": 24,
  "byChannel": [
    { "channel": "whatsapp", "count": 18, "avgResponseMs": 4200 },
    { "channel": "web", "count": 5, "avgResponseMs": 1800 },
    { "channel": "voice", "count": 1, "avgResponseMs": null }
  ],
  "byStatus": {
    "agent": 20,
    "operator": 2,
    "waiting": 2
  },
  "volumeByHour": [
    { "hour": "2026-03-07T13:00:00Z", "count": 8 },
    { "hour": "2026-03-07T14:00:00Z", "count": 16 }
  ]
}
```

---

## 4. Telas

### 4.1 Inbox Unificado (`/inbox`)

Nova pagina no menu lateral (icone: `Inbox`), posicionada antes de "Agentes" — entrada principal do produto para operadores.

**Layout desktop:**

```
+---sidebar---+--------content-------------------------------+
| > Inbox (24)| Inbox                                        |
| ...         |                                              |
|             | [Canal: Todos▼] [Agente: Todos▼] [Status: Todos▼] |
|             |                                              |
|             | +-- Metricas ----+------------------+        |
|             | | Ativas: 24     | WhatsApp: 18     |        |
|             | | Aguardando: 2  | Web: 5, Voz: 1   |        |
|             | +----------------+------------------+        |
|             |                                              |
|             | 14:22  system.main  [WPP]                    |
|             | Claro! O prazo de entrega e de 3 dias...     |
|             |                                              |
|             | 14:18  system.main  [WEB]  AGUARDANDO        |
|             | Oi! Gostaria de saber sobre o produto...     |
|             |                                              |
+-------------+----------------------------------------------+
```

**Layout mobile:** Lista full-width com chips de canal como filtro horizontal no topo.

### 4.2 Cards de Conversa

Cada conversa na lista exibe:

| Campo | Descricao |
|-------|-----------|
| Horario | Timestamp da ultima mensagem |
| Agente | Nome do agente (`agentLabel`) |
| Canal | Badge colorido (WPP=verde, WEB=azul, VOZ=roxo) |
| Status | Badge: "Com Agente" (default, sem badge), "Com Operador" (laranja), "Aguardando" (vermelho pulsante) |
| Preview | Primeiros 80 chars da ultima mensagem |
| Contador | Numero de mensagens na sessao |

Clicar no card navega para a conversa existente (`/conversations/:sessionId`).

### 4.3 Metricas no Topo

4 cards de metrica:

| Card | Valor |
|------|-------|
| Conversas Ativas | Total |
| Aguardando Resposta | Conversas com `status: waiting` — badge vermelho se > 0 |
| Tempo Medio de Resposta | Calculado da ultima hora |
| Canal Mais Ativo | Canal com maior volume |

### 4.4 Atualizacao em Tempo Real

O hook `useSSE` existente ja recebe evento `channel:message`. Ao receber este evento, invalidar query `["inbox"]` para recarregar a lista.

Badge no menu lateral com contagem de conversas `waiting` — atualizado via SSE.

### 4.5 Filtros em URL

Filtros em query params para URLs compartilhaveis:
- `?channel=whatsapp&status=waiting` — mostra conversas WhatsApp aguardando

---

## 5. Componentes

| Componente | Localizacao |
|------------|-------------|
| `InboxPage` | `routes/_authenticated/inbox/index.tsx` |
| `InboxMetricsCards` | `components/inbox/inbox-metrics-cards.tsx` |
| `InboxConversationList` | `components/inbox/inbox-conversation-list.tsx` |
| `InboxConversationCard` | `components/inbox/inbox-conversation-card.tsx` |
| `InboxFilters` | `components/inbox/inbox-filters.tsx` |
| `ChannelBadge` | `components/inbox/channel-badge.tsx` |

**API module:** `api/inbox.ts`

```typescript
export const inboxQueryOptions = (params: InboxParams) =>
  queryOptions({
    queryKey: ["inbox", params],
    queryFn: () => request<InboxResponse>(`/inbox?${new URLSearchParams(params)}`),
  });

export const inboxMetricsQueryOptions = () =>
  queryOptions({
    queryKey: ["inbox", "metrics"],
    queryFn: () => request<InboxMetrics>("/inbox/metrics"),
  });
```

**SSE:** Evento `channel:message` invalida `["inbox"]` e `["inbox", "metrics"]`.

---

## 6. Criterios de Aceite

- [ ] Rota GET `/inbox` retorna sessoes ativas de todos os agentes e canais
- [ ] Filtros por canal, agente e status funcionais na API e refletidos em query params
- [ ] Rota GET `/inbox/metrics` retorna metricas consolidadas por canal
- [ ] Pagina `/inbox` listada no menu lateral com badge de conversas `waiting`
- [ ] Cards de conversa exibem canal, status, preview e agente
- [ ] Filtros em URL (compartilhaveis, restauram estado no reload)
- [ ] Clicar no card navega para a conversa existente
- [ ] Conversas `waiting` destacadas com badge vermelho pulsante
- [ ] Lista atualiza automaticamente ao receber evento SSE `channel:message`
- [ ] Metricas de canal (WhatsApp, Web, Voz) exibidas corretamente
- [ ] Responsivo: layout mobile com filtros horizontais

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| GET `/inbox` + lista unificada | D-040 (canais fragmentados) |
| Filtros por canal/agente/status | G-041 (filtros por canal) |
| Metricas consolidadas | G-041 (metricas consolidadas) |
| Badge de `waiting` + SSE | G-041 (SSE em tempo real) |
