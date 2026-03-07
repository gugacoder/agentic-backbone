# S-020 — Aprovacao Humana para Acoes Criticas (HITL)

Mecanismo de checkpoint configuravel: agente solicita aprovacao humana antes de executar acoes criticas, com notificacao push, timeout e auditoria de decisoes.

---

## 1. Objetivo

- Permitir que ferramentas (tools) do agente marquem acoes como "criticas" exigindo aprovacao antes de executar
- Operador recebe notificacao push e aprova/rejeita via Hub ou diretamente na conversa
- Suporte a timeout configuravel (agente cancela acao se nao aprovada em X segundos)
- Resolver D-025 (sem aprovacao humana para acoes criticas), G-025 (workflows de aprovacao com checkpoint)

---

## 2. Schema DB

### 2.1 Tabela `approval_requests`

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  session_id   TEXT,                          -- conversa que gerou o pedido (nullable para heartbeat)
  tool_name    TEXT NOT NULL,                 -- nome da tool que pediu aprovacao
  action_label TEXT NOT NULL,                 -- descricao legivel da acao (ex: "Enviar email para cliente@x.com")
  payload      TEXT NOT NULL,                 -- JSON com argumentos da tool
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending','approved','rejected','expired'
  decided_by   TEXT,                          -- user_id que decidiu
  decided_at   TEXT,
  expires_at   TEXT NOT NULL,                 -- datetime de expiracao
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_approval_agent ON approval_requests(agent_id, status);
CREATE INDEX idx_approval_session ON approval_requests(session_id);
```

---

## 3. Mecanismo no Backend

### 3.1 Tool com flag `requiresApproval`

Tools podem declarar que precisam de aprovacao em seu `TOOL.md` via frontmatter:

```yaml
---
name: send-email
requires_approval: true
approval_label: "Enviar email para {to}"
approval_timeout_seconds: 300
---
```

### 3.2 Fluxo de Execucao

Quando o agente tenta chamar uma tool com `requires_approval: true`:

1. Backend intercepta a chamada antes de executar a tool
2. Cria registro em `approval_requests` com `status: pending` e `expires_at = now + timeout`
3. Emite notificacao push (tipo `approval_required`) com `approval_id`, `agent_id`, `action_label`
4. Emite evento SSE `approval:pending` no canal do agente
5. Suspende a execucao do agente (aguarda resolucao com timeout)

Quando operador aprova:
- Atualiza `status: approved`, registra `decided_by` e `decided_at`
- Retoma execucao da tool com o payload original
- Emite SSE `approval:resolved` com resultado

Quando operador rejeita:
- Atualiza `status: rejected`
- Tool recebe erro `ApprovalRejectedError` — agente informa usuario que acao foi cancelada

Quando expira:
- Background job detecta `expires_at < now` e status `pending`
- Atualiza `status: expired`
- Agente recebe timeout e pode tentar novamente ou informar usuario

### 3.3 Novos Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/approval-requests` | Listar pendentes (query: `status`, `agent_id`) |
| GET | `/approval-requests/:id` | Detalhe do pedido |
| POST | `/approval-requests/:id/approve` | Aprovar |
| POST | `/approval-requests/:id/reject` | Rejeitar com motivo opcional |

#### GET `/approval-requests?status=pending` — Response

```json
{
  "requests": [
    {
      "id": 7,
      "agentId": "system.main",
      "toolName": "send-email",
      "actionLabel": "Enviar email para cliente@empresa.com",
      "payload": { "to": "cliente@empresa.com", "subject": "...", "body": "..." },
      "status": "pending",
      "expiresAt": "2026-03-07T21:05:00Z",
      "createdAt": "2026-03-07T21:00:00Z"
    }
  ]
}
```

#### POST `/approval-requests/:id/reject` — Payload

```json
{ "reason": "Conteudo incorreto, revisar antes de enviar" }
```

