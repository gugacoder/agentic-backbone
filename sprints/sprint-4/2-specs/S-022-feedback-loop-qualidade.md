# S-022 — Feedback Loop de Qualidade (Thumbs Up/Down + Dashboard)

Mecanismo de feedback por mensagem no chat: thumbs up/down com motivo opcional, dashboard de qualidade por agente e exportacao de mensagens mal-avaliadas para golden sets de avaliacao.

---

## 1. Objetivo

- Adicionar botoes de thumbs up/down em cada mensagem do agente na interface de conversa
- Armazenar avaliacoes no backend com motivo opcional
- Dashboard de qualidade por agente: % aprovacao, evolucao temporal, perguntas com maior taxa de reprovacao
- Exportar mensagens mal-avaliadas para golden sets (integrado com S-019)
- Resolver D-037 (sem feedback de usuarios sobre respostas), G-038 (feedback loop + dashboard de qualidade)

---

## 2. Schema DB

### 2.1 Tabela `message_feedback`

```sql
CREATE TABLE IF NOT EXISTS message_feedback (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  message_id   TEXT NOT NULL,    -- identificador unico da mensagem na sessao
  agent_id     TEXT NOT NULL,
  rating       TEXT NOT NULL,    -- 'up' ou 'down'
  reason       TEXT,             -- motivo opcional (enum ou texto livre)
  user_id      TEXT,             -- quem avaliou (nullable para usuarios anonimos)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, message_id)
);

CREATE INDEX idx_feedback_agent ON message_feedback(agent_id, created_at);
CREATE INDEX idx_feedback_session ON message_feedback(session_id);
```

O `message_id` é o campo `id` do evento de mensagem na sessao (gerado no `messages.jsonl`). Mensagens precisam ter ID unico — verificar e garantir que `messages.jsonl` persiste IDs por linha.

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/conversations/:sessionId/messages/:messageId/feedback` | Enviar feedback de mensagem |
| DELETE | `/conversations/:sessionId/messages/:messageId/feedback` | Remover feedback (desfazer) |
| GET | `/agents/:id/quality` | Dashboard de qualidade do agente |
| GET | `/agents/:id/quality/low-rated` | Listar mensagens mal-avaliadas |

### 3.1 POST `.../feedback` — Payload

```json
{
  "rating": "down",
  "reason": "resposta_incorreta"
}
```

`reason` enum sugerido (frontend exibe labels em pt-BR):

| Valor | Label |
|-------|-------|
| `resposta_incorreta` | Resposta incorreta |
| `sem_contexto` | Faltou contexto |
| `incompleta` | Resposta incompleta |
| `tom_inadequado` | Tom inadequado |
| `outro` | Outro |

### 3.2 GET `/agents/:id/quality` — Response

```json
{
  "agentId": "system.main",
  "period": { "from": "2026-02-07", "to": "2026-03-07" },
  "totalRatings": 120,
  "upCount": 98,
  "downCount": 22,
  "approvalRate": 0.817,
  "trend": [
    { "date": "2026-03-01", "up": 14, "down": 2, "approvalRate": 0.875 },
    { "date": "2026-03-02", "up": 16, "down": 4, "approvalRate": 0.800 }
  ],
  "topReasons": [
    { "reason": "resposta_incorreta", "count": 10 },
    { "reason": "incompleta", "count": 7 }
  ]
}
```

### 3.3 GET `/agents/:id/quality/low-rated` — Response

```json
{
  "items": [
    {
      "feedbackId": 45,
      "sessionId": "sess_abc",
      "messageId": "msg_xyz",
      "input": "Qual o prazo de entrega?",
      "output": "Nao tenho essa informacao.",
      "reason": "resposta_incorreta",
      "createdAt": "2026-03-05T14:22:00Z"
    }
  ]
}
```

O backend reconstrui `input` (mensagem anterior do usuario) e `output` (mensagem do agente avaliada) a partir do `messages.jsonl` da sessao.

---

## 4. Telas

### 4.1 Botoes de Feedback na Conversa

Em cada mensagem do agente na pagina de conversa (`/conversations/:id`), exibir thumbs up/down apos a mensagem:

```
[mensagem do agente]
                    👍  👎
