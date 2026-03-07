# PRP-22 — Feedback Loop de Qualidade (Thumbs Up/Down + Dashboard)

Mecanismo de feedback por mensagem no chat (thumbs up/down com motivo opcional), dashboard de qualidade por agente com evolucao temporal, e exportacao de mensagens mal-avaliadas para golden sets.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha mecanismo de feedback de usuarios sobre respostas de agentes. Mensagens em `messages.jsonl` podem nao ter campo `id` unico. Nao ha dados de qualidade para nenhum agente. A integracao com eval sets (PRP-19) e necessaria para exportacao.

### Estado desejado

1. Tabela `message_feedback` no SQLite
2. Mensagens em `messages.jsonl` com campo `id` unico garantido
3. Endpoints de feedback por mensagem e dashboard de qualidade
4. Thumbs up/down na UI de conversa com popover de motivo
5. Aba "Qualidade" na pagina do agente com graficos e tabela de mal-avaliadas
6. Exportacao de mensagens mal-avaliadas para eval sets (integracao com PRP-19)

## Especificacao

### Feature F-087: Tabela message_feedback + garantia de message IDs + endpoints

**Nova tabela em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS message_feedback (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  message_id   TEXT NOT NULL,
  agent_id     TEXT NOT NULL,
  rating       TEXT NOT NULL,
  reason       TEXT,
  user_id      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, message_id)
);
CREATE INDEX idx_feedback_agent ON message_feedback(agent_id, created_at);
CREATE INDEX idx_feedback_session ON message_feedback(session_id);
```

**Garantia de message IDs:** verificar que cada linha gravada em `messages.jsonl` tem campo `id` unico (ex: `msg_{timestamp}_{random}`). Se nao existir, adicionar geracao de ID no ponto de escrita em `conversations/index.ts`.

**Novos endpoints em `apps/backbone/src/routes/feedback.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/conversations/:sessionId/messages/:messageId/feedback` | Enviar feedback (`{ rating: 'up'\|'down', reason? }`) |
| DELETE | `/conversations/:sessionId/messages/:messageId/feedback` | Remover feedback (desfazer) |
| GET | `/agents/:id/quality` | Dashboard de qualidade (query: `days`) |
| GET | `/agents/:id/quality/low-rated` | Mensagens mal-avaliadas |

**GET `/agents/:id/quality` response:**

```json
{
  "agentId": "system.main",
  "period": { "from": "2026-02-07", "to": "2026-03-07" },
  "totalRatings": 120,
  "upCount": 98,
  "downCount": 22,
  "approvalRate": 0.817,
  "trend": [
    { "date": "2026-03-01", "up": 14, "down": 2, "approvalRate": 0.875 }
  ],
  "topReasons": [
    { "reason": "resposta_incorreta", "count": 10 }
  ]
}
```

**GET `/agents/:id/quality/low-rated` response:** backend reconstroi `input` (mensagem anterior do usuario) e `output` (mensagem avaliada) a partir do `messages.jsonl` da sessao.

`reason` enum: `resposta_incorreta`, `sem_contexto`, `incompleta`, `tom_inadequado`, `outro`.

**Hub — `apps/hub/src/api/quality.ts`:**

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

### Feature F-088: Thumbs up/down na interface de conversa

Em cada mensagem do agente na pagina de conversa:

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `MessageFeedback` | `components/conversations/message-feedback.tsx` |
| `FeedbackReasonPopover` | `components/conversations/feedback-reason-popover.tsx` |

**Comportamento:**
- Botoes thumbs up/down aparecem no hover da mensagem (desktop) ou sempre visiveis (mobile)
- Thumbs down abre `FeedbackReasonPopover` com radio group de motivos (labels em pt-BR)
- Motivo selecionado submete POST feedback automaticamente
- Thumbs up submete POST feedback diretamente sem popover
- Botao com rating ativo fica destacado (preenchido); clicar novamente executa DELETE (desfaz)
- Estado de feedback carregado com a conversa (GET conversa inclui feedback das mensagens)

### Feature F-089: Aba Qualidade na pagina do agente

**Nova rota** `routes/_authenticated/agents/$agentId/quality.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `QualityTab` | `routes/_authenticated/agents/$agentId/quality.tsx` |
| `QualityOverviewCards` | `components/quality/quality-overview-cards.tsx` |
| `QualityTrendChart` | `components/quality/quality-trend-chart.tsx` |
| `TopReasonsChart` | `components/quality/top-reasons-chart.tsx` |
| `LowRatedTable` | `components/quality/low-rated-table.tsx` |

