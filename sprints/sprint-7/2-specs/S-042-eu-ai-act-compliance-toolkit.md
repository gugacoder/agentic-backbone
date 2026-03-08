# S-042 — EU AI Act Compliance Toolkit

Toolkit integrado de conformidade com o EU AI Act, permitindo classificação de risco por agente, documentação de supervisão humana, explicabilidade de decisões automatizadas e geração de relatórios para auditorias regulatórias. Complementa o LGPD Compliance Dashboard existente (Sprint 5).

**Resolve:** D-063 (EU AI Act sem toolkit de conformidade), G-063 (EU AI Act Compliance Toolkit)
**Score de prioridade:** 9
**Dependência:** LGPD Compliance Dashboard (Sprint 5, S-026), HITL/Approvals (Sprint 4, S-020), Trace Timeline (Sprint 3, S-015)

---

## 1. Objetivo

- Classificação de risco por agente: high-risk, limited-risk, minimal-risk (conforme categorias EU AI Act)
- Documentação de supervisão humana: logs de HITL exportáveis com timestamp, decisão, usuário responsável
- Explicabilidade: relatório "por que o agente fez X" baseado em trace timeline existente
- Registro de versão de instruções usadas em cada decisão (integração com config versioning Sprint 5)
- Checklist de conformidade interativo por agente
- Template de DPIA (Data Protection Impact Assessment) para sistemas AI
- Relatório exportável para auditorias regulatórias (PDF)
- Integração com LGPD Compliance Dashboard existente

---

## 2. Schema DB

### 2.1 Tabela `compliance_classification`

```sql
CREATE TABLE IF NOT EXISTS compliance_classification (
  agent_id          TEXT PRIMARY KEY,
  risk_level        TEXT NOT NULL DEFAULT 'minimal',   -- 'high' | 'limited' | 'minimal'
  risk_justification TEXT,                             -- texto livre justificando classificação
  classified_by     TEXT NOT NULL,                     -- userId
  classified_at     TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at       TEXT,                              -- última revisão
  review_due_at     TEXT                               -- próxima revisão obrigatória
);
```

### 2.2 Tabela `compliance_checklist`

```sql
CREATE TABLE IF NOT EXISTS compliance_checklist (
  id                TEXT PRIMARY KEY,                  -- uuid v4
  agent_id          TEXT NOT NULL,
  item_key          TEXT NOT NULL,                     -- identificador do item (ex: 'human_oversight', 'data_documentation')
  item_label        TEXT NOT NULL,                     -- descrição legível
  category          TEXT NOT NULL,                     -- 'transparency' | 'oversight' | 'documentation' | 'data_governance' | 'risk_management'
  status            TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'compliant' | 'non_compliant' | 'not_applicable'
  evidence          TEXT,                              -- texto ou link para evidência
  updated_by        TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, item_key)
);

CREATE INDEX idx_compliance_checklist_agent ON compliance_checklist(agent_id);
```

### 2.3 Tabela `compliance_reports`

```sql
CREATE TABLE IF NOT EXISTS compliance_reports (
  id              TEXT PRIMARY KEY,                    -- uuid v4
  agent_id        TEXT,                                -- null = relatório de sistema
  report_type     TEXT NOT NULL,                       -- 'audit' | 'dpia' | 'human_oversight' | 'decision_explanation'
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,                       -- JSON com dados do relatório
  generated_by    TEXT NOT NULL,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  period_from     TEXT,
  period_to       TEXT
);

CREATE INDEX idx_compliance_reports_agent ON compliance_reports(agent_id);
CREATE INDEX idx_compliance_reports_type ON compliance_reports(report_type);
```

---

## 3. Módulo `src/compliance/`

### 3.1 Estrutura

```
src/compliance/
  index.ts                # ComplianceManager: inicialização, registro de checklist items padrão
  classification.ts       # CRUD de classificação de risco
  checklist.ts            # CRUD e avaliação de checklist
  reports.ts              # Geração de relatórios (audit, DPIA, oversight, explicabilidade)
  decision-explainer.ts   # Gera explicação de decisão a partir de trace timeline
  schemas.ts              # Zod schemas
```

### 3.2 Checklist Items Padrão

Ao classificar um agente, o sistema cria automaticamente os items de checklist baseados no nível de risco:

**High-risk (todos os items):**
- `human_oversight` — Supervisão humana configurada (HITL habilitado)
- `human_oversight_logs` — Logs de supervisão exportáveis
- `decision_transparency` — Explicabilidade de decisões ativa
- `instruction_versioning` — Versionamento de instruções ativo
- `data_documentation` — Documentação de dados processados
- `risk_assessment` — Avaliação de risco documentada
- `dpia_completed` — DPIA realizado
- `kill_switch` — Mecanismo de parada de emergência (S-041)
- `audit_trail` — Trilha de auditoria completa
- `incident_response` — Procedimento de resposta a incidentes

**Limited-risk:**
- `transparency_notice` — Aviso de que é um sistema AI
- `decision_transparency` — Explicabilidade de decisões
- `instruction_versioning` — Versionamento de instruções
- `data_documentation` — Documentação de dados processados