### 3.4 Evento SSE

Novo tipo de evento SSE emitido no canal de sistema:

```json
{
  "type": "approval:pending",
  "approvalId": 7,
  "agentId": "system.main",
  "actionLabel": "Enviar email para cliente@empresa.com",
  "expiresAt": "2026-03-07T21:05:00Z"
}
```

---

## 4. Telas

### 4.1 Central de Aprovacoes (`/approvals`)

Nova pagina no menu lateral (icone: `ShieldCheck`).

**Layout:**

```
+-- Aprovacoes Pendentes (3) -----------+
|                                       |
| system.main                           |
| Enviar email para cliente@x.com       |
| Expira em 4 min 32 seg               |
|                                       |
| [Ver detalhes]  [Rejeitar] [Aprovar]  |
+---------------------------------------+
```

- Badge no menu lateral com contador de pendentes (atualizado via SSE)
- Timer regressivo ate expiracao
- Botao "Ver detalhes" expande payload JSON formatado
- Botao "Rejeitar" abre input opcional de motivo antes de confirmar

### 4.2 Indicador Global na Topbar

Badge vermelho no sino/notificacoes quando ha aprovacoes pendentes. Clicar navega para `/approvals`.

### 4.3 Indicador na Conversa

Na pagina de conversa onde o agente solicitou aprovacao:
- Mensagem do sistema na timeline: "Aguardando aprovacao para: Enviar email para cliente@x.com"
- Botoes Aprovar/Rejeitar inline na conversa
- Apos decisao, mensagem de sistema indica resultado

### 4.4 Historico de Aprovacoes

Aba "Historico" em `/approvals` com tabela:

| Coluna | Descricao |
|--------|-----------|
| Acao | `action_label` |
| Agente | `agent_id` |
| Status | badge colorido (aprovado=verde, rejeitado=vermelho, expirado=cinza) |
| Decidido por | username |
| Data | `decided_at` |

Filtros: `status`, `agent_id`, periodo.

---

## 5. Componentes

| Componente | Localizacao |
|------------|-------------|
| `ApprovalsPage` | `routes/_authenticated/approvals/index.tsx` |
| `ApprovalCard` | `components/approvals/approval-card.tsx` |
| `ApprovalHistory` | `components/approvals/approval-history.tsx` |
| `ApprovalInlineActions` | `components/approvals/approval-inline-actions.tsx` |

**API module:** `api/approvals.ts`

```typescript
export const pendingApprovalsQueryOptions = () =>
  queryOptions({
    queryKey: ["approvals", "pending"],
    queryFn: () => request<ApprovalRequest[]>("/approval-requests?status=pending"),
  });
```

**SSE:** O hook `useSSE` ja existente deve tratar evento `approval:pending` invalidando `["approvals", "pending"]`.

---

## 6. Criterios de Aceite

- [ ] Tabela `approval_requests` criada e migrada
- [ ] Frontmatter `requires_approval` em TOOL.md funcional — tool interceptada pelo backend
- [ ] Pedido de aprovacao cria registro e emite notificacao push + evento SSE
- [ ] Pagina `/approvals` lista pedidos pendentes com timer regressivo
- [ ] Aprovar retoma execucao da tool com payload original
- [ ] Rejeitar cancela acao e agente informa usuario
- [ ] Pedidos expirados sao marcados automaticamente pelo backend
- [ ] Badge no menu lateral mostra contagem de pendentes em tempo real
- [ ] Aprovacao/rejeicao inline funcional na pagina de conversa
- [ ] Historico de decisoes visivel com filtros

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| `approval_requests` + interceptor de tool | D-025 (sem aprovacao para acoes criticas) |
| Notificacao push + SSE | G-025 (notificacao com timeout) |
| UI de aprovacao inline e pagina | G-025 (workflows de aprovacao) |
| Historico de decisoes | D-004 (governanca), G-008 (auditabilidade) |
