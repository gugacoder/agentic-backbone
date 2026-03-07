# S-026 — LGPD Compliance Dashboard

Dashboard de conformidade LGPD integrado ao Hub: mapa de dados pessoais processados por agente, canal de exercicio de direitos de titulares, log de consentimentos e relatorio exportavel.

**Resolve:** D-042 (conformidade LGPD sem ferramentas), G-043 (LGPD Compliance Assistant)
**Score de prioridade:** 9

---

## 1. Objetivo

- Mapear automaticamente quais dados pessoais cada agente processa (via analise de conversas)
- Prover canal de exercicio de direitos de titulares (acesso, correcao, exclusao — LGPD Art. 18)
- Registrar logs de consentimento por usuario/canal
- Gerar relatorio PDF/JSON exportavel para demonstracao de conformidade a ANPD ou clientes enterprise

---

## 2. Schema DB

### 2.1 Tabela `lgpd_data_map`

```sql
CREATE TABLE IF NOT EXISTS lgpd_data_map (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id    TEXT NOT NULL,
  data_type   TEXT NOT NULL,   -- 'name' | 'email' | 'phone' | 'cpf' | 'address' | 'custom'
  label       TEXT NOT NULL,   -- descricao legivel
  purpose     TEXT NOT NULL,   -- finalidade do processamento
  legal_basis TEXT NOT NULL,   -- 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest'
  retention_days INTEGER,      -- prazo de retencao em dias (null = indefinido)
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_lgpd_map_agent_type ON lgpd_data_map(agent_id, data_type);
```

### 2.2 Tabela `lgpd_consent_log`

```sql
CREATE TABLE IF NOT EXISTS lgpd_consent_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id     TEXT NOT NULL,
  channel_id   TEXT NOT NULL,
  user_ref     TEXT NOT NULL,  -- identificador do titular (phone, email, etc.)
  action       TEXT NOT NULL,  -- 'granted' | 'withdrawn'
  purpose      TEXT NOT NULL,
  ip_address   TEXT,
  recorded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lgpd_consent_agent ON lgpd_consent_log(agent_id);
CREATE INDEX idx_lgpd_consent_user ON lgpd_consent_log(user_ref);
```

### 2.3 Tabela `lgpd_rights_requests`

```sql
CREATE TABLE IF NOT EXISTS lgpd_rights_requests (
  id           TEXT PRIMARY KEY,    -- uuid v4
  user_ref     TEXT NOT NULL,       -- identificador do titular
  right_type   TEXT NOT NULL,       -- 'access' | 'correction' | 'deletion' | 'portability' | 'opposition'
  agent_id     TEXT,                -- se nulo, aplica a todos os agentes
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'in_progress' | 'completed' | 'rejected'
  response     TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at  TEXT
);

CREATE INDEX idx_lgpd_rights_user ON lgpd_rights_requests(user_ref);
CREATE INDEX idx_lgpd_rights_status ON lgpd_rights_requests(status);
```

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/lgpd/data-map` | Mapa completo de dados pessoais (todos os agentes) |
| GET | `/lgpd/data-map/:agentId` | Mapa de dados de um agente especifico |
| PUT | `/lgpd/data-map/:agentId` | Atualizar/configurar mapa de dados do agente |
| GET | `/lgpd/consent-log` | Historico de consentimentos (filtros: agentId, userRef, dateRange) |
| GET | `/lgpd/rights-requests` | Listar pedidos de direitos (filtros: status, right_type) |
| POST | `/lgpd/rights-requests` | Registrar novo pedido de titular |
| PATCH | `/lgpd/rights-requests/:id` | Atualizar status/resposta de pedido |
| POST | `/lgpd/report` | Gerar relatorio de conformidade (retorna JSON ou dispara PDF) |

### 3.1 GET `/lgpd/data-map` — Response

```json
{
  "agents": [
    {
      "agentId": "system.main",
      "agentLabel": "Assistente Principal",
      "dataTypes": [
        {
          "dataType": "phone",
          "label": "Numero de telefone",
          "purpose": "Identificacao do usuario no canal WhatsApp",
          "legalBasis": "contract",
          "retentionDays": 365
        }
      ]
    }
  ]
}
```

### 3.2 POST `/lgpd/rights-requests` — Body

```json
{
  "userRef": "+5511999999999",
  "rightType": "deletion",
  "agentId": "system.main",
  "description": "Solicito exclusao de todos os meus dados e historico de conversas"
}
```

### 3.3 POST `/lgpd/report` — Response

```json
{
  "generatedAt": "2026-03-07T15:00:00Z",
  "summary": {
    "totalAgents": 3,
    "totalDataTypes": 7,
    "openRightsRequests": 2,
    "consentLogs": 142
  },
  "dataMap": [...],
  "rightsRequests": [...],
  "consentLog": [...]
}
```

---

## 4. Telas (Hub)

### 4.1 `/lgpd` — Dashboard Principal

- Cards de resumo: N agentes mapeados, N tipos de dados, N pedidos abertos, Ultima atualizacao
- Tabela "Mapa de Dados" por agente: expandivel, mostra data_type, finalidade, base legal, retencao
- Botao "Editar mapa" por agente (abre modal de configuracao)
- Botao "Exportar relatorio" (gera JSON download)

### 4.2 `/lgpd/rights-requests`

- Lista de pedidos: Titular, Tipo de direito (badge), Agente, Status (badge), Data
- Filtros: status, tipo de direito
- Botao "Novo pedido" (para registrar pedido recebido por fora)
- Modal de detalhes: exibe descricao + campo de resposta + botao para mudar status

### 4.3 `/lgpd/consent-log`

- Tabela: Titular, Agente, Canal, Acao (concedido/revogado), Finalidade, Data
- Filtros: agente, canal, periodo

### 4.4 Modal "Configurar Mapa de Dados" (por agente)

- Lista editavel de tipos de dados coletados
- Campos por tipo: data_type (select), label, finalidade (textarea), base legal (select), retencao (numero + "dias" ou "indefinido")
- Botao "Adicionar tipo de dado"

---

## 5. Criterios de Aceite

- [ ] Dashboard exibe mapa de dados de todos os agentes configurados
- [ ] Operador consegue cadastrar e editar tipos de dados processados por agente
- [ ] Pedido de exercicio de direito pode ser registrado, atualizado e respondido via GUI
- [ ] Log de consentimento e consultavel por titular e por agente
- [ ] Export de relatorio JSON contem mapa, pedidos e log no mesmo payload
- [ ] Pagina `/lgpd` e acessivel somente por usuarios com permissao `admin` ou `compliance`
- [ ] Status de pedidos e atualizado com timestamp de resolucao
