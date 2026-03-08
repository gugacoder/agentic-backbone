# PRP-44 — Fleet Management Dashboard

Página de gestão de frota de agentes com visão consolidada de status, saúde, consumo e alertas. Operações em lote (enable/disable/kill/trigger heartbeat) e atualização em tempo real via SSE.

## Execution Mode

`implementar`

## Contexto

### Estado atual

A listagem de agentes (`/agents`) exibe informações básicas por agente (nome, owner, enabled). Não há visão consolidada da frota com métricas de saúde, consumo e alertas. Operações em lote não existem — cada agente precisa ser gerenciado individualmente. Não há eventos SSE específicos para atualização de status da frota.

### Estado desejado

1. API endpoints `/fleet`, `/fleet/batch`, `/fleet/summary` agregando dados de AgentRegistry, heartbeat_log, circuit_breaker_events e custos
2. Eventos SSE `fleet:agent_status` e `fleet:alert` para atualização em tempo real
3. Página `/fleet` no Hub com grid denso (desktop) e cards (mobile), filtros, ordenação e operações em lote

## Especificacao

### Feature F-154: API endpoints fleet

**Novos endpoints (não requer tabelas novas — agrega dados existentes):**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/fleet` | Visão consolidada de todos os agentes com métricas |
| POST | `/fleet/batch` | Operação em lote sobre múltiplos agentes |
| GET | `/fleet/summary` | Resumo numérico da frota (cards do topo) |

**GET `/fleet` — Query params:** `owner`, `status` (active/paused/error/killed), `sortBy` (tokens/errors/lastActivity/name), `sortDir` (asc/desc)

**Response:**

```json
{
  "agents": [
    {
      "id": "system.atendimento",
      "label": "Atendimento ao Cliente",
      "owner": "system",
      "enabled": true,
      "status": "active",
      "circuitBreaker": { "killSwitch": false, "tripped": false },
      "health": {
        "heartbeatSuccessRate24h": 0.95,
        "lastHeartbeat": "2026-03-08T14:30:00Z",
        "lastHeartbeatResult": "ok",
        "consecutiveFails": 0
      },
      "consumption": { "tokensToday": 45230, "tokensBudget": 100000, "costToday": 0.45 },
      "activity": { "conversationsToday": 12, "cronRunsToday": 3, "lastActivity": "2026-03-08T14:32:00Z" },
      "alerts": [],
      "channels": ["whatsapp", "web"]
    }
  ],
  "total": 24,
  "filtered": 24
}
```

**POST `/fleet/batch` — Request:**

```json
{
  "agentIds": ["system.atendimento", "system.vendas"],
  "action": "disable"
}
```

Ações suportadas: `enable`, `disable`, `trigger_heartbeat`, `activate_kill_switch`, `deactivate_kill_switch`.

**GET `/fleet/summary` — Response:**

```json
{
  "totalAgents": 24,
  "activeAgents": 18,
  "pausedAgents": 4,
  "errorAgents": 2,
  "killedAgents": 0,
  "totalTokensToday": 523400,
  "totalCostToday": 5.23,
  "avgHealthRate": 0.92,
  "activeAlerts": 3
}
```

### Feature F-155: Eventos SSE fleet

Novos eventos no canal `/system/events`:

| Evento | Payload |
|--------|---------|
| `fleet:agent_status` | `{ agentId, status, health, consumption }` — emitido a cada heartbeat ou mudança de estado |
| `fleet:alert` | `{ agentId, alertType, message }` — emitido ao detectar problema |

Eventos emitidos apenas em mudanças reais (heartbeat completo, enable/disable, circuit-breaker trip). Atualizações incrementais — o cliente SSE não precisa fazer polling.

### Feature F-156: Hub — página /fleet

**Header:**

- 4 cards de resumo: Total de Agentes, Ativos, Com Problemas, Custo Hoje
- Barra de filtros: dropdown Owner, dropdown Status, campo de busca por nome
- Botões de ordenação: Nome, Consumo, Erros, Última Atividade

**Grid de agentes (desktop):**

- Tabela densa: Checkbox, Nome, Owner, Status (badge colorido), Saúde (% com cor), Tokens Hoje, Custo, Último Heartbeat (relative time), Alertas (count badge), Ações (dropdown)
- Seleção via checkbox para operações em lote
- Barra de ações em lote: aparece ao selecionar ≥1 agente → Enable, Disable, Kill, Trigger Heartbeat

**Cards (mobile):**

- Card por agente: nome, status badge, saúde (mini barra), tokens hoje, último heartbeat
- Swipe para ações rápidas: enable/disable

**Status badges:**

| Status | Cor | Condição |
|--------|-----|----------|
| Ativo | Verde | enabled, sem trip, heartbeat OK |
| Pausado | Cinza | disabled |
| Alerta | Amarelo | Circuit-breaker tripped |
| Parado | Vermelho | Kill-switch ativo |
| Erro | Laranja | 3+ heartbeats falharam |

**Atualização em tempo real via SSE:** conecta ao `/system/events`. Ao receber `fleet:agent_status`: atualiza linha/card. Ao receber `fleet:alert`: toast + badge. Ao receber `circuit_breaker:*`: atualiza status imediatamente.

## Limites

- **NÃO** implementar histórico de métricas por agente (apenas snapshot atual)
- **NÃO** implementar gráficos de tendência na fleet view (apenas cards numéricos)
- **NÃO** implementar export da lista de agentes

## Dependencias

- **PRP-42** (Kill-switch + Circuit-breaker) deve estar implementado — fleet view agrega dados de circuit-breaker e suporta operações kill/resume em lote
- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestão de Agentes) deve estar implementado
- Dashboard de custos (Sprint 3, S-013) deve estar implementado — dados de consumo

## Validacao

- [ ] Página `/fleet` lista todos os agentes com métricas consolidadas
- [ ] Cards de resumo exibem totais corretos (total, ativos, problemas, custo)
- [ ] Filtros por owner e status funcionam e são combináveis
- [ ] Ordenação por tokens, erros, última atividade e nome funciona
- [ ] Seleção de múltiplos agentes habilita barra de ações em lote
- [ ] Operação em lote executa para todos os selecionados com feedback individual
- [ ] Status atualiza em tempo real via SSE sem refresh
- [ ] Alertas de circuit-breaker aparecem instantaneamente na fleet view
- [ ] Layout responsivo: tabela densa no desktop, cards empilhados no mobile
- [ ] Busca por nome filtra agentes em tempo real (client-side)
- [ ] `npm run build` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-154 API endpoints fleet | S-043 sec 2 | D-064, G-064 |
| F-155 Eventos SSE fleet | S-043 sec 3 | G-064 |
| F-156 Hub página /fleet | S-043 sec 4 | D-064, G-064 |
