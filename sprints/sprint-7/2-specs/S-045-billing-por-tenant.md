# S-045 — Billing e Invoicing por Tenant

Relatório de consumo detalhado por tenant com cálculo de custo, markup configurável, geração de invoice e export CSV para sistemas de faturamento externos. Permite que agências transformem custo de infraestrutura em linha de receita.

**Resolve:** D-066 (sem billing por tenant para agências), G-066 (Billing e Invoicing por Tenant)
**Score de prioridade:** 8
**Dependência:** Dashboard de custos granular existente (Sprint 3, S-013), gestão de usuários (Sprint 2, S-010)

---

## 1. Objetivo

- Relatório de consumo detalhado por tenant (owner): tokens por modelo, por agente, por operação
- Custo calculado com markup configurável pela agência (ex: custo base + 40%)
- Geração de invoice com dados da agência (logo, CNPJ, dados bancários — white-label)
- Export CSV para sistemas de faturamento externos (ERP, NFS-e)
- Histórico mensal por tenant com comparativo mês a mês
- Dashboard de rentabilidade: custo de infraestrutura vs. receita por cliente

---

## 2. Schema DB

### 2.1 Tabela `billing_config`

```sql
CREATE TABLE IF NOT EXISTS billing_config (
  id                  TEXT PRIMARY KEY DEFAULT 'default',
  currency            TEXT NOT NULL DEFAULT 'BRL',
  default_markup_pct  REAL NOT NULL DEFAULT 0.0,       -- markup padrão (ex: 0.40 = 40%)
  agency_name         TEXT,
  agency_document     TEXT,                             -- CNPJ
  agency_address      TEXT,
  agency_bank_info    TEXT,                             -- dados bancários (texto livre)
  agency_logo_url     TEXT,                             -- URL ou path para logo
  invoice_footer      TEXT,                             -- texto customizado no rodapé
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.2 Tabela `tenant_billing`

```sql
CREATE TABLE IF NOT EXISTS tenant_billing (
  id                  TEXT PRIMARY KEY,                 -- uuid v4
  tenant_id           TEXT NOT NULL,                    -- owner slug (= user slug)
  period_year         INTEGER NOT NULL,
  period_month        INTEGER NOT NULL,                 -- 1-12
  tokens_input        INTEGER NOT NULL DEFAULT 0,
  tokens_output       INTEGER NOT NULL DEFAULT 0,
  tokens_total        INTEGER NOT NULL DEFAULT 0,
  cost_base           REAL NOT NULL DEFAULT 0.0,        -- custo real (USD convertido)
  markup_pct          REAL NOT NULL DEFAULT 0.0,
  cost_with_markup    REAL NOT NULL DEFAULT 0.0,        -- cost_base * (1 + markup_pct)
  status              TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'finalized' | 'exported'
  finalized_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, period_year, period_month)
);