```

- Botoes aparecem no hover da mensagem (desktop) ou sempre visiveis (mobile)
- Clicar em thumbs down abre popover com opcoes de motivo (radio group)
- Motivo selecionado submete o feedback automaticamente
- Botao ativo fica destacado (preenchido) — clicar novamente desfaz (DELETE)
- Se ja tem feedback, exibir o estado atual ao carregar

### 4.2 Dashboard de Qualidade (`/agents/:id/quality`)

Nova aba na pagina do agente, apos "Avaliacao".

**Layout:**

```
+-- Taxa de Aprovacao --------------------+
| 81.7%   120 avaliacoes   98 boas / 22 ruins |
+------------------------------------------+
| Evolucao de Aprovacao (30 dias)          |
| [grafico de linha: approvalRate por dia] |
+------------------------------------------+
| Principais Motivos de Reprovacao         |
| Resposta incorreta     ████████ 10       |
| Incompleta             █████ 7           |
+------------------------------------------+
| [Mensagens Mal-Avaliadas] [Exportar para Golden Set] |
| [tabela de low-rated items]              |
+------------------------------------------+
```

Filtro de periodo no topo (7 dias, 30 dias, 90 dias).

### 4.3 Exportar para Golden Set

Botao "Exportar para Golden Set" na tabela de mensagens mal-avaliadas:

- Abre modal para selecionar/criar um eval set (integrado com S-019)
- Para cada item selecionado, cria `eval_case` com `input` = pergunta do usuario, `expected` = (campo vazio para o operador preencher a resposta correta)
- Redireciona para o eval set criado/atualizado

---

## 5. Componentes

| Componente | Localizacao |
|------------|-------------|
| `MessageFeedback` | `components/conversations/message-feedback.tsx` |
| `FeedbackReasonPopover` | `components/conversations/feedback-reason-popover.tsx` |
| `QualityTab` | `routes/_authenticated/agents/$agentId/quality.tsx` |
| `QualityOverviewCards` | `components/quality/quality-overview-cards.tsx` |
| `QualityTrendChart` | `components/quality/quality-trend-chart.tsx` |
| `TopReasonsChart` | `components/quality/top-reasons-chart.tsx` |
| `LowRatedTable` | `components/quality/low-rated-table.tsx` |
| `ExportToGoldenSetModal` | `components/quality/export-to-golden-set-modal.tsx` |

**API module:** `api/quality.ts`

```typescript
export const agentQualityQueryOptions = (agentId: string, days: number) =>
  queryOptions({
    queryKey: ["quality", agentId, days],
    queryFn: () => request<AgentQuality>(`/agents/${agentId}/quality?days=${days}`),
  });

export const lowRatedQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["quality", agentId, "low-rated"],
    queryFn: () => request<LowRatedItem[]>(`/agents/${agentId}/quality/low-rated`),
  });
```

---

## 6. Criterios de Aceite

- [ ] Tabela `message_feedback` criada e migrada
- [ ] Mensagens em `messages.jsonl` tem campo `id` unico por linha
- [ ] POST feedback armazena rating e reason; UNIQUE por (session, message) — segundo clique no mesmo rating desfaz
- [ ] Thumbs up/down visivel na conversa em mensagens do agente
- [ ] Thumbs down abre popover com opcoes de motivo
- [ ] Estado de feedback persistido ao recarregar conversa
- [ ] Aba "Qualidade" visivel na pagina do agente
- [ ] Taxa de aprovacao calculada corretamente no dashboard
- [ ] Grafico de evolucao temporal exibe aprovacao por dia
- [ ] Tabela de mensagens mal-avaliadas lista items com input/output
- [ ] Export para golden set cria eval_cases no set escolhido (integracao com S-019)

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| `message_feedback` + thumbs up/down | D-037 (sem feedback de usuarios) |
| Dashboard de qualidade | G-038 (dashboard de qualidade por agente) |
| Motivos de reprovacao | G-038 (rating com motivo) |
| Export para golden sets | G-038 (exportar para S-019), G-035 (golden sets) |