**Minimal-risk:**
- `transparency_notice` — Aviso de que é um sistema AI

### 3.3 Decision Explainer

Usa trace timeline existente para gerar explicação legível de uma decisão do agente:

```typescript
interface DecisionExplanation {
  traceId: string
  agentId: string
  timestamp: string
  input: string                    // mensagem/trigger que iniciou
  decision: string                 // ação tomada pelo agente
  reasoning: string                // resumo do raciocínio (extraído do trace)
  toolsUsed: string[]              // ferramentas chamadas
  instructionVersion: string       // hash da versão de SOUL.md/CONVERSATION.md usada
  memoryContext: string[]          // fatos de memória consultados
  humanApproval?: {                // se HITL foi acionado
    required: boolean
    approved: boolean
    approvedBy: string
    approvedAt: string
  }
}
```

---

## 4. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/compliance` | Visão completa de conformidade do agente |
| GET | `/agents/:id/compliance/classification` | Classificação de risco atual |
| PUT | `/agents/:id/compliance/classification` | Atualizar classificação de risco |
| GET | `/agents/:id/compliance/checklist` | Items do checklist com status |
| PUT | `/agents/:id/compliance/checklist/:itemKey` | Atualizar status de item do checklist |
| POST | `/agents/:id/compliance/reports` | Gerar relatório de compliance |
| GET | `/agents/:id/compliance/reports` | Listar relatórios gerados |
| GET | `/agents/:id/compliance/reports/:reportId` | Detalhes de um relatório |
| POST | `/agents/:id/compliance/explain` | Gerar explicação de decisão a partir de trace |
| GET | `/compliance/overview` | Visão geral de conformidade de todos os agentes |
| GET | `/compliance/dpia-template` | Template de DPIA pré-preenchido |

### 4.1 PUT `/agents/:id/compliance/classification`

**Request:**
```json
{
  "riskLevel": "high",
  "riskJustification": "Agente de atendimento que processa dados pessoais e toma decisões automatizadas sobre solicitações de clientes.",
  "reviewDueAt": "2026-09-01"
}
```

### 4.2 POST `/agents/:id/compliance/reports`

**Request:**
```json
{
  "reportType": "audit",
  "periodFrom": "2026-02-01",
  "periodTo": "2026-02-28",
  "includeDecisionExplanations": true,
  "includeHumanOversightLogs": true
}
```

**Response 202:**
```json
{
  "reportId": "rpt_xyz",
  "status": "generating",
  "message": "Relatório sendo gerado em background"
}
```

### 4.3 GET `/compliance/overview`

**Response:**
```json
{
  "totalAgents": 12,
  "byRiskLevel": {
    "high": 3,
    "limited": 5,
    "minimal": 4
  },
  "complianceRate": 0.78,
  "nonCompliantItems": [
    { "agentId": "system.atendimento", "itemKey": "dpia_completed", "category": "documentation" }
  ],
  "pendingReviews": [
    { "agentId": "system.vendas", "reviewDueAt": "2026-04-01" }
  ]
}
```

---

## 5. Telas (Hub)

### 5.1 `/compliance` — Painel de Conformidade

- **Overview cards**: total de agentes por nível de risco (high/limited/minimal), taxa de conformidade geral
- **Tabela de agentes**: agente, nível de risco, % checklist completo, próxima revisão, badge de status
- **Alertas**: items não-conformes, revisões vencidas
- **Botão "Gerar Relatório de Sistema"** — relatório consolidado de todos os agentes

### 5.2 `/agents/:id/compliance` — Compliance do Agente

- **Classificação de risco**: selector high/limited/minimal com campo de justificativa
- **Checklist interativo**: items agrupados por categoria, toggle para cada status (compliant/non_compliant/not_applicable), campo de evidência
- **Progresso**: barra de progresso do checklist por categoria
- **Relatórios**: lista de relatórios gerados, botão "Gerar Novo Relatório" com seleção de tipo e período
- **Explicabilidade**: busca por trace → gera explicação de decisão em linguagem natural

### 5.3 Integração com LGPD Dashboard (`/compliance/lgpd`)

- Link bidirecional: do painel EU AI Act para LGPD Dashboard e vice-versa
- Items compartilhados (data_documentation) sincronizados entre os dois painéis
- Relatório combinado EU AI Act + LGPD disponível

---

## 6. Critérios de Aceite

- [ ] Classificação de risco (high/limited/minimal) pode ser definida por agente com justificativa
- [ ] Checklist de conformidade é gerado automaticamente com items correspondentes ao nível de risco
- [ ] Items do checklist podem ser atualizados com status e evidência
- [ ] Relatório de auditoria inclui: decisões do agente com explicação, logs de HITL, versões de instruções
- [ ] Decision Explainer gera explicação legível a partir de trace timeline existente
- [ ] Template de DPIA é gerado com campos pré-preenchidos baseado no agente
- [ ] Painel `/compliance` mostra visão consolidada de todos os agentes
- [ ] Relatório exportável em formato adequado para auditoria (JSON estruturado, preparado para PDF em S-048)
- [ ] Items compartilhados com LGPD Dashboard são sincronizados
- [ ] Revisões vencidas geram alerta visual no Hub
