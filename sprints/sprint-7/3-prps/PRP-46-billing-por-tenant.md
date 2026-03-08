# PRP-46 — Billing e Invoicing por Tenant

Relatório de consumo detalhado por tenant com cálculo de custo, markup configurável, geração de invoice e export CSV. Permite que agências transformem custo de infraestrutura em linha de receita com dashboard de rentabilidade.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O dashboard de custos granular (Sprint 3, S-013) exibe consumo por agente e modelo, mas não agrega por tenant (owner). Não existe markup configurável, geração de invoice, export CSV nem consolidação mensal. Agências não conseguem faturar automaticamente seus clientes pelo uso dos agentes.

### Estado desejado

1. Tabelas `billing_config`, `tenant_billing`, `tenant_billing_detail`, `tenant_markup_override` no SQLite
2. Módulo `src/billing/` com consolidação mensal, invoice JSON, export CSV
3. API REST para billing (config, tenants, invoice, export, rentabilidade)
4. Consolidação automática via cron interno (dia 1 de cada mês)
5. Páginas `/billing`, `/billing/tenants/:id` e `/billing/config` no Hub

## Especificacao

### Feature F-161: Tabelas billing + migração DB

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS billing_config (
  id                  TEXT PRIMARY KEY DEFAULT 'default',
  currency            TEXT NOT NULL DEFAULT 'BRL',
  default_markup_pct  REAL NOT NULL DEFAULT 0.0,
  agency_name         TEXT,
  agency_document     TEXT,
  agency_address      TEXT,
  agency_bank_info    TEXT,
  agency_logo_url     TEXT,
  invoice_footer      TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_billing (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  period_year         INTEGER NOT NULL,
  period_month        INTEGER NOT NULL,
  tokens_input        INTEGER NOT NULL DEFAULT 0,
  tokens_output       INTEGER NOT NULL DEFAULT 0,
  tokens_total        INTEGER NOT NULL DEFAULT 0,
  cost_base           REAL NOT NULL DEFAULT 0.0,
  markup_pct          REAL NOT NULL DEFAULT 0.0,
  cost_with_markup    REAL NOT NULL DEFAULT 0.0,
  status              TEXT NOT NULL DEFAULT 'draft',
  finalized_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, period_year, period_month)
);

CREATE INDEX idx_tenant_billing_tenant ON tenant_billing(tenant_id);
CREATE INDEX idx_tenant_billing_period ON tenant_billing(period_year, period_month);

