# PRP-07 — Agendamento Visual e Historico de Execucoes

Interface visual para criar, gerenciar e monitorar cron jobs dos agentes, com builder de agenda amigavel e historico de execucoes auditavel.

## Execution Mode

`implementar`

## Contexto

### Estado atual

O Hub tem scaffold (PRP-01), dashboard de agentes (PRP-02) com tab "Agenda" como placeholder. A pagina `/cron` existe como placeholder. O backbone expoe:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/cron/status` | Status geral do scheduler |
| GET | `/cron/jobs` | Listar todos os cron jobs |
| POST | `/cron/jobs` | Criar cron job |
| GET | `/cron/jobs/:agentId/:slug` | Detalhe de um job |
| PATCH | `/cron/jobs/:agentId/:slug` | Atualizar job |
| DELETE | `/cron/jobs/:agentId/:slug` | Remover job |
| POST | `/cron/jobs/:agentId/:slug/run` | Executar manualmente |
| GET | `/cron/jobs/:agentId/:slug/runs` | Historico de execucoes |

### Estado desejado

1. Pagina `/cron` com lista de todos os cron jobs
2. Builder visual de agenda (sem cron expressions para o usuario)
3. Formulario de criacao/edicao de jobs
4. Historico de execucoes com metricas
5. Tab Agenda no detalhe do agente

## Especificacao

### Feature F-027: Lista de cron jobs

**Substituir placeholder** `routes/_authenticated/cron.tsx`:

- Fetch via `cronJobsQueryOptions()` (loader)
- Tabela (shadcn Table):

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Agente | `job.agentId` | Badge com nome |
| Nome | `job.slug` | Texto |
| Agenda | `job.schedule` | Descricao legivel (gerada no client a partir da cron expression) |
| Status | `job.enabled` | StatusBadge ativo/inativo |
| Proxima execucao | calculado do cron | Timestamp (usar lib `cronstrue` para descricao legivel, `cron-parser` para proxima execucao) |
| Ultima execucao | ultimo run | Timestamp + StatusBadge (ok/erro) |

**Barra de acoes (PageHeader):**
- Filtro por agente (Select)
- Filtro ativo/inativo
- Botao "Novo Job" → abre dialog/drawer de criacao

**Acoes por linha:**
- Botao play (executar manualmente) → `POST /cron/jobs/:agentId/:slug/run`
- Click na linha → abre detalhe

### Feature F-028: Builder visual de agenda (CronScheduleBuilder)

**components/cron/cron-schedule-builder.tsx:**

```typescript
interface CronScheduleBuilderProps {
  value: string;                    // cron expression
  onChange: (cron: string) => void;
}
```

**Tipo de agenda (RadioGroup):**

| Tipo | Campos visuais | Cron gerado |
|------|----------------|-------------|
| Intervalo | Input "A cada N" + Select "minutos/horas" | `*/N * * * *` ou `0 */N * * *` |
| Diario | Time picker (HH:MM) | `MM HH * * *` |
| Semanal | Checkbox group (Seg-Dom) + Time picker | `MM HH * * D` |
| Mensal | Input dia do mes (1-28) + Time picker | `MM HH D * *` |
| Personalizado | Input cron expression manual | direto |

**Preview legivel:**
- Texto: "Executara toda segunda e quarta as 09:00"
- Usar `cronstrue` lib com locale pt-BR para gerar descricao
- Preview de proximas 5 execucoes (usar `cron-parser` para calcular)
- Exibir timestamps no fuso do usuario

**Validacao:**
- Tipo Personalizado: validar cron expression com `cron-parser`
- Feedback inline se expressao invalida

### Feature F-029: Formulario de criacao/edicao de cron job

**components/cron/cron-job-form.tsx:**

```typescript
interface CronJobFormProps {
  agentId?: string;      // pre-selecionado se vindo do agente
  job?: CronJob;         // undefined = criacao
  onSuccess: () => void;
}
```

**Campos:**

| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| Agente | Select (lista de agentes) | Sim (na criacao) | Pre-selecionado se aberto do agente |
| Nome (slug) | Input texto | Sim | Identificador do job (kebab-case) |
| Instrucoes | Textarea | Sim | Prompt/tarefa que o agente executara |
| Agenda | CronScheduleBuilder | Sim | Cron expression gerada pelo builder |
| Ativo | Switch | Nao (default: true) | Ativar imediatamente |

- Criacao: `POST /cron/jobs` → invalida `["cron-jobs"]`, fecha dialog
- Edicao: `PATCH /cron/jobs/:agentId/:slug` → invalida queries, fecha dialog
- Validacao: slug kebab-case, instrucoes nao vazio, cron valido

### Feature F-030: Historico de execucoes + acoes

**Detalhe do job** — acessivel via click na linha da tabela ou rota `/cron/:agentId/:slug` (pode ser drawer/dialog sobre a lista).

**Resumo:**
- Nome, agente, schedule legivel, status, proxima execucao
- Acoes: Executar manualmente, Editar, Ativar/Desativar, Excluir

**components/cron/cron-run-history.tsx:**

```typescript
interface CronRunHistoryProps {
  agentId: string;
  jobSlug: string;
}
```

- Fetch via `GET /cron/jobs/:agentId/:slug/runs`
- Tabela paginada:

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Data/Hora | `run.ts` | Timestamp formatado |
| Status | `run.status` | Badge (ok=verde, erro=vermelho, timeout=amarelo) |
| Duracao | `run.duration_ms` | Texto formatado (ex: "12.3s") |
| Tokens | `run.tokens` | Input + output |
| Custo | `run.cost_usd` | USD com 4 decimais |
| Preview | `run.preview` | Texto truncado, expandivel com click |

- Paginacao com 20 items por pagina

**Tab Agenda no detalhe do agente (PRP-02):**
- Substituir placeholder da tab "Agenda" em `agents.$id.tsx`
- Mesma tabela de jobs, filtrada por agente: `GET /cron/jobs?agentId=:id`
- Botao "Novo Job" pre-seleciona o agente no formulario
- Historico de execucoes recentes do agente abaixo da tabela

**Acoes:**
- Executar manualmente: `POST /cron/jobs/:agentId/:slug/run` → toast, invalida historico
- Toggle ativo/inativo: `PATCH /cron/jobs/:agentId/:slug` com `{ enabled }` → invalida queries
- Excluir: `ConfirmDialog` → `DELETE /cron/jobs/:agentId/:slug` → invalida queries

## Limites

- **NAO** implementar visualizacao de calendario mensal/semanal (fica para sprint futuro) — lista/tabela eh suficiente.
- **NAO** criar APIs novas no backbone — todas existem.
- **NAO** implementar notificacoes de execucao (push/email) — apenas visualizacao no hub.
- **NAO** implementar edicao inline na tabela — usar dialog/drawer.
- **NAO** parsear cron expressions no backend — usar libs client-side (`cronstrue`, `cron-parser`).

## Dependencias

- **PRP-01** (Scaffold Hub) deve estar implementado.
- **PRP-02** (Dashboard de Agentes) deve estar implementado — tab Agenda vive na pagina de detalhe do agente.

## Validacao

- [ ] Pagina `/cron` lista todos os cron jobs de todos os agentes
- [ ] Tabela mostra agenda legivel (nao cron expression crua)
- [ ] Filtro por agente funciona
- [ ] Filtro ativo/inativo funciona
- [ ] Builder gera cron expression correta para cada tipo (intervalo, diario, semanal, mensal)
- [ ] Preview mostra proximas 5 execucoes no fuso do usuario
- [ ] Tipo "Personalizado" aceita cron expression manual com validacao
- [ ] Criar job com agenda "diario as 09:00" gera `0 9 * * *`
- [ ] Executar manualmente dispara execucao e resultado aparece no historico
- [ ] Historico mostra status, duracao, tokens, custo e preview
- [ ] Toggle ativo/inativo funciona sem recarregar pagina
- [ ] Excluir job pede confirmacao
- [ ] Tab Agenda no agente filtra jobs do agente e pre-seleciona agente no form
- [ ] Cron expression invalida mostra erro de validacao
- [ ] `npm run build:hub` compila sem erros

## Rastreabilidade

| Feature | Spec | Discoveries |
|---------|------|-------------|
| F-027 Lista jobs | S-007 sec 3.1 | D-005, G-003 |
| F-028 Schedule builder | S-007 sec 3.2 | D-007, G-009 |
| F-029 Job form | S-007 sec 3.2 | D-007, G-007 |
| F-030 Run history | S-007 sec 3.3 | D-009, G-008 |