**Layout:**

```
+-- Taxa de Aprovacao --------------------+
| 81.7%   120 avaliacoes   98 boas / 22 ruins |
+------------------------------------------+
| Evolucao de Aprovacao (linha por dia)    |
+------------------------------------------+
| Principais Motivos de Reprovacao (barra) |
+------------------------------------------+
| Mensagens Mal-Avaliadas [Exportar]       |
| [tabela: entrada | saida | motivo | data]|
+------------------------------------------+
```

Filtro de periodo no topo: 7 dias, 30 dias, 90 dias (query param `days`).

Graficos usando shadcn Chart (Recharts): `QualityTrendChart` = LineChart de `approvalRate` por dia; `TopReasonsChart` = BarChart horizontal de `count` por `reason`.

### Feature F-090: Export para golden set

**Componente** `ExportToGoldenSetModal` (`components/quality/export-to-golden-set-modal.tsx`):

Botao "Exportar para Golden Set" na `LowRatedTable`:
1. Abre modal para selecionar eval set existente ou criar novo (lista de sets do agente via `evalSetsQueryOptions`)
2. Para cada item selecionado na tabela: cria `eval_case` com `input` = pergunta do usuario, `expected` = vazio (operador preenche a resposta correta no eval set)
3. POST para `/agents/:id/eval-sets/:setId/cases` por item selecionado
4. Apos conclusao: redireciona para a aba Avaliacao do agente (rota de PRP-19)

Requer PRP-19 implementado para existirem eval sets.

## Limites

- **NAO** implementar feedback anonimo de usuarios externos (apenas operadores autenticados)
- **NAO** implementar notificacao automatica ao atingir taxa de reprovacao (futuro)
- **NAO** implementar export de feedback em CSV (futuro)
- **NAO** implementar comparacao de qualidade entre agentes (futuro)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-04** (Chat de Conversas) deve estar implementado — thumbs na conversa
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba na pagina do agente
- **PRP-19** (Avaliacao de Qualidade) deve estar implementado — export para golden set (F-090)

## Validacao

- [ ] Tabela `message_feedback` criada via migracao
- [ ] Mensagens em `messages.jsonl` tem campo `id` unico por linha
- [ ] POST feedback armazena rating e reason; UNIQUE por (session, message) — segundo clique desfaz
- [ ] DELETE feedback remove avaliacao corretamente
- [ ] Thumbs up/down visivel na conversa em mensagens do agente
- [ ] Thumbs down abre popover com opcoes de motivo em pt-BR
- [ ] Estado de feedback persistido ao recarregar conversa
- [ ] GET `/agents/:id/quality` retorna metricas corretas
- [ ] GET `/agents/:id/quality/low-rated` retorna mensagens com input/output reconstruidos
- [ ] Aba "Qualidade" visivel na pagina do agente
- [ ] Taxa de aprovacao calculada corretamente no dashboard
- [ ] Grafico de evolucao temporal exibe approvalRate por dia
- [ ] Grafico de motivos exibe top reasons
- [ ] Tabela de mal-avaliadas lista items com input/output
- [ ] Export para golden set cria eval_cases no set escolhido
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-087 message_feedback + endpoints | S-022 sec 2, 3 | D-037 |
| F-088 Thumbs up/down na conversa | S-022 sec 4.1 | D-037, G-038 |
| F-089 Aba Qualidade + graficos | S-022 sec 4.2 | G-038 |
| F-090 Export para golden set | S-022 sec 4.3 | G-038, G-035 |
