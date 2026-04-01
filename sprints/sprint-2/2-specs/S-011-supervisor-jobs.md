# AB Hub - Supervisor de Jobs

Interface para monitorar, gerenciar e cancelar processos de longa duracao (jobs) com stdout/stderr em streaming e metricas de recursos.

---

## 1. Objetivo

- Listar jobs em execucao e concluidos com status, agente e recursos consumidos
- Visualizar stdout/stderr em streaming para jobs ativos
- Cancelar (kill) jobs em execucao
- Limpar jobs concluidos
- Resolver D-019 (jobs sem visibilidade), G-019 (supervisor de jobs)

---

## 2. API Endpoints Existentes

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/jobs` | Listar jobs (opcional `?agentId=` filter) |
| GET | `/jobs/:id` | Detalhe de um job |
| POST | `/jobs` | Submeter novo job |
| POST | `/jobs/:id/kill` | Matar job em execucao |
| DELETE | `/jobs/:id` | Limpar job concluido da memoria |

**SSE:** Evento `job:status` emitido quando job muda de estado (start, complete, fail, kill).

### 2.1 Modelo de Dados do Job (existente no backend)

```typescript
interface JobSummary {
  id: string;
  agentId: string;
  command: string;
  cwd?: string;
  status: "running" | "completed" | "failed" | "killed" | "timeout";
  pid?: number;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  stdout: string;       // stdout acumulado
  stderr: string;       // stderr acumulado
  cpu?: number;          // % CPU
  memory?: number;       // bytes RSS
  timeout?: number;      // timeout em ms
}
```

### 2.2 Endpoint Novo Necessario

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/jobs/:id/stream` | SSE stream de stdout/stderr em tempo real |

**Justificativa:** O endpoint `GET /jobs/:id` retorna stdout acumulado, mas para jobs longos precisamos de streaming. Implementar como SSE que emite linhas conforme chegam.

**Eventos SSE:**

```
event: stdout
data: {"line": "Processing item 42/100...", "ts": "2026-03-07T14:00:01Z"}

event: stderr
data: {"line": "Warning: deprecated API", "ts": "2026-03-07T14:00:02Z"}

event: status
data: {"status": "completed", "exitCode": 0, "finishedAt": "2026-03-07T14:05:00Z"}
```

---

## 3. Telas

### 3.1 Lista de Jobs (`/jobs`)

**Rota nova:** Adicionar `/jobs` ao router e menu lateral.

**Layout:** Tabela responsiva (desktop), lista de cards (mobile).

| Coluna | Fonte | Visual |
|--------|-------|--------|
| Status | `job.status` | Badge colorido (running=azul, completed=verde, failed=vermelho, killed=cinza) |
| Agente | `job.agentId` | Badge com nome |
| Comando | `job.command` | Texto truncado (tooltip com comando completo) |
| Inicio | `job.startedAt` | Timestamp relativo ("ha 5 min") |
| Duracao | calculado | "5m 32s" ou "rodando ha 2m" |
| CPU | `job.cpu` | Barra de progresso ou texto "12%" |
| Memoria | `job.memory` | Texto formatado "45 MB" |

**Acoes:**
- Filtro por status (todos / rodando / concluidos / falhos)
- Filtro por agente
- Click na linha → drawer de detalhe

**Atualizacao:** SSE evento `job:status` invalida query `["jobs"]`.

### 3.2 Detalhe do Job (Drawer)

**Rota:** `/jobs/:id` (renderiza drawer sobre lista)

**Secoes:**

**Header:**
- Status badge grande
- Agente, comando, PID
- Botoes: "Cancelar" (se running), "Limpar" (se concluido)

**Output (tab principal):**
- Terminal view com stdout/stderr intercalados
- Scroll automatico para baixo (auto-scroll toggle)
- Stdout em branco, stderr em vermelho
- Para jobs ativos: conecta no SSE `/jobs/:id/stream`
- Para jobs concluidos: exibe stdout/stderr acumulados

**Metricas (tab secundaria):**
- CPU: grafico simples ou valor atual
- Memoria: valor atual formatado
- Exit code (se concluido)
- Duracao total

---

## 4. Componentes

### 4.1 JobList

**Localizacao:** `components/jobs/job-list.tsx`

```typescript
interface JobListProps {
  jobs: JobSummary[];
  onSelect: (id: string) => void;
}
```

### 4.2 JobDetail

**Localizacao:** `components/jobs/job-detail.tsx`

```typescript
interface JobDetailProps {
  jobId: string;
}
```

- Sheet (desktop) / Vaul drawer (mobile)
- Conecta no SSE stream para jobs ativos

### 4.3 TerminalOutput

**Localizacao:** `components/jobs/terminal-output.tsx`

```typescript
interface TerminalOutputProps {
  stdout: string;
  stderr: string;
  streaming?: boolean;        // se true, conecta no SSE
  streamUrl?: string;         // URL do SSE stream
}
```

- Fundo escuro, fonte monoespaco
- Linhas de stderr em vermelho
- Auto-scroll com toggle
- Maximo 10.000 linhas visivels (virtualizado se necessario)

### 4.4 API Module

**Localizacao:** `api/jobs.ts`

```typescript
export const jobsQueryOptions = (agentId?: string) =>
  queryOptions({
    queryKey: agentId ? ["jobs", { agentId }] : ["jobs"],
    queryFn: () => request<JobSummary[]>(
      agentId ? `/jobs?agentId=${agentId}` : "/jobs"
    ),
  });

export const jobQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["jobs", id],
    queryFn: () => request<JobSummary>(`/jobs/${id}`),
  });
```

---

## 5. Navegacao

Adicionar "Jobs" ao menu lateral:

| Item | Icone | Rota | Visivel mobile |
|------|-------|------|----------------|
| Dashboard | LayoutDashboard | `/` | Sim |
| Agentes | Bot | `/agents` | Sim |
| Conversas | MessageSquare | `/conversations` | Sim |
| Canais | Radio | `/channels` | Sim |
| Jobs | Cpu | `/jobs` | Nao (submenu) |
| Agenda | Calendar | `/cron` | Nao (submenu) |
| Configuracoes | Settings | `/settings` | Sim |

---

## 6. Criterios de Aceite

- [ ] Rota `/jobs` exibe lista de todos os jobs
- [ ] Filtro por status funciona (todos / rodando / concluidos / falhos)
- [ ] Filtro por agente funciona
- [ ] Click na linha abre drawer com detalhe
- [ ] Stdout/stderr exibidos em terminal view com cores distintas
- [ ] Jobs ativos mostram stdout em streaming via SSE
- [ ] Auto-scroll funciona e pode ser desabilitado
- [ ] Botao "Cancelar" mata job e atualiza status
- [ ] Botao "Limpar" remove job concluido
- [ ] SSE `job:status` atualiza lista automaticamente
- [ ] CPU e memoria exibidos para jobs ativos
- [ ] Layout responsivo: tabela (desktop), cards (mobile)
- [ ] Menu lateral inclui "Jobs"

---

## 7. Rastreabilidade

| Componente | Discoveries |
|------------|-------------|
| JobList | D-019 (jobs sem visibilidade), G-019 (supervisor de jobs) |
| TerminalOutput | D-019 (stdout/stderr), G-019 (streaming) |
| JobDetail | D-019 (metricas CPU/mem), G-019 (cancelamento) |
| Dashboard integration | G-015 (card de jobs no dashboard — S-008) |
