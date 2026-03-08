# PRP-43 — EU AI Act Compliance Toolkit

Toolkit integrado de conformidade com o EU AI Act: classificação de risco por agente, checklist interativo, explicabilidade de decisões automatizadas, geração de relatórios para auditorias regulatórias e template de DPIA. Complementa o LGPD Compliance Dashboard existente (Sprint 5).

## Execution Mode

`implementar`

## Contexto

### Estado atual

Não há suporte a conformidade EU AI Act no backbone. O LGPD Compliance Dashboard (Sprint 5) cobre apenas legislação brasileira. Não existe classificação de risco por agente, checklist de conformidade, nem geração de relatórios para auditoria europeia. Decision Explainer não existe — traces existem mas não são transformados em explicações legíveis.

### Estado desejado

1. Tabelas `compliance_classification`, `compliance_checklist`, `compliance_reports` no SQLite
2. Módulo `src/compliance/` com classificação de risco, checklist auto-gerado, decision explainer e geração de relatórios
3. API REST para gerenciar compliance por agente e visão geral do sistema
4. Painel `/compliance` com visão consolidada + página de compliance por agente
5. Integração bidirecional com LGPD Dashboard existente

## Especificacao

### Feature F-149: Tabelas compliance + migração DB

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS compliance_classification (
  agent_id          TEXT PRIMARY KEY,
  risk_level        TEXT NOT NULL DEFAULT 'minimal',
  risk_justification TEXT,
  classified_by     TEXT NOT NULL,
  classified_at     TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at       TEXT,
  review_due_at     TEXT
);

CREATE TABLE IF NOT EXISTS compliance_checklist (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  item_key          TEXT NOT NULL,
  item_label        TEXT NOT NULL,
  category          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  evidence          TEXT,
  updated_by        TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(agent_id, item_key)
);

CREATE INDEX idx_compliance_checklist_agent ON compliance_checklist(agent_id);

CREATE TABLE IF NOT EXISTS compliance_reports (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT,
  report_type     TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  generated_by    TEXT NOT NULL,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  period_from     TEXT,
  period_to       TEXT
);

CREATE INDEX idx_compliance_reports_agent ON compliance_reports(agent_id);
CREATE INDEX idx_compliance_reports_type ON compliance_reports(report_type);
```

Adicionar migração no startup do backbone.

### Feature F-150: ComplianceManager — classificação + checklist

**Nova estrutura:**

```
src/compliance/
  index.ts                # ComplianceManager: inicialização, registro de checklist items padrão
  classification.ts       # CRUD de classificação de risco
  checklist.ts            # CRUD e avaliação de checklist
  reports.ts              # Geração de relatórios
  decision-explainer.ts   # Explicação de decisão a partir de trace timeline
  schemas.ts              # Zod schemas
```

**Classificação de risco:** Ao classificar um agente (high/limited/minimal), o sistema cria automaticamente os items de checklist baseados no nível:

- **High-risk** (10 items): human_oversight, human_oversight_logs, decision_transparency, instruction_versioning, data_documentation, risk_assessment, dpia_completed, kill_switch (S-041), audit_trail, incident_response
- **Limited-risk** (4 items): transparency_notice, decision_transparency, instruction_versioning, data_documentation
- **Minimal-risk** (1 item): transparency_notice

Reclassificação atualiza o checklist (adiciona/remove items conforme novo nível).

### Feature F-151: Decision Explainer + geração de relatórios

**Decision Explainer:** Usa trace timeline existente (Sprint 3, S-015) para gerar explicação legível de decisão do agente:

```typescript
interface DecisionExplanation {
  traceId: string
  agentId: string
  timestamp: string
  input: string
  decision: string
  reasoning: string
  toolsUsed: string[]
  instructionVersion: string
  memoryContext: string[]
  humanApproval?: {
    required: boolean
    approved: boolean
    approvedBy: string
    approvedAt: string
  }
}
```

**Geração de relatórios:** Tipos suportados: `audit`, `dpia`, `human_oversight`, `decision_explanation`. Relatórios gerados em JSON estruturado (preparado para PDF em sprint futuro). Relatório de auditoria inclui: decisões do agente com explicação, logs de HITL, versões de instruções usadas.

**Template DPIA:** Pré-preenchido com dados do agente (classificação, tools utilizadas, dados processados, supervisão humana).

### Feature F-152: API endpoints compliance

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/agents/:id/compliance` | Visão completa de conformidade do agente |
| GET | `/agents/:id/compliance/classification` | Classificação de risco atual |
| PUT | `/agents/:id/compliance/classification` | Atualizar classificação de risco |
| GET | `/agents/:id/compliance/checklist` | Items do checklist com status |
| PUT | `/agents/:id/compliance/checklist/:itemKey` | Atualizar status de item |
| POST | `/agents/:id/compliance/reports` | Gerar relatório |
| GET | `/agents/:id/compliance/reports` | Listar relatórios gerados |
| GET | `/agents/:id/compliance/reports/:reportId` | Detalhes de um relatório |
| POST | `/agents/:id/compliance/explain` | Gerar explicação de decisão |
| GET | `/compliance/overview` | Visão geral de todos os agentes |
| GET | `/compliance/dpia-template` | Template de DPIA pré-preenchido |

