# AB Hub - Dashboard de Agentes

Painel centralizado com visao em tempo real de todos os agentes, status de heartbeat, metricas de uso e acoes rapidas.

---

## 1. Objetivo

- Exibir todos os agentes registrados com status ao vivo (SSE)
- Mostrar indicadores de heartbeat, ultima atividade e custo
- Permitir acoes rapidas: ativar/desativar, trigger heartbeat
- Resolver D-001 (caixa preta), G-003 (visao unificada), D-005 (fragmentacao), D-012 (multi-agente sem visao de conjunto)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Retorno |
|--------|------|---------|
| GET | `/agents` | `Agent[]` |
| GET | `/agents/:id` | `Agent` |
| GET | `/agents/:id/heartbeat` | heartbeat config |
| GET | `/agents/:id/heartbeat/stats` | `HeartbeatStats` |
| POST | `/agents/:id/heartbeat/toggle` | toggle enabled |
| POST | `/agents/:id/heartbeat/trigger` | trigger manual |

SSE: evento `heartbeat:status` com `{ agentId, status, preview }` em tempo real.

---

## 3. Telas

### 3.1 Lista de Agentes (`/agents`)

**Layout:** Grid responsivo de cards (1 col mobile, 2 col tablet, 3 col desktop).

**AgentCard** — cada card exibe:

| Campo | Fonte | Visual |
|-------|-------|--------|
| Nome (slug) | `agent.slug` | Titulo do card |
| Owner | `agent.owner` | Badge sutil |
| Status | `agent.enabled` | Badge verde/cinza |
| Heartbeat | SSE `heartbeat:status` | Icone pulsante (ativo) ou estatico (inativo) |
| Ultima atividade | `heartbeat/stats` → ultimo timestamp | Texto relativo ("ha 5 min") |
| Custo total | `heartbeat/stats.totalCostUsd` | Valor formatado (R$ ou USD) |

**Acoes no card:**
- Toggle enabled/disabled (switch inline)
- Clicar no card → navega para `/agents/:id`

**Barra de acoes da pagina:**
- Busca por nome
- Filtro: todos / ativos / inativos
- Botao "Novo Agente" → navega para form de criacao (spec S-003)

### 3.2 Detalhe do Agente (`/agents/:id`)

**Layout:** Tabs horizontais.

| Tab | Conteudo |
|-----|----------|
| Visao Geral | Card resumo + metricas de heartbeat + timeline de atividade |
| Configuracao | Formularios de AGENT.md, SOUL.md, etc. (spec S-003) |
| Conversas | Lista de sessoes do agente (spec S-004) |
| Memoria | Status e busca semantica (spec S-006) |
| Agenda | Cron jobs do agente (spec S-007) |

**Tab Visao Geral:**

- **Card Resumo:** id, owner, delivery, enabled, heartbeat interval
- **Metricas Heartbeat** (cards numeros):
  - Total execucoes | Por status (ok/skipped/error) | Custo total | Duracao media
- **Timeline de Atividade:** ultimos 20 heartbeats via `GET /agents/:id/heartbeat/history`
  - Cada entrada: timestamp, status (badge cor), duracao, preview (truncado)
- **Acoes:**
  - Toggle heartbeat (switch)
  - Trigger manual (botao)
  - Botao "Nova Conversa" → cria sessao e navega para chat

---

## 4. Componentes

### 4.1 AgentCard

**Localizacao:** `components/agents/agent-card.tsx`

```typescript
interface AgentCardProps {
  agent: Agent;
  stats?: HeartbeatStats;
  heartbeatLive?: { status: string; preview?: string };
  onToggle: (id: string, enabled: boolean) => void;
}
```

- Card do shadcn com hover sutil
- Switch no canto superior direito para enabled
- Indicador de heartbeat pulsa via CSS animation quando ativo

### 4.2 HeartbeatTimeline

**Localizacao:** `components/agents/heartbeat-timeline.tsx`

```typescript
interface HeartbeatTimelineProps {
  entries: HeartbeatLogEntry[];
  loading?: boolean;
}
```

- Lista vertical com icone de status, timestamp relativo, preview
- Scroll interno com virtualizacao se > 50 entries

### 4.3 AgentMetrics

**Localizacao:** `components/agents/agent-metrics.tsx`

```typescript
interface AgentMetricsProps {
  stats: HeartbeatStats;
}
```

- Grid de 4 cards numericos (shadcn Card)
- Formatacao: numeros com separador de milhar, custo com 4 decimais

---

## 5. SSE Integration

| Evento SSE | Acao no Hub |
|------------|-------------|
| `heartbeat:status` | Atualiza heartbeatLive no card do agente correspondente. Invalida query `["agents", agentId, "stats"]` |
| `registry:adapters` | Invalida query `["agents"]` (pode ter novo agente) |

---

## 6. Criterios de Aceite

- [ ] Pagina `/agents` lista todos os agentes registrados no backbone
- [ ] Cards mostram status enabled/disabled com badge colorido
- [ ] Heartbeat ativo pulsa visualmente no card em tempo real (SSE)
- [ ] Toggle enabled/disabled atualiza backbone e UI sem reload
- [ ] Busca filtra agentes por nome em tempo real
- [ ] Filtro ativo/inativo funciona
- [ ] Click no card navega para `/agents/:id`
- [ ] Tab Visao Geral exibe metricas e timeline de heartbeat
- [ ] Trigger manual de heartbeat funciona e resultado aparece na timeline
- [ ] Layout responsivo: 1/2/3 colunas conforme breakpoint

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| Lista de Agentes | D-001, G-003, D-005, D-012 |
| Heartbeat Live | D-001 (visibilidade), G-002 (produtividade) |
| Metricas | G-003 (controle centralizado), G-008 (auditabilidade) |
| Toggle | D-004 (governanca), D-011 (active hours) |
