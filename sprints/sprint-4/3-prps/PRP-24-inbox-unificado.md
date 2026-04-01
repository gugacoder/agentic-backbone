# PRP-24 — Inbox Unificado Multi-Canal

Pagina `/inbox` com visao panoramica de todas as conversas ativas de todos os agentes e canais (WhatsApp, chat web, voz) em um so lugar, com filtros, metricas consolidadas e atualizacao em tempo real via SSE.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Operadores precisam navegar agente por agente, canal por canal, para ver conversas ativas. Nao ha visao consolidada multi-canal. As sessoes ja existem no SQLite e no filesystem (`messages.jsonl`). O evento SSE `channel:message` ja existe e eh emitido a cada nova mensagem.

### Estado desejado

1. Endpoints `GET /inbox` e `GET /inbox/metrics` agregando sessoes de todos os agentes e canais
2. Pagina `/inbox` no Hub como entrada principal para operadores
3. Cards de conversa com canal, status, preview e agente
4. Filtros por canal, agente e status (refletidos em URL)
5. Metricas consolidadas no topo (ativas, aguardando, tempo medio, canal mais ativo)
6. Atualizacao em tempo real via SSE (`channel:message`)
7. Badge no menu lateral com contador de conversas aguardando resposta

## Especificacao

### Feature F-095: Endpoints GET /inbox e /inbox/metrics

**Novos endpoints em `apps/backbone/src/routes/inbox.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/inbox` | Listar sessoes ativas de todos os agentes/canais |
| GET | `/inbox/metrics` | Metricas consolidadas por canal |

Montar rotas no `index.ts` do backbone.

**GET `/inbox` — Query params:**

| Param | Tipo | Descricao |
|-------|------|-----------|
| `channel` | string | Filtrar por tipo: `whatsapp`, `web`, `voice` |
| `agent_id` | string | Filtrar por agente |
| `status` | string | `agent`, `operator`, `waiting` |
| `limit` | number | Default 50 |
| `offset` | number | Default 0 |

`status` calculado em runtime por sessao:
- `operator` — sessao com `operatorId` ativo (de S-017/PRP-17)
- `waiting` — ultima mensagem e do usuario (`role: user`) ha mais de 5 minutos
- `agent` — padrao

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

**GET `/inbox/metrics` response:**

```json
{
  "totalActive": 24,
  "byChannel": [
    { "channel": "whatsapp", "count": 18, "avgResponseMs": 4200 },
    { "channel": "web", "count": 5, "avgResponseMs": 1800 },
    { "channel": "voice", "count": 1, "avgResponseMs": null }
  ],
  "byStatus": { "agent": 20, "operator": 2, "waiting": 2 },
  "volumeByHour": [
    { "hour": "2026-03-07T13:00:00Z", "count": 8 },
    { "hour": "2026-03-07T14:00:00Z", "count": 16 }
  ]
}
```

**Hub — `apps/hub/src/api/inbox.ts`:**

```typescript
export const inboxQueryOptions = (params: InboxParams) =>
  queryOptions({
    queryKey: ["inbox", params],
    queryFn: () => request<InboxResponse>(`/inbox?${new URLSearchParams(params as Record<string, string>)}`),
  });

export const inboxMetricsQueryOptions = () =>
  queryOptions({
    queryKey: ["inbox", "metrics"],
    queryFn: () => request<InboxMetrics>("/inbox/metrics"),
  });
```

### Feature F-096: Pagina /inbox com cards, filtros e metricas

**Nova rota** `routes/_authenticated/inbox/index.tsx`.

Item "Inbox" (icone: `Inbox`) no menu lateral — posicionado antes de "Agentes", como entrada principal para operadores. Badge com contador de sessoes `waiting` atualizado via SSE.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `InboxPage` | `routes/_authenticated/inbox/index.tsx` |
| `InboxMetricsCards` | `components/inbox/inbox-metrics-cards.tsx` |
| `InboxFilters` | `components/inbox/inbox-filters.tsx` |
| `InboxConversationList` | `components/inbox/inbox-conversation-list.tsx` |
| `InboxConversationCard` | `components/inbox/inbox-conversation-card.tsx` |
| `ChannelBadge` | `components/inbox/channel-badge.tsx` |