**PUT `/agents/:id/compliance/classification` — Request:**

```json
{
  "riskLevel": "high",
  "riskJustification": "Agente de atendimento que processa dados pessoais e toma decisões automatizadas.",
  "reviewDueAt": "2026-09-01"
}
```

**GET `/compliance/overview` — Response:**

```json
{
  "totalAgents": 12,
  "byRiskLevel": { "high": 3, "limited": 5, "minimal": 4 },
  "complianceRate": 0.78,
  "nonCompliantItems": [
    { "agentId": "system.atendimento", "itemKey": "dpia_completed", "category": "documentation" }
  ],
  "pendingReviews": [
    { "agentId": "system.vendas", "reviewDueAt": "2026-04-01" }
  ]
}
```

### Feature F-153: Hub — painel /compliance + compliance do agente

**`/compliance` — Painel de Conformidade:**

- Overview cards: total de agentes por nível de risco, taxa de conformidade geral
- Tabela de agentes: nível de risco, % checklist completo, próxima revisão, badge de status
- Alertas: items não-conformes, revisões vencidas
- Botão "Gerar Relatório de Sistema"

**`/agents/:id/compliance` — Compliance do Agente:**

- Classificação de risco: selector high/limited/minimal com justificativa
- Checklist interativo: items agrupados por categoria, toggle de status, campo de evidência
- Barra de progresso do checklist por categoria
- Lista de relatórios gerados + botão "Gerar Novo Relatório" (tipo + período)
- Explicabilidade: busca por trace → explicação de decisão em linguagem natural

**Integração com LGPD Dashboard (`/compliance/lgpd`):**

- Link bidirecional entre painéis
- Items compartilhados (data_documentation) sincronizados
- Relatório combinado EU AI Act + LGPD disponível

## Limites

- **NÃO** implementar export PDF neste PRP (JSON estruturado apenas — PDF em sprint futuro)
- **NÃO** implementar conformidade para outras jurisdições além de EU AI Act e LGPD
- **NÃO** implementar classificação automática de risco (apenas manual com assistência)

## Dependencias

- **PRP-42** (Kill-switch + Circuit-breaker) deve estar implementado — item `kill_switch` do checklist high-risk depende dele
- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- **PRP-03** (Gestão de Agentes) deve estar implementado
- LGPD Compliance Dashboard (Sprint 5, S-026) deve estar implementado — integração bidirecional
- HITL/Approvals (Sprint 4, S-020) deve estar implementado — logs de supervisão humana
- Trace Timeline (Sprint 3, S-015) deve estar implementado — decision explainer

## Validacao

- [ ] Classificação de risco (high/limited/minimal) pode ser definida por agente com justificativa
- [ ] Checklist gerado automaticamente com items correspondentes ao nível de risco
- [ ] Items do checklist podem ser atualizados com status e evidência
- [ ] Relatório de auditoria inclui: decisões com explicação, logs de HITL, versões de instruções
- [ ] Decision Explainer gera explicação legível a partir de trace timeline
- [ ] Template de DPIA pré-preenchido baseado no agente
- [ ] Painel `/compliance` mostra visão consolidada de todos os agentes
- [ ] Items compartilhados com LGPD Dashboard sincronizados
- [ ] Revisões vencidas geram alerta visual no Hub
- [ ] `npm run build` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-149 Tabelas compliance + migração | S-042 sec 2 | D-063 |
| F-150 ComplianceManager (classificação + checklist) | S-042 sec 3.1-3.2 | D-063, G-063 |
| F-151 Decision Explainer + relatórios | S-042 sec 3.3 | G-063 |
| F-152 API endpoints compliance | S-042 sec 4 | G-063 |
| F-153 Hub compliance painel + agente | S-042 sec 5 | G-063 |
