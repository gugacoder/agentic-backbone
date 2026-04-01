# AB Hub - Agendamento Visual e Historico de Execucoes

Interface visual para criar, gerenciar e monitorar cron jobs dos agentes, com historico de execucoes auditavel.

---

## 1. Objetivo

- Listar cron jobs de todos os agentes num unico lugar
- Criar/editar cron jobs sem escrever cron expressions
- Monitorar execucoes em tempo real e historico
- Fornecer trilha de auditoria de tudo que o agente fez automaticamente
- Resolver D-007 (agendamento sem codigo), G-009 (calendario visual), D-009 (auditabilidade), G-008 (historico completo)

---

## 2. API Endpoints Existentes

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

---

## 3. Telas

### 3.1 Lista de Cron Jobs (`/cron`)

**Layout:** Tabela com filtros.

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Agente | job.agentId | Badge com nome |
| Nome | job.slug | Texto |
| Agenda | job.schedule | Descricao legivel ("Toda segunda as 09:00") |
| Status | job.enabled | Badge ativo/inativo |
| Proxima execucao | calculado do cron | Timestamp |
| Ultima execucao | runs[0] | Timestamp + status (ok/erro) |

**Acoes:**
- Botao "Novo Job" → dialog de criacao
- Filtro por agente
- Filtro ativo/inativo
- Executar manualmente (botao play por linha)

### 3.2 Criacao/Edicao de Cron Job

**Dialog/Drawer com formulario:**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Agente | Select | Selecionar agente (na criacao) |
| Nome (slug) | Input | Identificador do job |
| Instrucoes | Textarea | Prompt/tarefa que o agente executara |
| Tipo de agenda | Radio | Intervalo / Diario / Semanal / Mensal / Personalizado |
| Configuracao | Condicional | Campos visuais conforme tipo selecionado |
| Ativo | Switch | Ativar imediatamente |

**Tipos de agenda (builder visual):**

| Tipo | Campos | Cron gerado |
|------|--------|-------------|
| Intervalo | A cada N minutos/horas | `*/N * * * *` |
| Diario | Horario (HH:MM) | `MM HH * * *` |
| Semanal | Dias + Horario | `MM HH * * D` |
| Mensal | Dia do mes + Horario | `MM HH D * *` |
| Personalizado | Cron expression manual | direto |

- Preview: "Executara toda segunda e quarta as 09:00"
- Preview de proximas 5 execucoes

### 3.3 Detalhe do Job e Historico de Execucoes

**Rota:** `/cron/:agentId/:slug` (ou drawer sobre `/cron`)

**Secoes:**

1. **Resumo:** nome, agente, schedule legivel, status, proxima execucao
2. **Historico de Execucoes:** tabela paginada

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Data/Hora | run.ts | Timestamp |
| Status | run.status | Badge (ok / erro / timeout) |
| Duracao | run.duration_ms | Texto formatado |
| Tokens | run.tokens | Input + output |
| Custo | run.cost_usd | Valor formatado |
| Preview | run.preview | Texto truncado (expandivel) |

**Acoes:**
- Executar manualmente
- Editar job
- Desativar/ativar
- Excluir (com confirmacao)

### 3.4 Tab Agenda no Agente (`/agents/:id` tab Agenda)

- Mesma tabela de jobs, filtrada pelo agente
- Botao "Novo Job" pre-seleciona o agente
- Historico de execucoes recentes do agente

---

## 4. Componentes

### 4.1 CronScheduleBuilder

**Localizacao:** `components/cron/cron-schedule-builder.tsx`

```typescript
interface CronScheduleBuilderProps {
  value: string;                    // cron expression
  onChange: (cron: string) => void;
}
```

- Radio para tipo de agenda
- Campos condicionais conforme tipo
- Gera cron expression internamente
- Preview legivel e proximas execucoes

### 4.2 CronJobForm

**Localizacao:** `components/cron/cron-job-form.tsx`

```typescript
interface CronJobFormProps {
  agentId?: string;      // pre-selecionado se vindo do agente
  job?: CronJob;         // undefined = criacao
  onSuccess: () => void;
}
```

### 4.3 CronRunHistory

**Localizacao:** `components/cron/cron-run-history.tsx`

```typescript
interface CronRunHistoryProps {
  agentId: string;
  jobSlug: string;
}
```

- Tabela paginada com expand de preview
- Badge de status com cor semantica

---

## 5. Criterios de Aceite

- [ ] Lista de cron jobs exibe todos os jobs de todos os agentes
- [ ] Builder de agenda gera cron expression correta para cada tipo
- [ ] Preview mostra proximas 5 execucoes no fuso do usuario
- [ ] Criar job com agenda "diario as 09:00" gera `0 9 * * *`
- [ ] Executar manualmente dispara execucao e resultado aparece no historico
- [ ] Historico de execucoes mostra status, duracao, tokens e custo
- [ ] Toggle ativo/inativo funciona sem recarregar pagina
- [ ] Excluir job pede confirmacao
- [ ] Tab Agenda no agente filtra jobs corretamente
- [ ] Campo personalizado aceita cron expression manual
- [ ] Validacao impede cron expressions invalidas

---

## 6. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| CronScheduleBuilder | D-007 (agendamento sem cron), G-009 (calendario visual) |
| CronRunHistory | D-009, G-008 (auditabilidade) |
| Lista de Jobs | D-005 (visao unificada), G-003 (controle centralizado) |
| Execucao Manual | G-007 (independencia tecnica) |