**InboxMetricsCards** — 4 cards no topo:

| Card | Valor |
|------|-------|
| Conversas Ativas | `totalActive` |
| Aguardando Resposta | `byStatus.waiting` — badge vermelho se > 0 |
| Tempo Medio de Resposta | Media das ultimas 1h |
| Canal Mais Ativo | Canal com maior `count` |

**InboxFilters** — filtros refletidos em query params (URL compartilhavel):
- Select "Canal": Todos / WhatsApp / Web / Voz
- Select "Agente": Todos / lista de agentes ativos
- Select "Status": Todos / Com Agente / Com Operador / Aguardando

Filtros em query params: `?channel=whatsapp&status=waiting&agent_id=system.main`

**InboxConversationCard** exibe:

| Campo | Descricao |
|-------|-----------|
| Horario | Timestamp da ultima mensagem (formato relativo: "2 min atras") |
| Agente | `agentLabel` |
| `ChannelBadge` | Badge colorido: WPP=verde, WEB=azul, VOZ=roxo |
| Status | Sem badge se `agent`; "Com Operador" (laranja) se `operator`; "Aguardando" (vermelho pulsante animado) se `waiting` |
| Preview | Primeiros 80 chars do `lastMessage.content` |
| Contador | `messageCount` |

Clicar no card navega para `/conversations/:sessionId`.

**Atualizacao em tempo real:** hook `useSSE` existente ao receber evento `channel:message` invalida queries `["inbox"]` e `["inbox", "metrics"]`.

**Layout desktop:** lista de cards full-width com metricas no topo e filtros horizontais.

**Layout mobile:** filtros como chips horizontais no topo scrollable; cards em largura total.

## Limites

- **NAO** implementar atribuicao de conversa a operador nesta tela (funcionalidade de PRP-17)
- **NAO** implementar busca por conteudo de mensagem (futuro)
- **NAO** implementar notificacoes sonoras para novas mensagens (futuro)
- **NAO** criar novas tabelas — inbox agrega dados ja existentes no SQLite e filesystem

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-04** (Chat de Conversas) deve estar implementado — cards navegam para `/conversations/:id`
- **PRP-05** (Canais WhatsApp) deve estar implementado — `channelType` usado na filtragem
- **PRP-17** (Takeover de Conversa) deve estar implementado — `operatorId` usado no status `operator`

## Validacao

- [ ] GET `/inbox` retorna sessoes ativas de todos os agentes e canais
- [ ] Filtros por canal, agente e status funcionais na API
- [ ] Status `waiting` calculado corretamente (ultima mensagem user > 5 min)
- [ ] Status `operator` calculado a partir de `operatorId` ativo
- [ ] GET `/inbox/metrics` retorna metricas consolidadas por canal e status
- [ ] Pagina `/inbox` listada no menu lateral antes de "Agentes"
- [ ] Badge no menu lateral exibe contador de sessoes `waiting`
- [ ] 4 cards de metricas exibem valores corretos
- [ ] Filtros refletidos em query params e restaurados no reload (URL compartilhavel)
- [ ] Cards de conversa exibem canal, status, preview e agente
- [ ] `ChannelBadge` exibe cor correta por tipo de canal
- [ ] Sessoes `waiting` com badge vermelho pulsante
- [ ] Clicar no card navega para a conversa existente
- [ ] Lista atualiza automaticamente ao receber evento SSE `channel:message`
- [ ] Layout responsivo: mobile com filtros horizontais, cards full-width
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-095 Endpoints /inbox e /inbox/metrics | S-024 sec 3 | D-040, G-041 |
| F-096 Pagina /inbox + cards + SSE | S-024 sec 4, 5 | D-040, G-041 |
