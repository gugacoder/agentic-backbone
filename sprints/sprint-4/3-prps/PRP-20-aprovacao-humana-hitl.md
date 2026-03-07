# PRP-20 — Aprovacao Humana para Acoes Criticas (HITL)

Mecanismo de checkpoint configuravel: tools marcadas com `requires_approval` interceptam a execucao do agente, notificam o operador via SSE, e so prosseguem apos aprovacao humana — com suporte a timeout e auditoria de decisoes.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone executa tools diretamente sem nenhuma possibilidade de intervencao humana. Nao existe mecanismo para pausar a execucao de um agente enquanto aguarda decisao de operador. Nao ha tabela de pedidos de aprovacao nem endpoints relacionados.

### Estado desejado

1. Tabela `approval_requests` no SQLite
2. Frontmatter `requires_approval` em `TOOL.md` lido pelo backend ao carregar tools
3. Interceptor no fluxo de tool call que pausa execucao e aguarda aprovacao
4. Endpoints para listar, aprovar e rejeitar pedidos
5. Pagina `/approvals` no Hub com pendentes, timer regressivo e historico
6. Aprovacao/rejeicao inline na pagina de conversa
7. Badge no menu lateral com contador de pendentes

## Especificacao

### Feature F-080: Tabela approval_requests + endpoints de CRUD

**Nova tabela em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  session_id   TEXT,
  tool_name    TEXT NOT NULL,
  action_label TEXT NOT NULL,
  payload      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  decided_by   TEXT,
  decided_at   TEXT,
  expires_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_approval_agent ON approval_requests(agent_id, status);
CREATE INDEX idx_approval_session ON approval_requests(session_id);
```

**Novos endpoints em `apps/backbone/src/routes/approvals.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/approval-requests` | Listar (query: `status`, `agent_id`) |
| GET | `/approval-requests/:id` | Detalhe |
| POST | `/approval-requests/:id/approve` | Aprovar |
| POST | `/approval-requests/:id/reject` | Rejeitar (`{ reason? }`) |

Ao aprovar/rejeitar: atualizar `status`, `decided_by`, `decided_at`. Background job a cada minuto: detectar `expires_at < now` com `status: pending` e marcar como `expired`.

**Hub — `apps/hub/src/api/approvals.ts`:**

```typescript
export const pendingApprovalsQueryOptions = () =>
  queryOptions({
    queryKey: ["approvals", "pending"],
    queryFn: () => request<ApprovalRequest[]>("/approval-requests?status=pending"),
  });

export const approvalHistoryQueryOptions = () =>
  queryOptions({
    queryKey: ["approvals", "history"],
    queryFn: () => request<ApprovalRequest[]>("/approval-requests?status=approved,rejected,expired"),
  });
```

### Feature F-081: Interceptor de tool + frontmatter requires_approval + SSE

**Frontmatter em `TOOL.md`** — novos campos opcionais lidos pelo loader de tools:

```yaml
---
name: send-email
requires_approval: true
approval_label: "Enviar email para {to}"
approval_timeout_seconds: 300
---
```

**Interceptor em `apps/backbone/src/tools/`** — ao executar uma tool com `requires_approval: true`:

1. Criar registro em `approval_requests` (`status: pending`, `expires_at = now + timeout`)
2. Emitir evento SSE `approval:pending` no event bus:
   ```json
   { "type": "approval:pending", "approvalId": 7, "agentId": "...", "actionLabel": "...", "expiresAt": "..." }
   ```
3. Suspender execucao: aguardar resolucao (Promise que resolve quando `status` muda para `approved`/`rejected`/`expired`) com timeout maximo de `approval_timeout_seconds`
4. Se `approved`: prosseguir com a execucao da tool usando o `payload` original
5. Se `rejected`: retornar `ApprovalRejectedError` ao agente (agente informa usuario que acao foi cancelada)
6. Se `expired`: retornar `ApprovalExpiredError`

O hook `useSSE` do Hub deve tratar `approval:pending` invalidando `["approvals", "pending"]`.

### Feature F-082: Pagina /approvals + badge no menu lateral

**Nova rota** `routes/_authenticated/approvals/index.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `ApprovalsPage` | `routes/_authenticated/approvals/index.tsx` |
| `ApprovalCard` | `components/approvals/approval-card.tsx` |
| `ApprovalHistory` | `components/approvals/approval-history.tsx` |

**ApprovalCard** exibe:
- Agent ID, `action_label`
- Timer regressivo ate expiracao (`expires_at - now`)
- Botao "Ver detalhes" expande payload JSON formatado
- Botao "Rejeitar" — abre input opcional de motivo antes de confirmar
- Botao "Aprovar" — confirmacao direta

**Aba "Historico"** em `/approvals`:

| Coluna | Descricao |
|--------|-----------|
| Acao | `action_label` |
| Agente | `agent_id` |
| Status | badge colorido (aprovado=verde, rejeitado=vermelho, expirado=cinza) |
| Decidido por | `decided_by` |
| Data | `decided_at` |

Filtros: `status`, `agent_id`.

**Badge no menu lateral** (icone: `ShieldCheck`) — contador de pendentes atualizado via SSE.

**Indicador na topbar** — badge vermelho no sino quando ha pendentes; clicar navega para `/approvals`.

### Feature F-083: Aprovacao inline na conversa

Na pagina de conversa (`/conversations/:id`) onde o agente solicitou aprovacao:

**Componente** `ApprovalInlineActions` (`components/approvals/approval-inline-actions.tsx`):
- Exibido como mensagem de sistema na timeline: "Aguardando aprovacao: {action_label}"
- Botoes Aprovar / Rejeitar inline
- Apos decisao: mensagem de sistema indica resultado ("Acao aprovada" / "Acao rejeitada")

O componente consulta `approval_requests` filtrando por `session_id`. Ao receber SSE `approval:pending` com `session_id` correspondente, exibir o card inline.

## Limites

- **NAO** implementar aprovacao por WhatsApp/canal externo (futuro)
- **NAO** implementar delegacao de aprovacao para outro usuario (futuro)
- **NAO** implementar aprovacoes em lote (futuro)
- **NAO** implementar escalonamento automatico apos timeout (futuro)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-04** (Chat de Conversas) deve estar implementado — aprovacao inline na conversa

## Validacao

- [ ] Tabela `approval_requests` criada via migracao
- [ ] Frontmatter `requires_approval` em TOOL.md lido pelo loader de tools
- [ ] Tool interceptada: execucao suspensa ate aprovacao/rejeicao/timeout
- [ ] POST `/approval-requests/:id/approve` retoma execucao da tool
- [ ] POST `/approval-requests/:id/reject` cancela e agente informa usuario
- [ ] Pedidos expirados marcados automaticamente pelo background job
- [ ] Evento SSE `approval:pending` emitido e consumido pelo Hub
- [ ] Pagina `/approvals` lista pendentes com timer regressivo
- [ ] Badge no menu lateral mostra contagem de pendentes em tempo real
- [ ] Historico de decisoes com filtros funcional
- [ ] Aprovacao/rejeicao inline funcional na pagina de conversa
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-080 Tabela + endpoints CRUD | S-020 sec 2, 3.3 | D-025 |
| F-081 Interceptor + SSE | S-020 sec 3.1-3.2, 3.4 | G-025 |
| F-082 Pagina /approvals + badge | S-020 sec 4.1-4.2, 4.4 | G-025, D-004 |
| F-083 Aprovacao inline conversa | S-020 sec 4.3 | G-025, G-008 |