CREATE INDEX idx_tenant_billing_tenant ON tenant_billing(tenant_id);
CREATE INDEX idx_tenant_billing_period ON tenant_billing(period_year, period_month);
```

### 2.3 Tabela `tenant_billing_detail`

```sql
CREATE TABLE IF NOT EXISTS tenant_billing_detail (
  id                  TEXT PRIMARY KEY,                 -- uuid v4
  billing_id          TEXT NOT NULL REFERENCES tenant_billing(id) ON DELETE CASCADE,
  agent_id            TEXT NOT NULL,
  agent_label         TEXT NOT NULL,
  model               TEXT NOT NULL,
  operation_type      TEXT NOT NULL,                    -- 'chat' | 'heartbeat' | 'cron' | 'tool_call'
  tokens_input        INTEGER NOT NULL DEFAULT 0,
  tokens_output       INTEGER NOT NULL DEFAULT 0,
  tokens_total        INTEGER NOT NULL DEFAULT 0,
  cost_base           REAL NOT NULL DEFAULT 0.0,
  invocations         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_billing_detail_billing ON tenant_billing_detail(billing_id);
CREATE INDEX idx_billing_detail_agent ON tenant_billing_detail(agent_id);
```

### 2.4 Tabela `tenant_markup_override`

```sql
CREATE TABLE IF NOT EXISTS tenant_markup_override (
  tenant_id           TEXT PRIMARY KEY,
  markup_pct          REAL NOT NULL,                    -- override do markup padrão para este tenant
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. Módulo `src/billing/`

### 3.1 Estrutura

```
src/billing/
  index.ts            # BillingManager: inicialização, jobs de consolidação
  config.ts           # CRUD de billing_config
  consolidator.ts     # Consolida dados de custo existentes em tenant_billing
  invoice.ts          # Geração de invoice (JSON estruturado, preparado para PDF)
  export.ts           # Export CSV
  schemas.ts          # Zod schemas
```

### 3.2 Consolidação Mensal

O `consolidator.ts` agrega dados do dashboard de custos existente (Sprint 3) por tenant:

```typescript
async function consolidateMonth(year: number, month: number): Promise<void> {
  // Para cada owner (tenant):
  //   1. Soma tokens por agente, modelo e tipo de operação
  //   2. Calcula custo base usando pricing do modelo (existente no settings)
  //   3. Aplica markup (override do tenant > default da config)
  //   4. Upsert em tenant_billing + tenant_billing_detail
}
```

Executado automaticamente via cron interno: dia 1 de cada mês às 02:00 (consolida mês anterior). Pode ser disparado manualmente via API.

### 3.3 Invoice

Estrutura JSON do invoice (renderização para PDF delegada ao módulo de export de relatórios — backlog D-068):

```typescript
interface Invoice {
  invoiceNumber: string           // YYYYMM-TENANT_SLUG
  period: { year: number; month: number }
  agency: {
    name: string
    document: string
    address: string
    bankInfo: string
    logoUrl: string
  }
  tenant: {
    id: string
    name: string
  }
  items: Array<{
    agentLabel: string
    model: string
    tokensTotal: number
    costBase: number
    costWithMarkup: number
  }>
  totals: {
    tokensTotal: number
    costBase: number
    markupPct: number
    costWithMarkup: number
  }
  footer: string
  generatedAt: string
}
```

---

## 4. API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/billing/config` | Configuração de billing da agência |
| PUT | `/billing/config` | Atualizar configuração de billing |
| GET | `/billing/tenants` | Lista de tenants com resumo de consumo mensal |
| GET | `/billing/tenants/:tenantId` | Detalhes de consumo do tenant |
| GET | `/billing/tenants/:tenantId/months/:year/:month` | Detalhes de um mês específico |
| POST | `/billing/tenants/:tenantId/months/:year/:month/finalize` | Finalizar faturamento do mês |
| GET | `/billing/tenants/:tenantId/invoice/:year/:month` | Gerar invoice JSON |
| GET | `/billing/tenants/:tenantId/export/:year/:month` | Export CSV do mês |
| POST | `/billing/consolidate` | Disparar consolidação manual |
| GET | `/billing/tenants/:tenantId/markup` | Markup override do tenant |
| PUT | `/billing/tenants/:tenantId/markup` | Definir markup override do tenant |
| GET | `/billing/profitability` | Dashboard de rentabilidade |

### 4.1 GET `/billing/tenants`

**Query params:** `year`, `month` (default: mês atual)

**Response:**
```json
{
  "period": { "year": 2026, "month": 3 },
  "tenants": [
    {
      "tenantId": "cliente-abc",
      "tenantName": "Cliente ABC Ltda",
      "tokensTotal": 1234567,
      "costBase": 12.34,
      "markupPct": 0.40,
      "costWithMarkup": 17.28,
      "status": "draft",
      "agents": 5
    }
  ]
}
```

### 4.2 GET `/billing/profitability`

**Query params:** `months` (default: 6 — últimos 6 meses)

**Response:**
```json
{
  "months": [
    {
      "year": 2026,
      "month": 1,
      "totalCostBase": 234.56,
      "totalRevenue": 328.38,
      "totalProfit": 93.82,
      "marginPct": 0.40,
      "tenants": 8
    }
  ],
  "totals": {
    "costBase": 1407.36,
    "revenue": 1970.30,
    "profit": 562.94,
    "avgMarginPct": 0.40
  }
}
```

---

## 5. Telas (Hub)

### 5.1 `/billing` — Painel de Faturamento

- **Cards de resumo**: Receita do Mês, Custo Base, Lucro, Margem Média
- **Tabela de tenants**: nome, tokens, custo base, markup, custo final, status (draft/finalizado/exportado)
- **Gráfico de tendência**: custo vs. receita nos últimos 6 meses (bar chart)
- **Selector de mês/ano** para navegar entre períodos

### 5.2 `/billing/tenants/:tenantId` — Detalhes do Tenant

- **Resumo do mês**: tokens, custo, markup, total
- **Breakdown por agente**: tabela com agente, modelo, tokens, custo, invocações
- **Comparativo**: mês atual vs. mês anterior (delta % por agente)
- **Ações**: Finalizar mês, Gerar Invoice, Exportar CSV
- **Campo de markup override** específico para este tenant

### 5.3 `/billing/config` — Configuração da Agência

- Campos: Nome da agência, CNPJ, Endereço, Dados bancários, Logo (upload)
- Markup padrão (slider 0-100%)
- Texto customizado do rodapé da invoice
- Moeda (BRL)

---

## 6. Critérios de Aceite

- [ ] Consolidação mensal agrega tokens e custos por tenant/agente/modelo/operação corretamente
- [ ] Markup padrão aplicado a todos os tenants; override por tenant funciona
- [ ] Invoice JSON gerado com dados da agência e breakdown por agente
- [ ] Export CSV contém: tenant, agente, modelo, operação, tokens, custo base, markup, custo final
- [ ] Consolidação automática executa no dia 1 de cada mês
- [ ] Consolidação manual via API funciona para qualquer mês
- [ ] Dashboard de rentabilidade exibe custo vs. receita com tendência
- [ ] Status de faturamento (draft/finalized/exported) rastreado por tenant/mês
- [ ] Comparativo mês a mês exibe deltas por agente
- [ ] Múltiplos tenants coexistem com markups diferentes
