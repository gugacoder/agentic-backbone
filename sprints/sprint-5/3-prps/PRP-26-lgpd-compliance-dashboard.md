# PRP-26 — LGPD Compliance Dashboard

Dashboard de conformidade LGPD integrado ao Hub: mapa de dados pessoais processados por agente, canal de exercicio de direitos de titulares (Art. 18), log de consentimentos e relatorio exportavel em JSON.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O backbone nao possui nenhum mecanismo de conformidade LGPD. Nao ha mapa de dados pessoais, log de consentimentos nem canal para exercicio de direitos de titulares. Nao ha tabelas relacionadas no SQLite.

### Estado desejado

1. Tabelas `lgpd_data_map`, `lgpd_consent_log` e `lgpd_rights_requests` no SQLite
2. Endpoints para gerenciar mapa de dados, log de consentimento, pedidos de direitos e gerar relatorio
3. Paginas `/lgpd`, `/lgpd/rights-requests` e `/lgpd/consent-log` no Hub
4. Acesso restrito a usuarios com permissao `admin` ou `compliance`

## Especificacao

### Feature F-101: Tabelas LGPD + migracao DB

**Novas tabelas em `apps/backbone/src/db/`:**

```sql
CREATE TABLE IF NOT EXISTS lgpd_data_map (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id       TEXT NOT NULL,
  data_type      TEXT NOT NULL,
  label          TEXT NOT NULL,
  purpose        TEXT NOT NULL,
  legal_basis    TEXT NOT NULL,
  retention_days INTEGER,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_lgpd_map_agent_type ON lgpd_data_map(agent_id, data_type);

CREATE TABLE IF NOT EXISTS lgpd_consent_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  user_ref    TEXT NOT NULL,
  action      TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  ip_address  TEXT,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lgpd_consent_agent ON lgpd_consent_log(agent_id);
CREATE INDEX idx_lgpd_consent_user ON lgpd_consent_log(user_ref);

CREATE TABLE IF NOT EXISTS lgpd_rights_requests (
  id           TEXT PRIMARY KEY,
  user_ref     TEXT NOT NULL,
  right_type   TEXT NOT NULL,
  agent_id     TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  response     TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);
CREATE INDEX idx_lgpd_rights_user ON lgpd_rights_requests(user_ref);
CREATE INDEX idx_lgpd_rights_status ON lgpd_rights_requests(status);
```

Adicionar migracao no startup do backbone.

### Feature F-102: Endpoints LGPD

**Novas rotas em `apps/backbone/src/routes/lgpd.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/lgpd/data-map` | Mapa completo (todos os agentes) |
| GET | `/lgpd/data-map/:agentId` | Mapa de um agente |
| PUT | `/lgpd/data-map/:agentId` | Atualizar/configurar mapa do agente |
| GET | `/lgpd/consent-log` | Historico (filtros: agentId, userRef, dateRange) |
| GET | `/lgpd/rights-requests` | Listar pedidos (filtros: status, right_type) |
| POST | `/lgpd/rights-requests` | Registrar novo pedido de titular |
| PATCH | `/lgpd/rights-requests/:id` | Atualizar status/resposta de pedido |
| POST | `/lgpd/report` | Gerar relatorio de conformidade (JSON) |

Montar rotas no `index.ts` do backbone com middleware de verificacao de permissao (`admin` ou `compliance`).

**Hub — `apps/hub/src/api/lgpd.ts`:**

```typescript
export const lgpdDataMapQueryOptions = () =>
  queryOptions({
    queryKey: ["lgpd-data-map"],
    queryFn: () => request<LgpdDataMap>("/lgpd/data-map"),
  });

export const lgpdRightsRequestsQueryOptions = (filters?: RightsRequestFilters) =>
  queryOptions({
    queryKey: ["lgpd-rights-requests", filters],
    queryFn: () => request<RightsRequest[]>("/lgpd/rights-requests", { params: filters }),
  });
```

### Feature F-103: Telas Hub — dashboard LGPD, pedidos de direitos, log de consentimento

**Novas rotas Hub:**

| Rota | Componente |
|------|------------|
| `/lgpd` | Dashboard principal |
| `/lgpd/rights-requests` | Lista de pedidos de direitos |
| `/lgpd/consent-log` | Log de consentimentos |

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `LgpdDashboard` | `routes/_authenticated/lgpd/index.tsx` |
| `LgpdRightsRequests` | `routes/_authenticated/lgpd/rights-requests.tsx` |
| `LgpdConsentLog` | `routes/_authenticated/lgpd/consent-log.tsx` |
| `DataMapTable` | `components/lgpd/data-map-table.tsx` |
| `DataMapEditDialog` | `components/lgpd/data-map-edit-dialog.tsx` |
| `RightsRequestDialog` | `components/lgpd/rights-request-dialog.tsx` |

**Dashboard (`/lgpd`):**
- 4 cards de resumo: N agentes mapeados, N tipos de dados, N pedidos abertos, Ultima atualizacao
- Tabela "Mapa de Dados" por agente: expandivel por agente, colunas data_type, finalidade, base legal, retencao
- Botao "Editar mapa" por agente (abre DataMapEditDialog)
- Botao "Exportar relatorio" (gera download JSON)

**DataMapEditDialog:** lista editavel de tipos de dados; campos por tipo: data_type (select: name/email/phone/cpf/address/custom), label, finalidade (textarea), base legal (select: consent/contract/legal_obligation/legitimate_interest), retencao (numero + "dias" ou "indefinido"); botao "Adicionar tipo de dado".

**Pedidos de Direitos (`/lgpd/rights-requests`):**
- Lista: Titular, Tipo de direito (badge), Agente, Status (badge), Data
- Filtros: status, tipo de direito
- Botao "Novo pedido"
- Modal de detalhes: descricao + campo de resposta + botao para mudar status com `resolved_at`

**Log de Consentimento (`/lgpd/consent-log`):**
- Tabela: Titular, Agente, Canal, Acao (concedido/revogado badge), Finalidade, Data
- Filtros: agente, canal, periodo

## Limites

- **NAO** implementar analise automatica de conversas para detectar dados pessoais (mapa e configurado manualmente pelo operador)
- **NAO** implementar notificacao automatica ao titular (pedidos sao respondidos via GUI)
- **NAO** gerar PDF (apenas export JSON conforme S-026; PDF e tratado em PRP-33)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-02** (Auth/Usuarios) deve estar implementado — verificacao de permissao `admin`/`compliance`

## Validacao

- [ ] Dashboard exibe mapa de dados de todos os agentes configurados
- [ ] Operador consegue cadastrar e editar tipos de dados processados por agente
- [ ] Pedido de exercicio de direito pode ser registrado, atualizado e respondido via GUI
- [ ] Log de consentimento e consultavel por titular e por agente
- [ ] Export JSON contem mapa, pedidos e log no mesmo payload
- [ ] Pagina `/lgpd` e acessivel somente por usuarios com permissao `admin` ou `compliance`
- [ ] Status de pedido atualizado com `resolved_at` ao ser resolvido
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-101 Tabelas LGPD + DB | S-026 sec 2 | D-042 |
| F-102 Endpoints LGPD | S-026 sec 3 | D-042, G-043 |
| F-103 Telas Hub LGPD | S-026 sec 4 | G-043 |
