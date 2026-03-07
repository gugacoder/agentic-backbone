# PRP-28 — Orquestracao Multi-Agente (Supervisor Pattern)

Sistema de orquestracao onde um agente supervisor delega subtarefas a agentes especialistas com base na intencao detectada pela LLM. Handoffs configurados via GUI, historico unificado por sessao.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha mecanismo de delegacao entre agentes. Cada agente opera de forma independente. A tabela `sessions` no SQLite nao registra caminhos de orquestracao. Nao ha conceito de "supervisor" ou "membro" nos agentes.

### Estado desejado

1. Tabela `agent_handoffs` no SQLite + colunas `orchestration_path` e `current_agent_id` em `sessions`
2. Campo `role: supervisor` + `members: []` no frontmatter do AGENT.md
3. Logica de roteamento por intencao em `runAgent()` para agentes supervisores
4. Endpoints CRUD de handoffs
5. Aba "Handoffs" na pagina do agente e badges no Inbox/Conversation view

## Especificacao

### Feature F-108: Tabela agent_handoffs + colunas em sessions + migracao DB

**Nova tabela em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS agent_handoffs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  supervisor_id  TEXT NOT NULL,
  member_id      TEXT NOT NULL,
  label          TEXT NOT NULL,
  trigger_intent TEXT NOT NULL,
  priority       INTEGER DEFAULT 0,
  enabled        INTEGER DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_handoffs_sup_member ON agent_handoffs(supervisor_id, member_id);
CREATE INDEX idx_handoffs_supervisor ON agent_handoffs(supervisor_id);
```

**Migracoes adicionais na tabela `sessions`:**

```sql
ALTER TABLE sessions ADD COLUMN orchestration_path TEXT;
ALTER TABLE sessions ADD COLUMN current_agent_id TEXT;
```

Adicionar migracao no startup do backbone com verificacao de existencia de colunas (ALTER TABLE seguro).

**Leitura de frontmatter do AGENT.md:**

Estender o parser de agentes para reconhecer:
```yaml
role: supervisor
members:
  - system.suporte
  - system.financeiro
```

O campo `role` e `members` devem ser acessiveis no objeto de agente em memoria.

### Feature F-109: Endpoints CRUD de handoffs + logica de roteamento

**Novas rotas em `apps/backbone/src/routes/handoffs.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/handoffs` | Listar handoffs configurados para supervisor |
| POST | `/agents/:agentId/handoffs` | Adicionar handoff |
| PATCH | `/agents/:agentId/handoffs/:id` | Atualizar handoff |
| DELETE | `/agents/:agentId/handoffs/:id` | Remover handoff |

**POST body:**
```json
{
  "memberId": "system.suporte",
  "label": "Suporte Tecnico",
  "triggerIntent": "problemas tecnicos, erros, bugs, dificuldades de acesso",
  "priority": 1
}
```

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/handoffs.ts`:**

```typescript
export const handoffsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["handoffs", agentId],
    queryFn: () => request<Handoff[]>(`/agents/${agentId}/handoffs`),
  });
```

### Feature F-110: Logica de orquestracao em runAgent()

Quando agente tem `role: supervisor`:

1. Antes de executar normalmente, chamar LLM com prompt de roteamento:

```xml
<orchestration>
Voce e um supervisor. Analise a mensagem do usuario e decida:
1. Responda diretamente se nao se enquadra em nenhuma especialidade listada
2. Delegue para o especialista correto se a intencao se encaixar:
{handoffs_list}
Responda APENAS com JSON: {"action": "delegate", "to": "agent_id"} ou {"action": "respond"}
</orchestration>
```

2. Se `action: "delegate"`:
   - Atualizar `sessions.current_agent_id` para o membro
   - Atualizar `sessions.orchestration_path` (append do membro ao array)
   - Executar `runAgent()` do membro com contexto completo da conversa
   - Resposta do membro retorna ao usuario com `agentId` anotado na mensagem

3. Se `action: "respond"` ou nenhum membro adequado:
   - Supervisor responde diretamente

4. Mensagens em `messages.jsonl` anotadas com campo `agentId` para rastreabilidade

### Feature F-111: Telas Hub — aba Handoffs e badges no Inbox

**Nova aba "Handoffs"** na pagina do agente (`/agents/:id`) com rota `routes/_authenticated/agents/$agentId/handoffs.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `HandoffsTab` | `routes/_authenticated/agents/$agentId/handoffs.tsx` |
| `HandoffCard` | `components/handoffs/handoff-card.tsx` |
| `HandoffCreateDialog` | `components/handoffs/handoff-create-dialog.tsx` |

**HandoffsTab:**
- Aviso se agente nao tem `role: supervisor` no AGENT.md
- Lista de handoffs: Especialista, Label, Intencao (preview truncado), Prioridade, toggle enabled
- Botao "Adicionar handoff"
- Reordenacao por drag-and-drop (atualiza `priority`)

**HandoffCreateDialog:**
- Select "Agente membro" (lista de agentes disponiveis)
- Campo Label
- Textarea "Descricao de intencao que dispara esta delegacao"
- Campo Prioridade (numero)

**Inbox e Conversation view:**
- Badge colorido por mensagem indicando qual agente respondeu (quando `agentId` presente na mensagem)
- Painel lateral: lista do `orchestrationPath` da sessao (caminho de delegacoes)

## Limites

- **NAO** implementar handoffs em cascata (membro que delega para outro membro) — apenas um nivel de delegacao
- **NAO** implementar balanceamento de carga entre membros
- **NAO** persistir historico de handoffs por mensagem em tabela separada

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-03** (Gestao de Agentes) deve estar implementado — nova aba adicionada
- Agentes membros devem existir no registry para aparecer no select

## Validacao

- [ ] Agente com `role: supervisor` roteia mensagens para membros corretos com base na intencao
- [ ] Contexto completo da conversa e passado para o membro no handoff
- [ ] Resposta do membro aparece com indicacao do agente que respondeu
- [ ] Handoff sem membro adequado faz supervisor responder diretamente
- [ ] GUI lista, cria, edita e remove handoffs
- [ ] `orchestrationPath` registrado em sessao e exibivel no Hub
- [ ] Sistema funciona com 3+ membros configurados
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-108 Tabela handoffs + colunas sessions | S-028 sec 2 | D-044 |
| F-109 CRUD handoffs + roteamento | S-028 sec 3, 4, 5 | D-044, G-045 |
| F-110 Logica de orquestracao runAgent | S-028 sec 4 | G-045 |
| F-111 Telas Hub handoffs + badges | S-028 sec 6 | G-045 |
