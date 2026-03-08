# S-043 — Fleet Management Dashboard

Página de gestão de frota de agentes com visão consolidada de status, saúde, consumo e alertas de todos os agentes do sistema. Operações em lote (enable/disable/restart) e atualização em tempo real via SSE.

**Resolve:** D-064 (gestão de frota em escala), G-064 (Fleet Management Dashboard)
**Score de prioridade:** 8
**Dependência:** Circuit-breaker (S-041), SSE system events existente

---

## 1. Objetivo

- Página `/fleet` com grid/tabela de todos os agentes do tenant/sistema
- Métricas por agente: status, saúde (% heartbeats OK), consumo (tokens), último heartbeat, alertas
- Operações em lote: selecionar múltiplos agentes → enable/disable/trigger heartbeat
- Filtros: por owner, status, saúde, canal ativo
- Ordenação: por consumo, erros, atividade, nome
- SSE em tempo real para atualização da frota (sem polling)
- Layout responsivo: cards compactos no mobile, grid denso no desktop

---

## 2. API Endpoints

Não requer tabelas novas — agrega dados de: AgentRegistry (in-memory), heartbeat_log (SQLite), circuit_breaker_events (S-041), custos por agente (existente).

### 2.1 Novos Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/fleet` | Visão consolidada de todos os agentes com métricas |
| POST | `/fleet/batch` | Operação em lote sobre múltiplos agentes |
| GET | `/fleet/summary` | Resumo numérico da frota (cards do topo) |

### 2.2 GET `/fleet`

**Query params:** `owner`, `status` (active/paused/error/killed), `sortBy` (tokens/errors/lastActivity/name), `sortDir` (asc/desc)

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
      "circuitBreaker": {
        "killSwitch": false,
        "tripped": false
      },
      "health": {
        "heartbeatSuccessRate24h": 0.95,
        "lastHeartbeat": "2026-03-08T14:30:00Z",
        "lastHeartbeatResult": "ok",
        "consecutiveFails": 0
      },
      "consumption": {
        "tokensToday": 45230,
        "tokensBudget": 100000,
        "costToday": 0.45
      },
      "activity": {
        "conversationsToday": 12,
        "cronRunsToday": 3,
        "lastActivity": "2026-03-08T14:32:00Z"
      },
      "alerts": [],
      "channels": ["whatsapp", "web"]
    }
  ],
  "total": 24,
  "filtered": 24
}
```

### 2.3 POST `/fleet/batch`

**Request:**
```json
{
  "agentIds": ["system.atendimento", "system.vendas", "user1.assistente"],
  "action": "disable"
}
```

**Ações suportadas:** `enable`, `disable`, `trigger_heartbeat`, `activate_kill_switch`, `deactivate_kill_switch`

**Response:**
```json
{
  "results": [
    { "agentId": "system.atendimento", "success": true },
    { "agentId": "system.vendas", "success": true },
    { "agentId": "user1.assistente", "success": false, "error": "Agent not found" }
  ]
}
```

### 2.4 GET `/fleet/summary`

**Response:**
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

---

## 3. Eventos SSE

Eventos adicionais no canal `/system/events`:

| Evento | Payload |
|--------|---------|
| `fleet:agent_status` | `{ agentId, status, health, consumption }` — emitido a cada heartbeat ou mudança de estado |
| `fleet:alert` | `{ agentId, alertType, message }` — emitido ao detectar problema |

Frequência: eventos de status emitidos a cada mudança real (heartbeat completo, enable/disable, circuit-breaker trip). Não emite em polling — o cliente SSE recebe atualizações incrementais.

---

## 4. Telas (Hub)

### 4.1 `/fleet` — Fleet Dashboard

**Header:**
- 4 cards de resumo: Total de Agentes, Ativos, Com Problemas, Custo Hoje
- Barra de filtros: dropdown Owner, dropdown Status, campo de busca por nome
- Botões de ordenação: Nome, Consumo, Erros, Última Atividade

**Grid de agentes (desktop):**
- Tabela densa com colunas: Checkbox, Nome, Owner, Status (badge colorido), Saúde (% com cor), Tokens Hoje, Custo, Último Heartbeat (relative time), Alertas (count badge), Ações (dropdown: enable/disable/kill/resume)
- Linhas com seleção via checkbox para operações em lote
- Barra de ações em lote: aparece ao selecionar ≥1 agente → botões Enable, Disable, Kill, Trigger Heartbeat

**Cards (mobile):**
- Card por agente: nome, status badge, saúde (mini barra), tokens hoje, último heartbeat
- Swipe para ações rápidas: enable/disable
- FAB (floating action button) para operações em lote quando selecionados

**Atualização em tempo real:**
- Conecta ao SSE `/system/events`
- Ao receber `fleet:agent_status`: atualiza linha/card do agente sem refresh
- Ao receber `fleet:alert`: exibe toast + atualiza badge de alertas
- Ao receber `circuit_breaker:tripped`/`circuit_breaker:kill_switch`: atualiza status imediatamente

### 4.2 Status Badges

| Status | Cor | Condição |
|--------|-----|----------|
| Ativo | Verde | `enabled: true`, sem trip, heartbeat OK |
| Pausado | Cinza | `enabled: false` |
| Alerta | Amarelo | Circuit-breaker tripped (automático) |
| Parado | Vermelho | Kill-switch ativo |
| Erro | Laranja | Últimos 3+ heartbeats falharam |

---

## 5. Critérios de Aceite

- [ ] Página `/fleet` lista todos os agentes do sistema com métricas consolidadas
- [ ] Cards de resumo exibem totais corretos (total, ativos, problemas, custo)
- [ ] Filtros por owner e status funcionam e são combináveis
- [ ] Ordenação por tokens, erros, última atividade e nome funciona
- [ ] Seleção de múltiplos agentes habilita barra de ações em lote
- [ ] Operação em lote (enable/disable/kill/trigger heartbeat) executa para todos os selecionados
- [ ] Status atualiza em tempo real via SSE sem refresh da página
- [ ] Alertas de circuit-breaker aparecem instantaneamente na fleet view
- [ ] Layout responsivo: tabela densa no desktop, cards empilhados no mobile
- [ ] Busca por nome filtra agentes em tempo real (client-side)