CREATE TABLE IF NOT EXISTS tenant_billing_detail (
  id                  TEXT PRIMARY KEY,
  billing_id          TEXT NOT NULL REFERENCES tenant_billing(id) ON DELETE CASCADE,
  agent_id            TEXT NOT NULL,
  agent_label         TEXT NOT NULL,
  model               TEXT NOT NULL,
  operation_type      TEXT NOT NULL,
  tokens_input        INTEGER NOT NULL DEFAULT 0,
  tokens_output       INTEGER NOT NULL DEFAULT 0,
  tokens_total        INTEGER NOT NULL DEFAULT 0,
  cost_base           REAL NOT NULL DEFAULT 0.0,
  invocations         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_billing_detail_billing ON tenant_billing_detail(billing_id);
CREATE INDEX idx_billing_detail_agent ON tenant_billing_detail(agent_id);

CREATE TABLE IF NOT EXISTS tenant_markup_override (
  tenant_id           TEXT PRIMARY KEY,
  markup_pct          REAL NOT NULL,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Adicionar migração no startup do backbone.

### Feature F-162: BillingManager — consolidação, invoice, export CSV

**Nova estrutura:**

```
src/billing/
  index.ts            # BillingManager: inicialização, registro de cron de consolidação
  config.ts           # CRUD de billing_config
  consolidator.ts     # Consolida dados de custo existentes em tenant_billing
  invoice.ts          # Geração de invoice (JSON estruturado)
  export.ts           # Export CSV
  schemas.ts          # Zod schemas
```

**Consolidação mensal (`consolidator.ts`):**

Para cada owner (tenant): soma tokens por agente, modelo e tipo de operação; calcula custo base usando pricing do modelo (existente em settings); aplica markup (override do tenant > default da config); upsert em `tenant_billing` + `tenant_billing_detail`.

Executado automaticamente via cron interno: dia 1 de cada mês às 02:00 (consolida mês anterior). Pode ser disparado manualmente via API para qualquer mês.

**Invoice (`invoice.ts`):**

Gera JSON estruturado com dados da agência (logo, CNPJ, dados bancários), breakdown por agente/modelo, totais com markup. Preparado para renderização PDF em sprint futuro.

```typescript
interface Invoice {
  invoiceNumber: string           // YYYYMM-TENANT_SLUG
  period: { year: number; month: number }
  agency: { name: string; document: string; address: string; bankInfo: string; logoUrl: string }
  tenant: { id: string; name: string }
  items: Array<{ agentLabel: string; model: string; tokensTotal: number; costBase: number; costWithMarkup: number }>
  totals: { tokensTotal: number; costBase: number; markupPct: number; costWithMarkup: number }
  footer: string
  generatedAt: string
}
```

**Export CSV (`export.ts`):**

Colunas: tenant, agente, modelo, operação, tokens_input, tokens_output, tokens_total, custo_base, markup_pct, custo_final, invocações.

### Feature F-163: API endpoints billing

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/billing/config` | Configuração de billing da agência |
| PUT | `/billing/config` | Atualizar configuração |
| GET | `/billing/tenants` | Lista de tenants com resumo mensal |
| GET | `/billing/tenants/:tenantId` | Detalhes de consumo do tenant |
| GET | `/billing/tenants/:tenantId/months/:year/:month` | Detalhes de um mês |
| POST | `/billing/tenants/:tenantId/months/:year/:month/finalize` | Finalizar faturamento |
| GET | `/billing/tenants/:tenantId/invoice/:year/:month` | Gerar invoice JSON |
| GET | `/billing/tenants/:tenantId/export/:year/:month` | Export CSV do mês |
| POST | `/billing/consolidate` | Disparar consolidação manual |
| GET | `/billing/tenants/:tenantId/markup` | Markup override do tenant |
| PUT | `/billing/tenants/:tenantId/markup` | Definir markup override |
| GET | `/billing/profitability` | Dashboard de rentabilidade |

**GET `/billing/tenants` — Query params:** `year`, `month` (default: mês atual)

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

**GET `/billing/profitability` — Query params:** `months` (default: 6)

**Response:**

```json
{
  "months": [
    { "year": 2026, "month": 1, "totalCostBase": 234.56, "totalRevenue": 328.38, "totalProfit": 93.82, "marginPct": 0.40, "tenants": 8 }
  ],
  "totals": { "costBase": 1407.36, "revenue": 1970.30, "profit": 562.94, "avgMarginPct": 0.40 }
}
```

### Feature F-164: Hub — painel /billing + detalhes + config

**`/billing` — Painel de Faturamento:**

- Cards de resumo: Receita do Mês, Custo Base, Lucro, Margem Média
- Tabela de tenants: nome, tokens, custo base, markup, custo final, status (draft/finalizado/exportado)
- Gráfico de tendência: custo vs. receita nos últimos 6 meses (bar chart)
- Selector de mês/ano para navegar entre períodos

**`/billing/tenants/:tenantId` — Detalhes do Tenant:**

- Resumo do mês: tokens, custo, markup, total
- Breakdown por agente: tabela com agente, modelo, tokens, custo, invocações
- Comparativo: mês atual vs. anterior (delta % por agente)
- Ações: Finalizar mês, Gerar Invoice, Exportar CSV
- Campo de markup override específico para o tenant

**`/billing/config` — Configuração da Agência:**

- Campos: Nome, CNPJ, Endereço, Dados bancários, Logo (upload)
- Markup padrão (slider 0-100%)
- Texto customizado do rodapé da invoice
- Moeda (BRL)

## Limites

- **NÃO** implementar export PDF de invoice (apenas JSON estruturado — PDF em sprint futuro)
- **NÃO** implementar integração direta com ERPs ou NFS-e (apenas export CSV)
- **NÃO** implementar multi-currency (apenas BRL nesta versão)
- **NÃO** implementar cobrança automatizada ou gateway de pagamento

## Dependencias

- **PRP-01** (Scaffold Backbone + Hub) deve estar implementado
- Dashboard de custos granular (Sprint 3, S-013) deve estar implementado — fonte de dados de consumo
- Gestão de usuários (Sprint 2, S-010) deve estar implementado — owners como tenants

## Validacao

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
- [ ] `npm run build` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-161 Tabelas billing + migração | S-045 sec 2 | D-066 |
| F-162 BillingManager (consolidação, invoice, CSV) | S-045 sec 3 | D-066, G-066 |
| F-163 API endpoints billing | S-045 sec 4 | G-066 |
| F-164 Hub billing painel + detalhes + config | S-045 sec 5 | G-066 |
