# PRP-33 — Export de Relatorios (PDF e CSV)

Exportacao de dados do Hub em formatos PDF e CSV: historico de conversas, metricas de custo por agente/periodo, analytics de tendencia e eval scores. Download direto pelo navegador, sem fila.

## Execution Mode

`implementar`

## Contexto

### Estado atual

Nao ha mecanismo de exportacao de dados do backbone. Operadores extraem relatorios manualmente com screenshots. Nao ha endpoints de `/reports/*` nem pagina de relatorios no Hub.

### Estado desejado

1. 4 endpoints de exportacao: `/reports/conversations`, `/reports/costs`, `/reports/analytics`, `/reports/evals`
2. Suporte a `format: "csv" | "pdf"` em todos os endpoints
3. Geracao de PDF com `pdfkit` (sem headless browser)
4. Pagina `/reports` no Hub com 4 cards e modais de filtro

## Especificacao

### Feature F-126: Endpoints de relatorios — suporte CSV

**Novas rotas em `apps/backbone/src/routes/reports.ts`:**

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/reports/conversations` | Relatorio de conversas |
| POST | `/reports/costs` | Relatorio de custos por agente/periodo |
| POST | `/reports/analytics` | Relatorio de analytics e tendencias |
| POST | `/reports/evals` | Relatorio de eval scores |

Todos aceitam `format: "csv" | "pdf"` no body. Quando `format: "csv"`:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="<tipo>_<from>_<to>.csv"`

**POST `/reports/conversations`** — filtros: `agentId`, `channelType`, `from`, `to`, `limit`.
CSV columns: `sessionId, agentId, agentLabel, channelType, channelId, startedAt, lastMessageAt, messageCount, userRef, status`
Fonte de dados: tabela `sessions` (SQLite) + filesystem de sessoes.

**POST `/reports/costs`** — filtros: `from`, `to`. GroupBy: `agent`.
CSV columns: `agentId, agentLabel, tokensIn, tokensOut, totalTokens, costUsdEstimate, executionCount`
Fonte de dados: `heartbeat_log` + `sessions` (campos de tokens ja rastreados).
Custo estimado: calcular com taxa media de referencia OpenRouter (configurable em fallback hardcoded).

**POST `/reports/analytics`** — filtros: `from`, `to`.
CSV columns: `date, agentId, conversations, messages, tokensIn, tokensOut, avgResponseMs`
Fonte de dados: agregar por dia a partir de `sessions` e `heartbeat_log`.

**POST `/reports/evals`** — filtros: `agentId`.
CSV columns: `runId, setName, agentId, scoreAvg, totalCases, passed, failed, status, startedAt, finishedAt`
Fonte de dados: tabelas `eval_runs` + `eval_sets` (PRP-19).

Montar rotas no `index.ts` do backbone.

**Hub — `apps/hub/src/api/reports.ts`:**

```typescript
export async function downloadReport(type: ReportType, filters: ReportFilters, format: "csv" | "pdf") {
  const response = await request<Blob>(`/reports/${type}`, {
    method: "POST",
    body: JSON.stringify({ format, filters }),
    responseType: "blob",
  });
  triggerDownload(response, `${type}_${filters.from}_${filters.to}.${format}`);
}
```

### Feature F-127: Geracao de PDF com pdfkit

**Modulo `src/reports/pdf-builder.ts`** com classe `PdfBuilder`:

```typescript
class PdfBuilder {
  header(systemName: string, reportTitle: string, generatedAt: Date): this
  summary(items: Array<{ label: string; value: string }>): this
  table(columns: string[], rows: string[][]): this
  barChart(data: Array<{ label: string; value: number }>): this  // SVG embutido
  footer(totalPages?: boolean): this
  build(): Buffer
}
```

**Dependencias:** `pdfkit`. Sem headless Chrome.

**Template de PDF para cada tipo:**

- **Conversas:** Cabecalho + resumo (total conversas, periodo) + tabela de sessoes + rodape com total e data de geracao
- **Custos:** Cabecalho + resumo (total tokens, custo estimado) + grafico de barras por agente (SVG simples) + tabela de custos por agente
- **Analytics:** Cabecalho + tabela de metricas diarias agregadas
- **Evals:** Cabecalho + historico de runs por agente + grafico de evolucao do score (linha SVG simples)

Quando `format: "pdf"`:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="<tipo>_<from>_<to>.pdf"`

### Feature F-128: Pagina /reports no Hub e modais de filtro

**Nova rota** `routes/_authenticated/reports/index.tsx`.

**Componentes:**

| Componente | Localizacao |
|------------|-------------|
| `ReportsPage` | `routes/_authenticated/reports/index.tsx` |
| `ReportCard` | `components/reports/report-card.tsx` |
| `ReportFiltersModal` | `components/reports/report-filters-modal.tsx` |

**ReportsPage:**
- 4 cards: "Conversas", "Custos", "Analytics", "Evals"
- Cada card: descricao breve + botoes "Exportar CSV" e "Exportar PDF"
- Ao clicar: abre ReportFiltersModal

**ReportFiltersModal (por tipo):**
- Campos comuns: periodo (date range picker), agente (select)
- Campos por tipo:
  - Conversas: canal (select), status
  - Custos: agrupamento (por agente / por dia)
  - Analytics: (sem extras)
  - Evals: eval set especifico (select)
- Botao "Gerar e baixar" — dispara POST e inicia download

**Atalhos em outras paginas:**
- `/agents/:id`: botao "Exportar relatorio" no menu de acoes (abre modal de filtros com agente pre-selecionado)
- `/analytics`: botao "Exportar CSV" no canto superior direito
- `/agents/:id/evaluation`: botao "Exportar PDF" no canto superior direito

**Adicionar link "Relatorios"** na sidebar de navegacao do Hub.

## Limites

- **NAO** implementar agendamento de relatorios (apenas on-demand)
- **NAO** implementar envio de relatorio por email
- **NAO** implementar relatorio de LGPD (coberto pelo endpoint `/lgpd/report` do PRP-26)

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado
- **PRP-19** (Avaliacao de Qualidade — sprint 4) deve estar implementado — dados de eval_runs
- Dependencia npm: `pdfkit`

## Validacao

- [ ] Export CSV de conversas retorna arquivo com colunas corretas e dados do periodo
- [ ] Export PDF de custos inclui tabela por agente e total do periodo
- [ ] Export CSV de analytics retorna metricas diarias agregadas
- [ ] Export PDF de evals inclui historico de scores por agente
- [ ] Arquivos gerados tem nome descritivo: `conversas_2026-03-01_2026-03-07.csv`
- [ ] Filtro por periodo respeitado em todos os tipos
- [ ] Filtro por agente retorna apenas dados do agente selecionado
- [ ] PDF tem cabecalho com nome do sistema e data de geracao
- [ ] Modal de filtros no Hub permite configurar e disparar export sem sair da pagina
- [ ] `npm run build:hub` e `npm run typecheck` passam sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-126 Endpoints /reports/* CSV | S-033 sec 3 | D-046 |
| F-127 Geracao de PDF com pdfkit | S-033 sec 4 | G-047 |
| F-128 Pagina /reports + modais Hub | S-033 sec 5 | G-047 |
