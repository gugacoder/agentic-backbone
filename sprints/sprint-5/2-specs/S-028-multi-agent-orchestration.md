# S-028 — Orquestracao Multi-Agente (Supervisor Pattern)

Sistema de orquestracao onde um agente supervisor delega subtarefas a agentes especialistas, com roteamento por intencao, passagem de contexto e historico unificado de conversa.

**Resolve:** D-044 (orquestracao inexistente), G-045 (supervisor-agent pattern)
**Score de prioridade:** 8

---

## 1. Objetivo

- Definir agentes como "supervisor" com lista de agentes "membros" para delegacao
- Ao receber uma mensagem, supervisor usa LLM para detectar intencao e rotear para membro adequado
- Contexto da conversa e passado entre agentes (handoff transparente)
- GUI para configurar handoffs entre agentes
- Historico de conversa unificado exibe qual agente respondeu cada mensagem

---

## 2. Schema DB

### 2.1 Tabela `agent_handoffs`

```sql
CREATE TABLE IF NOT EXISTS agent_handoffs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  supervisor_id   TEXT NOT NULL,   -- agente supervisor (ex: system.triage)
  member_id       TEXT NOT NULL,   -- agente membro delegado (ex: system.suporte)
  label           TEXT NOT NULL,   -- nome do handoff (ex: "Suporte Tecnico")
  trigger_intent  TEXT NOT NULL,   -- descricao de intencao que dispara delegacao
  priority        INTEGER DEFAULT 0, -- ordem de avaliacao (menor = maior prioridade)
  enabled         INTEGER DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_handoffs_sup_member ON agent_handoffs(supervisor_id, member_id);
CREATE INDEX idx_handoffs_supervisor ON agent_handoffs(supervisor_id);
```

### 2.2 Coluna adicional em `sessions` (backbone.sqlite)

```sql
ALTER TABLE sessions ADD COLUMN orchestration_path TEXT; -- JSON array de agent IDs visitados
ALTER TABLE sessions ADD COLUMN current_agent_id TEXT;   -- agente ativo atual na conversa
```

---

## 3. Configuracao de Agente Supervisor

No `AGENT.md` do agente supervisor, novo campo frontmatter:

```yaml
---
enabled: true
role: supervisor
members:
  - system.suporte
  - system.financeiro
  - system.onboarding
---
```

O campo `role: supervisor` ativa o modo de orquestracao para esse agente.

---

## 4. Fluxo de Orquestracao

```
Usuario envia mensagem
    ↓
Supervisor recebe (modo conversation)
    ↓
LLM do supervisor avalia intencao contra lista de handoffs
    ↓
[Handoff detectado]               [Sem handoff]
    ↓                                   ↓
Delega para membro          Responde diretamente (supervisor)
    ↓
Membro executa com contexto da conversa
    ↓
Resposta retorna para usuario com tag do agente que respondeu
```

**Prompt de roteamento injetado no supervisor:**

```xml
<orchestration>
Voce e um supervisor. Analise a mensagem do usuario e decida:
1. Responda diretamente se a mensagem e generica ou nao se enquadra em nenhuma especialidade
2. Delegue para o especialista correto se a intencao se encaixar:
   - system.suporte: problemas tecnicos, bugs, erros
   - system.financeiro: cobracas, faturas, pagamentos
   - system.onboarding: novos usuarios, configuracao inicial
Responda APENAS com JSON: {"action": "delegate", "to": "agent_id"} ou {"action": "respond"}
</orchestration>
```

---

## 5. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/agents/:agentId/handoffs` | Listar handoffs configurados para supervisor |
| POST | `/agents/:agentId/handoffs` | Adicionar handoff (membro + intencao) |
| PATCH | `/agents/:agentId/handoffs/:id` | Atualizar handoff |
| DELETE | `/agents/:agentId/handoffs/:id` | Remover handoff |

### 5.1 POST `/agents/:agentId/handoffs` — Body

```json
{
  "memberId": "system.suporte",
  "label": "Suporte Tecnico",
  "triggerIntent": "problemas tecnicos, erros no sistema, bugs, dificuldades de acesso",
  "priority": 1
}
```

### 5.2 GET `/sessions/:sessionId` — Response estendido

Sessao agora inclui:
```json
{
  "sessionId": "sess_abc",
  "orchestrationPath": ["system.triage", "system.suporte"],
  "currentAgentId": "system.suporte",
  "messages": [
    { "role": "user", "content": "Nao consigo acessar minha conta" },
    { "role": "assistant", "content": "...", "agentId": "system.suporte" }
  ]
}
```

---

## 6. Telas (Hub)

### 6.1 `/agents/:id/handoffs` (aba na pagina do agente supervisor)

- Lista de handoffs: Especialista, Label, Intencao (preview), Prioridade, Status (enabled toggle)
- Botao "Adicionar handoff"
- Drag-and-drop para reordenar prioridade
- Aviso visual se agente nao tem `role: supervisor` no AGENT.md

### 6.2 Modal "Adicionar Handoff"

- Select: "Agente membro" (lista de agentes disponiveis)
- Campo: Label (nome do handoff)
- Textarea: "Descricao de intencao que dispara esta delegacao"
- Campo: Prioridade (numero)

### 6.3 Inbox e Conversation view

- Badge colorido por mensagem indicando qual agente respondeu
- Timeline lateral mostrando `orchestrationPath` (caminho de delegacoes)

---

## 7. Criterios de Aceite

- [ ] Agente com `role: supervisor` roteia mensagens para membros corretos com base na intencao
- [ ] Contexto completo da conversa e passado para o membro no handoff
- [ ] Resposta do membro aparece na conversa com indicacao do agente que respondeu
- [ ] Handoff sem membro adequado faz supervisor responder diretamente
- [ ] GUI lista, cria, edita e remove handoffs
- [ ] `orchestrationPath` e registrado em sessao e exibivel no Hub
- [ ] Sistema funciona com N membros configurados (minimo testado: 3)
- [ ] Membro nao configurado como supervisor nao pode criar handoffs
