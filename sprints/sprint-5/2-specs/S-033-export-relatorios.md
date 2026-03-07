# S-033 — Export de Relatorios (PDF e CSV)

Exportacao de dados do Hub em formatos PDF e CSV: historico de conversas, metricas de custo por agente/periodo, analytics de tendencia e eval scores.

**Resolve:** D-046 (relatorios manuais com screenshots), G-047 (export PDF/CSV)
**Score de prioridade:** 7

---

## 1. Objetivo

- Exportar dados existentes do Hub em formatos consumiveis por stakeholders e auditores
- Suporte a PDF (relatorio formatado) e CSV (dados brutos para analise)
- Tipos de relatorio: conversas, custos, analytics, eval scores
- Filtros por agente, periodo e canal
- Download direto pelo navegador (sem email ou fila de processamento)

---

## 2. Sem Schema DB Adicional

Relatorios sao gerados on-demand a partir de dados ja existentes (SQLite, filesystem, tabelas de eval). Nenhuma tabela nova necessaria.

---

## 3. API Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/reports/conversations` | Gerar relatorio de conversas |
| POST | `/reports/costs` | Gerar relatorio de custos por agente/periodo |
| POST | `/reports/analytics` | Gerar relatorio de analytics e tendencias |
| POST | `/reports/evals` | Gerar relatorio de eval scores |

Todos os endpoints aceitam `format: "csv" | "pdf"` e retornam o arquivo para download com headers apropriados:
- CSV: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="report.csv"`
- PDF: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="report.pdf"`

### 3.1 POST `/reports/conversations` — Body

```json
{
  "format": "csv",
  "filters": {
    "agentId": "system.main",
    "channelType": "whatsapp",
    "from": "2026-03-01T00:00:00Z",
    "to": "2026-03-07T23:59:59Z",
    "limit": 500
  }
}
```

**CSV Output (colunas):**
`sessionId, agentId, agentLabel, channelType, channelId, startedAt, lastMessageAt, messageCount, userRef, status`

**PDF Output:**
- Cabecalho: logo/nome do sistema, periodo, filtros aplicados
- Tabela de sessoes com as mesmas colunas
- Rodape: total de conversas, gerado em

### 3.2 POST `/reports/costs` — Body

```json
{
  "format": "pdf",
  "filters": {
    "from": "2026-03-01T00:00:00Z",
    "to": "2026-03-07T23:59:59Z"
  },
  "groupBy": "agent"
}
```

**Dados coletados:** tokens de entrada/saida por agente por execucao (ja rastreados no heartbeat_log e sessions).

**PDF Output:**
- Resumo: total tokens, custo estimado (USD e BRL)
- Grafico de barras: custo por agente (SVG embutido)
- Tabela: agente, tokens entrada, tokens saida, custo estimado, numero de execucoes

### 3.3 POST `/reports/analytics` — Body

```json
{
  "format": "csv",
  "filters": {
    "from": "2026-02-01T00:00:00Z",
    "to": "2026-03-07T23:59:59Z"
  }
}
```

**CSV Output:** metricas diarias agregadas — `date, agent_id, conversations, messages, tokens_in, tokens_out, avg_response_ms`

### 3.4 POST `/reports/evals` — Body

```json
{
  "format": "pdf",
  "filters": {
    "agentId": "system.main"
  }
}
```

**PDF Output:**
- Historico de eval runs por agente: data, score medio, numero de casos, status
- Grafico de evolucao do score ao longo do tempo

---

## 4. Geracao de PDF

- Usar biblioteca `pdfkit` (Node.js, sem dependencia de browser/headless Chrome)
- Template minimalista: cabecalho com nome do sistema + data de geracao, corpo com tabelas, rodape com paginacao
- Tabelas geradas programaticamente (sem HTML → PDF)
- Graficos simples (barras, linhas): SVG gerado com `@svgdotjs/svg.js` ou implementacao manual minima

---

## 5. Telas (Hub)

### 5.1 `/reports` — Centro de Relatorios

- 4 cards: "Conversas", "Custos", "Analytics", "Evals"
- Cada card: descricao breve + botoes "Exportar CSV" e "Exportar PDF"
- Ao clicar: abre modal de filtros

### 5.2 Modal de Filtros (por tipo de relatorio)

- Campos comuns: periodo (date range picker), agente (select multi)
- Campos especificos por tipo:
  - Conversas: canal, status
  - Custos: agrupamento (por agente / por dia)
  - Analytics: granularidade (diario / semanal)
  - Evals: eval set especifico
- Botao "Gerar e baixar" — dispara POST e inicia download

### 5.3 Atalhos em outras paginas

- Pagina `/agents/:id` — botao "Exportar relatorio" no menu de acoes
- Pagina `/analytics` — botao "Exportar CSV" no canto superior direito
- Pagina `/agents/:id/evals` — botao "Exportar PDF" no canto superior direito

---

## 6. Criterios de Aceite

- [ ] Export CSV de conversas retorna arquivo com colunas corretas e dados do periodo solicitado
- [ ] Export PDF de custos inclui tabela por agente e total do periodo
- [ ] Export CSV de analytics retorna metricas diarias agregadas
- [ ] Export PDF de evals inclui historico de scores por agente
- [ ] Arquivos gerados tem nome descritivo: `conversas_2026-03-01_2026-03-07.csv`
- [ ] Filtro por periodo e respeitado em todos os tipos de relatorio
- [ ] Filtro por agente retorna apenas dados do agente selecionado
- [ ] PDF tem cabecalho com nome do sistema e data de geracao
- [ ] Modal de filtros no Hub permite configurar e disparar export sem sair da pagina
